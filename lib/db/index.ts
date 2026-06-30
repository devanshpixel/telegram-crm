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

// WARNING: /tmp is ephemeral on Vercel — data is lost on every cold start.
// Always set TURSO_DB_URL + TURSO_DB_TOKEN in production to get persistent storage.
// The app will throw at startup if neither is configured in a production build so
// the problem surfaces immediately rather than silently losing data.
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
  if (!columnExists(database, "contacts", "is_bot")) {
    database.exec("ALTER TABLE contacts ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0");
  }
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
  if (!columnExists(database, "contacts", "locked_response_count")) {
    database.exec("ALTER TABLE contacts ADD COLUMN locked_response_count INTEGER NOT NULL DEFAULT 0");
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
  if (!columnExists(database, "purchases", "payment_id")) {
    database.exec("ALTER TABLE purchases ADD COLUMN payment_id TEXT");
  }
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_payment_id ON purchases(payment_id) WHERE payment_id IS NOT NULL");
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

  if (process.env.NODE_ENV === "production" && !isTursoConfigured()) {
    throw new Error(
      "FATAL: TURSO_DB_URL is not set. Vercel /tmp is ephemeral — " +
      "data will be lost on every cold start. Set TURSO_DB_URL and TURSO_DB_TOKEN " +
      "in the Vercel dashboard before running in production.",
    );
  }

  if (isTursoConfigured()) {
    const tursoUrl = process.env.TURSO_DB_URL!;
    const tursoToken = process.env.TURSO_DB_TOKEN;
    const db = createTursoAsync(tursoUrl, tursoToken);
    try {
      // Check if schema already exists to avoid redundant execution
      const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contacts', 'settings')").all();
      if (tables.length < 2) {
        await db.exec(SCHEMA_SQL);
      }
      // Always ensure telegram tables exist (added after initial schema deployment)
      await db.exec(`
        CREATE TABLE IF NOT EXISTS telegram_sessions (
          id INTEGER PRIMARY KEY,
          session_string TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS telegram_pending_codes (
          phone TEXT PRIMARY KEY,
          phone_code_hash TEXT NOT NULL,
          temp_session TEXT,
          created_at TEXT NOT NULL
        );
      `);
      // Migrate missing columns — each ALTER TABLE is isolated so a "duplicate column"
      // error on an already-migrated DB doesn't abort the rest.
      // Add payment_id column to purchases for atomic idempotency
      try {
        await db.exec("ALTER TABLE purchases ADD COLUMN payment_id TEXT");
      } catch { /* already exists */ }
      // UNIQUE index on payment_id — NULLs don't conflict, so legacy rows are fine
      await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_payment_id ON purchases(payment_id) WHERE payment_id IS NOT NULL");

      const contactColMigrations: [string, string][] = [
        ["spend_segment",              "TEXT NOT NULL DEFAULT 'prospect'"],
        ["emotional_temp",             "REAL DEFAULT 50"],
        ["relationship_score",         "INTEGER DEFAULT 0"],
        ["offer_declined_count",       "INTEGER DEFAULT 0"],
        ["offer_cooldown_until",       "TEXT"],
        ["paid_at",                    "TEXT"],
        ["post_purchase_welcome_sent", "INTEGER DEFAULT 0"],
        ["last_upsell_at",             "TEXT"],
        ["upsell_count",               "INTEGER DEFAULT 0"],
        ["lead_classification",        "TEXT DEFAULT 'warm'"],
        ["purchase_probability",       "INTEGER DEFAULT 0"],
        ["churn_risk",                 "INTEGER DEFAULT 0"],
        ["conversation_health",        "INTEGER DEFAULT 50"],
        ["lifetime_spend_score",       "INTEGER DEFAULT 0"],
        ["last_objection",             "TEXT"],
        ["last_successful_offer",      "REAL"],
        ["ai_conversation_summary",    "TEXT"],
        ["suggested_next_action",      "TEXT"],
        ["favorite_content_type",      "TEXT DEFAULT ''"],
        ["contact_health",             "INTEGER DEFAULT 50"],
        ["is_bot",                     "INTEGER DEFAULT 0"],
      ];
      for (const [col, def] of contactColMigrations) {
        try {
          await db.exec(`ALTER TABLE contacts ADD COLUMN ${col} ${def}`);
        } catch { /* column already exists — ignore */ }
      }
      try {
        await db.exec("ALTER TABLE telegram_pending_codes ADD COLUMN temp_session TEXT");
      } catch { /* already exists */ }
      // Backfill default values for existing rows (columns now guaranteed to exist)
      await db.exec(`
        UPDATE contacts SET spend_segment = 'prospect' WHERE spend_segment IS NULL;
        UPDATE contacts SET emotional_temp = 50 WHERE emotional_temp IS NULL;
        UPDATE contacts SET relationship_score = 0 WHERE relationship_score IS NULL;
        UPDATE contacts SET offer_declined_count = 0 WHERE offer_declined_count IS NULL;
        UPDATE contacts SET post_purchase_welcome_sent = 0 WHERE post_purchase_welcome_sent IS NULL;
        UPDATE contacts SET upsell_count = 0 WHERE upsell_count IS NULL;
        UPDATE contacts SET lead_classification = 'warm' WHERE lead_classification IS NULL;
        UPDATE contacts SET purchase_probability = 0 WHERE purchase_probability IS NULL;
        UPDATE contacts SET churn_risk = 0 WHERE churn_risk IS NULL;
        UPDATE contacts SET conversation_health = 50 WHERE conversation_health IS NULL;
        UPDATE contacts SET lifetime_spend_score = 0 WHERE lifetime_spend_score IS NULL;
        UPDATE contacts SET contact_health = 50 WHERE contact_health IS NULL;
        UPDATE contacts SET favorite_content_type = '' WHERE favorite_content_type IS NULL;
      `);
    } catch (e: unknown) {
      console.error("[DB] Turso init failed:", e instanceof Error ? e.message : String(e));
    }
    global.__crmDb = db;
    return db;
  }

  const raw = createRawBetterSqlite3(DB_PATH);
  try {
    raw.exec(SCHEMA_SQL);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // SQLite doesn't support IF NOT EXISTS for ADD COLUMN — duplicate column errors
    // are expected on established databases and are safe to ignore.
    if (!msg.includes("duplicate column name")) {
      console.warn("[DB] Schema init:", msg);
    }
  }
  // Backfill ALTER TABLE default values for existing rows
  raw.exec(`
    UPDATE contacts SET spend_segment = 'prospect' WHERE spend_segment IS NULL;
    UPDATE contacts SET emotional_temp = 50 WHERE emotional_temp IS NULL;
    UPDATE contacts SET relationship_score = 0 WHERE relationship_score IS NULL;
    UPDATE contacts SET offer_declined_count = 0 WHERE offer_declined_count IS NULL;
    UPDATE contacts SET post_purchase_welcome_sent = 0 WHERE post_purchase_welcome_sent IS NULL;
    UPDATE contacts SET upsell_count = 0 WHERE upsell_count IS NULL;
    UPDATE contacts SET lead_classification = 'warm' WHERE lead_classification IS NULL;
    UPDATE contacts SET purchase_probability = 0 WHERE purchase_probability IS NULL;
    UPDATE contacts SET churn_risk = 0 WHERE churn_risk IS NULL;
    UPDATE contacts SET conversation_health = 50 WHERE conversation_health IS NULL;
    UPDATE contacts SET lifetime_spend_score = 0 WHERE lifetime_spend_score IS NULL;
    UPDATE contacts SET contact_health = 50 WHERE contact_health IS NULL;
    UPDATE contacts SET favorite_content_type = '' WHERE favorite_content_type IS NULL;
  `);
  migrateBetterSqlite3(raw);
  const db = wrapBetterSqlite3(raw);
  global.__crmDb = db;
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}
