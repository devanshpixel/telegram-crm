import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import path from "path";
import fs from "fs";
import { SCHEMA_SQL } from "@/lib/db/schema";

const DB_PATH =
  process.env.NODE_ENV === "production"
    ? "/tmp/crm.db"
    : path.join(process.cwd(), "data", "crm.db");

const TURSO_URL = process.env.TURSO_DB_URL;
const TURSO_TOKEN = process.env.TURSO_DB_TOKEN;

const TABLE_ORDER = [
  "contacts",
  "conversations",
  "messages",
  "purchases",
  "tags",
  "notes",
  "tag_events",
  "media",
  "broadcasts",
  "telegram_sessions",
  "telegram_pending_codes",
];

async function executeBatch(client: any, statements: string[]): Promise<void> {
  for (const sql of statements) {
    const trimmed = sql.trim();
    if (!trimmed) continue;
    try {
      await client.execute(trimmed);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (!msg.includes("already exists") && !msg.includes("duplicate")) {
        throw new Error(`Failed: ${trimmed.slice(0, 120)}... → ${msg}`);
      }
    }
  }
}

async function main() {
  if (!TURSO_URL || !TURSO_TOKEN) {
    console.error("TURSO_DB_URL and TURSO_DB_TOKEN are required");
    process.exit(1);
  }

  console.log("Reading local SQLite from:", DB_PATH);
  if (!fs.existsSync(DB_PATH)) {
    console.error("Local DB not found:", DB_PATH);
    process.exit(1);
  }

  const Database = require("better-sqlite3");
  const source = new Database(DB_PATH);

  const { createClient } = require("@libsql/client");
  const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  console.log("Creating schema on Turso...");
  const schemaStatements = SCHEMA_SQL.split(";").filter((s) => s.trim());
  await executeBatch(turso, schemaStatements);
  console.log("  Schema created");

  let totalRows = 0;

  for (const table of TABLE_ORDER) {
    console.log(`Migrating: ${table}`);
    const rows = source.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];

    if (rows.length === 0) {
      console.log(`  0 rows`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    const insertSql = `INSERT OR REPLACE INTO "${table}" (${colList}) VALUES (${placeholders})`;

    let inserted = 0;
    for (const row of rows) {
      const values = columns.map((c) => row[c]);
      try {
        const result = await turso.execute({ sql: insertSql, args: values });
        if (result.rowsAffected > 0) inserted++;
      } catch (e: any) {
        throw new Error(`Insert failed on ${table}: ${e?.message ?? String(e)}`);
      }
    }

    const verify = await turso.execute(`SELECT COUNT(*) as cnt FROM "${table}"`);
    const count = verify.rows[0]?.cnt ?? 0;
    console.log(`  Inserted: ${inserted}, Verified count: ${count}`);
    if (count !== rows.length) {
      throw new Error(`Row count mismatch on ${table}: source=${rows.length} target=${count}`);
    }
    totalRows += count;
  }

  source.close();
  console.log(`\n✓ Migration complete: ${totalRows} total rows across ${TABLE_ORDER.length} tables`);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});