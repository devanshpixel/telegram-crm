import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { SCHEMA_SQL } from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "crm.db");

declare global {
  var __crmDb: Database.Database | undefined;
}

function columnExists(
  database: Database.Database,
  table: string,
  column: string,
): boolean {
  const rows = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

function migrateDatabase(database: Database.Database): void {
  if (!columnExists(database, "contacts", "telegram_id")) {
    database.exec("ALTER TABLE contacts ADD COLUMN telegram_id TEXT");
  }
  if (!columnExists(database, "contacts", "telegram_access_hash")) {
    database.exec(
      "ALTER TABLE contacts ADD COLUMN telegram_access_hash TEXT",
    );
  }
  if (!columnExists(database, "messages", "telegram_message_id")) {
    database.exec(
      "ALTER TABLE messages ADD COLUMN telegram_message_id INTEGER",
    );
  }
  if (!columnExists(database, "conversations", "last_synced_message_id")) {
    database.exec(
      "ALTER TABLE conversations ADD COLUMN last_synced_message_id INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columnExists(database, "contacts", "total_spent")) {
    database.exec(
      "ALTER TABLE contacts ADD COLUMN total_spent REAL NOT NULL DEFAULT 0",
    );
  }
  if (!columnExists(database, "contacts", "vip_level")) {
    database.exec(
      "ALTER TABLE contacts ADD COLUMN vip_level TEXT NOT NULL DEFAULT 'none'",
    );
  }
  if (!columnExists(database, "contacts", "fan_status")) {
    database.exec(
      "ALTER TABLE contacts ADD COLUMN fan_status TEXT NOT NULL DEFAULT 'active'",
    );
  }
  if (!columnExists(database, "contacts", "fan_score")) {
    database.exec(
      "ALTER TABLE contacts ADD COLUMN fan_score INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columnExists(database, "contacts", "last_purchase_date")) {
    database.exec(
      "ALTER TABLE contacts ADD COLUMN last_purchase_date TEXT",
    );
  }
}

function createDatabase(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(SCHEMA_SQL);
  migrateDatabase(database);
  return database;
}

export function getDb(): Database.Database {
  if (process.env.NODE_ENV === "production") {
    if (!global.__crmDb) {
      global.__crmDb = createDatabase();
    }
    return global.__crmDb;
  }

  if (!global.__crmDb) {
    global.__crmDb = createDatabase();
  }
  return global.__crmDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}
