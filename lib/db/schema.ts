export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  joined_at TEXT NOT NULL,
  revenue REAL NOT NULL DEFAULT 0,
  revenue_trend TEXT NOT NULL DEFAULT 'flat',
  lead_score INTEGER NOT NULL DEFAULT 50,
  lead_status TEXT NOT NULL DEFAULT 'warm',
  is_online INTEGER NOT NULL DEFAULT 0,
  ppv_count INTEGER NOT NULL DEFAULT 0,
  telegram_id TEXT UNIQUE,
  telegram_access_hash TEXT,
  total_spent REAL NOT NULL DEFAULT 0,
  vip_level TEXT NOT NULL DEFAULT 'none',
  fan_status TEXT NOT NULL DEFAULT 'active',
  fan_score INTEGER NOT NULL DEFAULT 0,
  last_purchase_date TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  offer_sent INTEGER NOT NULL DEFAULT 0,
  conv_state TEXT NOT NULL DEFAULT 'FREE_CHAT',
  offer_sent_at TEXT,
  last_locked_response_at TEXT,
  locked_response_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL UNIQUE,
  last_message TEXT NOT NULL DEFAULT '',
  last_message_time TEXT NOT NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  last_synced_message_id INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  is_read INTEGER NOT NULL DEFAULT 0,
  telegram_message_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  UNIQUE (contact_id, name)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS telegram_sessions (
  id INTEGER PRIMARY KEY,
  session_string TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  purchase_date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'ppv',
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tag_events (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  tag_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('added', 'removed')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  trigger TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_pending_codes (
  phone TEXT PRIMARY KEY,
  phone_code_hash TEXT NOT NULL,
  temp_session TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tags_contact ON tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_notes_contact ON notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_purchases_contact ON purchases(contact_id);
CREATE INDEX IF NOT EXISTS idx_purchases_contact_kind ON purchases(contact_id, kind);
CREATE INDEX IF NOT EXISTS idx_media_contact ON media(contact_id);
CREATE INDEX IF NOT EXISTS idx_tag_events_contact ON tag_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at);
CREATE INDEX IF NOT EXISTS idx_broadcasts_trigger_created_at ON broadcasts(trigger, created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_last_purchase_date ON contacts(last_purchase_date);

-- V2 columns (safe to re-run; IF NOT EXISTS handled by try-catch in migration)
ALTER TABLE contacts ADD COLUMN emotional_temp REAL DEFAULT 50;
ALTER TABLE contacts ADD COLUMN relationship_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN offer_declined_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN offer_cooldown_until TEXT;
ALTER TABLE contacts ADD COLUMN paid_at TEXT;
ALTER TABLE contacts ADD COLUMN post_purchase_welcome_sent INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN last_upsell_at TEXT;
ALTER TABLE contacts ADD COLUMN upsell_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN spend_segment TEXT DEFAULT 'prospect';
ALTER TABLE contacts ADD COLUMN lead_classification TEXT DEFAULT 'warm';
ALTER TABLE contacts ADD COLUMN purchase_probability INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN churn_risk INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN conversation_health INTEGER DEFAULT 50;
ALTER TABLE contacts ADD COLUMN lifetime_spend_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN last_objection TEXT;
ALTER TABLE contacts ADD COLUMN last_successful_offer REAL;
ALTER TABLE contacts ADD COLUMN ai_conversation_summary TEXT;
ALTER TABLE contacts ADD COLUMN suggested_next_action TEXT;
ALTER TABLE contacts ADD COLUMN favorite_content_type TEXT DEFAULT '';
ALTER TABLE contacts ADD COLUMN contact_health INTEGER DEFAULT 50;

CREATE TABLE IF NOT EXISTS failed_actions (
  id INTEGER PRIMARY KEY,
  action_type TEXT NOT NULL,
  contact_id INTEGER NOT NULL,
  payload TEXT,
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  last_retry_at TEXT,
  resolved_at TEXT,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_failed_actions_unresolved ON failed_actions(resolved_at) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS scheduled_replies (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  message_text TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduled_replies_due ON scheduled_replies(sent, scheduled_at);
`;