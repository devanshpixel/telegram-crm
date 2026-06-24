/**
 * Verify the LIVE Turso (production) database has every column the app needs.
 *
 * WHY THIS EXISTS: lib/db/index.ts only runs the incremental ALTER TABLE
 * migrations for local better-sqlite3. The Turso path just runs SCHEMA_SQL on
 * an *empty* DB. So a Turso database created from an older schema can be missing
 * columns (conv_state, offer_sent, kind, ...) and the funnel/webhook will break.
 *
 * USAGE: ensure TURSO_DB_URL + TURSO_DB_TOKEN are present in one of the env files
 * below (or export them), then:  npx tsx scripts/check-turso-schema.ts
 * It prints only column presence + row counts — no secrets, safe to run/share.
 */
import { config } from "dotenv";
config({ path: ".env.vercel" });
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.TURSO_DB_URL;
  const authToken = process.env.TURSO_DB_TOKEN;
  if (!url) {
    console.log("TURSO_DB_URL not set in .env.vercel / .env.local / .env. Add it, then re-run.");
    process.exit(2);
  }
  console.log("Turso URL:", url, "\n");
  const { createClient } = require("@libsql/client");
  const client = createClient({ url, authToken });

  // Columns the runtime code depends on (from schema.ts + migrations in db/index.ts).
  const required: Record<string, string[]> = {
    contacts: ["telegram_id", "telegram_access_hash", "conv_state", "offer_sent", "offer_sent_at", "last_locked_response_at", "total_spent", "vip_level", "fan_status", "fan_score", "ppv_count", "last_purchase_date", "lead_score", "lead_status", "revenue"],
    conversations: ["last_synced_message_id", "unread_count"],
    messages: ["telegram_message_id", "direction", "is_read"],
    purchases: ["kind", "note", "amount", "purchase_date"],
    media: ["price", "filename", "mime_type"],
    settings: ["key", "value"],
    broadcasts: ["trigger", "sent_count"],
    telegram_sessions: ["session_string"],
  };

  let problems = 0;
  for (const [table, cols] of Object.entries(required)) {
    try {
      const info = await client.execute(`PRAGMA table_info(${table})`);
      const present = new Set(info.rows.map((r: any) => r.name));
      const missing = cols.filter((c) => !present.has(c));
      const cnt = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
      const status = missing.length ? `❌ MISSING: ${missing.join(", ")}` : "✅ OK";
      console.log(`[${table}]  rows=${cnt.rows[0].c}  ${status}`);
      if (missing.length) problems++;
    } catch (e: any) {
      console.log(`[${table}]  ❌ ERROR: ${e?.message || e}`);
      problems++;
    }
  }
  client.close();
  console.log(problems ? `\n⚠️  ${problems} table(s) need attention — run scripts/patch-turso.ts or migrate-to-turso.ts.` : "\n✅ Turso schema is complete.");
  process.exit(problems ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
