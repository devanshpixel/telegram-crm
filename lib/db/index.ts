/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "path";
import fs from "fs";
import { SCHEMA_SQL } from "./schema";
import {
  createRawBetterSqlite3,
  wrapBetterSqlite3,
  createTursoAsync,
} from "./adapters";
import type { AsyncDb } from "./adapters";

const DB_PATH =
  process.env.NODE_ENV === "production"
    ? "/tmp/crm.db"
    : path.join(process.cwd(), "data", "crm.db");

declare global {
  var __crmDb: AsyncDb | undefined;
}

function columnExists(database: any, table: string, column: string): boolean {
  const rows = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

function migrateBetterSqlite3(database: any): void {
  if (!columnExists(database, "contacts", "telegram_id")) {
    database.exec("ALTER TABLE contacts ADD COLUMN telegram_id TEXT");
  }
  if (!columnExists(database, "contacts", "telegram_access_hash")) {
    database.exec("ALTER TABLE contacts ADD COLUMN telegram_access_hash TEXT");
  }
  if (!columnExists(database, "messages", "telegram_message_id")) {
    database.exec("ALTER TABLE messages ADD COLUMN telegram_message_id INTEGER");
  }
  if (!columnExists(database, "conversations", "last_synced_message_id")) {
    database.exec("ALTER TABLE conversations ADD COLUMN last_synced_message_id INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnExists(database, "contacts", "total_spent")) {
    database.exec("ALTER TABLE contacts ADD COLUMN total_spent REAL NOT NULL DEFAULT 0");
  }
  if (!columnExists(database, "contacts", "vip_level")) {
    database.exec("ALTER TABLE contacts ADD COLUMN vip_level TEXT NOT NULL DEFAULT 'none'");
  }
  if (!columnExists(database, "contacts", "fan_status")) {
    database.exec("ALTER TABLE contacts ADD COLUMN fan_status TEXT NOT NULL DEFAULT 'active'");
  }
  if (!columnExists(database, "contacts", "fan_score")) {
    database.exec("ALTER TABLE contacts ADD COLUMN fan_score INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnExists(database, "contacts", "last_purchase_date")) {
    database.exec("ALTER TABLE contacts ADD COLUMN last_purchase_date TEXT");
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
    database.exec("ALTER TABLE purchases ADD COLUMN kind TEXT NOT NULL DEFAULT 'ppv'");
  }
  database.exec("CREATE INDEX IF NOT EXISTS idx_purchases_contact_kind ON purchases(contact_id, kind)");
  if (!columnExists(database, "contacts", "ppv_count")) {
    database.exec("ALTER TABLE contacts ADD COLUMN ppv_count INTEGER NOT NULL DEFAULT 0");
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
  database.exec("CREATE INDEX IF NOT EXISTS idx_broadcasts_trigger_created_at ON broadcasts(trigger, created_at)");
  if (!columnExists(database, "contacts", "offer_sent")) {
    database.exec("ALTER TABLE contacts ADD COLUMN offer_sent INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnExists(database, "contacts", "conv_state")) {
    database.exec("ALTER TABLE contacts ADD COLUMN conv_state TEXT NOT NULL DEFAULT 'FREE_CHAT'");
  }
  if (!columnExists(database, "contacts", "offer_sent_at")) {
    database.exec("ALTER TABLE contacts ADD COLUMN offer_sent_at TEXT");
  }
  if (!columnExists(database, "contacts", "last_locked_response_at")) {
    database.exec("ALTER TABLE contacts ADD COLUMN last_locked_response_at TEXT");
  }

  const settingsTables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
    .all() as { name: string }[];
  if (settingsTables.length === 0) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    // Migrate from settings.json if it exists
    const settingsPath = path.join(process.cwd(), "data", "settings.json");
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        const ts = new Date().toISOString();
        for (const [key, value] of Object.entries(settings)) {
          database.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
            .run(key, JSON.stringify(value), ts);
        }
      } catch (e) {
        console.error("[DB] Failed to migrate settings.json:", e);
      }
    }
  }

  database.exec("CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_contacts_last_purchase_date ON contacts(last_purchase_date)");
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

function isTursoConfigured(): boolean {
  return !!process.env.TURSO_DB_URL;
}

export async function getDb(): Promise<AsyncDb> {
  if (global.__crmDb) return global.__crmDb;

  const hasUrl = !!process.env.TURSO_DB_URL;
  const hasToken = !!process.env.TURSO_DB_TOKEN;
  const tokenLen = process.env.TURSO_DB_TOKEN?.length ?? 0;
  console.log("[DB] TURSO_DB_URL exists=", hasUrl, "TURSO_DB_TOKEN exists=", hasToken, "token length=", tokenLen);

  if (isTursoConfigured()) {
    const tursoUrl = process.env.TURSO_DB_URL!;
    const tursoToken = process.env.TURSO_DB_TOKEN;
    console.log("[DB] Creating Turso client, URL prefix:", tursoUrl.slice(0, 40));
    const db = createTursoAsync(tursoUrl, tursoToken);
    try {
      // Check if schema already exists to avoid redundant execution
      const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contacts'").all();
      if (tables.length === 0) {
        console.log("[DB] Executing SCHEMA_SQL on Turso...");
        await db.exec(SCHEMA_SQL);
        console.log("[DB] Schema initialized");
      } else {
        console.log("[DB] Schema already exists, skipping initialization");
      }
    } catch (e: unknown) {
      console.log("[DB] Schema check/init failed:", e instanceof Error ? e.message : String(e));
      // Continue anyway, it might be fine or fail later
    }
    global.__crmDb = db;
    return db;
  }


  console.log("[DB] Turso not configured, using local SQLite at", DB_PATH);
  const raw = createRawBetterSqlite3(DB_PATH);
  raw.exec(SCHEMA_SQL);
  migrateBetterSqlite3(raw);
  const db = wrapBetterSqlite3(raw);
  global.__crmDb = db;
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}
