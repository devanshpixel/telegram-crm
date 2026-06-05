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
