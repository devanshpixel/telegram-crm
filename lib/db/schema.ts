export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  is_read INTEGER NOT NULL DEFAULT 0,
  telegram_message_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  UNIQUE (contact_id, name)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS telegram_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_string TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  purchase_date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'ppv',
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tag_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  tag_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('added', 'removed')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tags_contact ON tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_notes_contact ON notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_purchases_contact ON purchases(contact_id);
CREATE INDEX IF NOT EXISTS idx_purchases_contact_kind ON purchases(contact_id, kind);
CREATE INDEX IF NOT EXISTS idx_tag_events_contact ON tag_events(contact_id);
`;
