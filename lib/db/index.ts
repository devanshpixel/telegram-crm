import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { SCHEMA_SQL } from "./schema";

const DB_PATH =
  process.env.NODE_ENV === "production"
    ? "/tmp/crm.db"
    : path.join(process.cwd(), "data", "crm.db");

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
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='purchases'")
    .all() as { name: string }[];
  if (tables.length === 0) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        purchase_date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_purchases_contact ON purchases(contact_id);
    `);
  }
  const tagEventTables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tag_events'")
    .all() as { name: string }[];
  if (tagEventTables.length === 0) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tag_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        tag_name TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('added', 'removed')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tag_events_contact ON tag_events(contact_id);
    `);
  }
  if (!columnExists(database, "purchases", "kind")) {
    database.exec(
      "ALTER TABLE purchases ADD COLUMN kind TEXT NOT NULL DEFAULT 'ppv'",
    );
  }
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_purchases_contact_kind ON purchases(contact_id, kind)",
  );
  if (!columnExists(database, "contacts", "ppv_count")) {
    database.exec(
      "ALTER TABLE contacts ADD COLUMN ppv_count INTEGER NOT NULL DEFAULT 0",
    );
  }
  const backfillRow = database
    .prepare("SELECT COUNT(*) AS c FROM contacts WHERE ppv_count > 0")
    .get() as { c: number };
  if (backfillRow.c === 0) {
    database.exec(`
      UPDATE contacts SET ppv_count = (
        SELECT COUNT(*) FROM purchases
        WHERE purchases.contact_id = contacts.id AND purchases.kind = 'ppv'
      )
    `);
  }
  const broadcastTables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='broadcasts'")
    .all() as { name: string }[];
  if (broadcastTables.length === 0) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        recipient_count INTEGER NOT NULL,
        sent_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at);
    `);
  }
  if (!columnExists(database, "broadcasts", "trigger")) {
    database.exec("ALTER TABLE broadcasts ADD COLUMN trigger TEXT");
  }
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_broadcasts_trigger_created_at ON broadcasts(trigger, created_at)",
  );
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date)",
  );
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at)",
  );
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_contacts_last_purchase_date ON contacts(last_purchase_date)",
  );
  const mediaTables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media'")
    .all() as { name: string }[];
  if (mediaTables.length === 0) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        price REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_media_contact ON media(contact_id);
    `);
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
  console.log("[crm-debug] getDb() called, DB_PATH =", DB_PATH);
  const before = global.__crmDb
    ? ((global.__crmDb.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number })?.count ?? -1)
    : -2;
  console.log("[crm-debug] getDb() existing global row count:", before);
  if (process.env.NODE_ENV === "production") {
    if (!global.__crmDb) {
      global.__crmDb = createDatabase();
    }
    const after = (global.__crmDb.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number })?.count ?? -3;
    console.log("[crm-debug] getDb() returning db with row count:", after);
    return global.__crmDb;
  }

  if (!global.__crmDb) {
    global.__crmDb = createDatabase();
  }
  const after = (global.__crmDb.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number })?.count ?? -3;
  console.log("[crm-debug] getDb() returning db with row count:", after);
  return global.__crmDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}
