import type {
  Chat,
  ContactProfile,
  DashboardStats,
  Message,
  MessageDirection,
} from "@/types";
import { getDb, nowIso } from "./index";
import {
  initialsFromName,
  mapChatRow,
  mapContactToProfile,
  mapDashboardStats,
  mapMessageRow,
} from "./mappers";
import type { ChatListRow, ContactRow } from "./types";

const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-indigo-500 to-violet-600",
  "from-fuchsia-500 to-purple-600",
];

function getTagsForContact(contactId: number): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT name FROM tags WHERE contact_id = ? ORDER BY name ASC")
    .all(contactId) as { name: string }[];
  return rows.map((r) => r.name);
}

function getNotesText(contactId: number): string {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT content FROM notes WHERE contact_id = ? ORDER BY updated_at DESC",
    )
    .all(contactId) as { content: string }[];
  return rows.map((r) => r.content).join("\n\n");
}

function getContactById(id: number): ContactRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as
    | ContactRow
    | undefined;
}

function listChatRows(): ChatListRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.*, conv.id AS conversation_id, conv.last_message, conv.last_message_time,
              conv.unread_count, conv.is_pinned
       FROM contacts c
       INNER JOIN conversations conv ON conv.contact_id = c.id
       ORDER BY conv.is_pinned DESC, conv.last_message_time DESC`,
    )
    .all() as ChatListRow[];
}

export function listChats(): Chat[] {
  return listChatRows().map((row) => mapChatRow(row, getTagsForContact(row.id)));
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const totalChats = (
    db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number }
  ).count;
  const onlineCount = (
    db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE is_online = 1")
      .get() as { count: number }
  ).count;
  const totalRevenue = (
    db.prepare("SELECT COALESCE(SUM(revenue), 0) AS total FROM contacts").get() as {
      total: number;
    }
  ).total;
  const unreadTotal = (
    db
      .prepare("SELECT COALESCE(SUM(unread_count), 0) AS total FROM conversations")
      .get() as { total: number }
  ).total;

  return mapDashboardStats(totalChats, onlineCount, totalRevenue, unreadTotal);
}

export function getContactProfile(contactId: number): ContactProfile | null {
  const contact = getContactById(contactId);
  if (!contact) return null;
  return mapContactToProfile(
    contact,
    getTagsForContact(contactId),
    getNotesText(contactId),
  );
}

export function getConversationIdByContactId(
  contactId: number,
): number | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM conversations WHERE contact_id = ?")
    .get(contactId) as { id: number } | undefined;
  return row?.id ?? null;
}

export function getMessagesByContactId(contactId: number): Message[] {
  const conversationId = getConversationIdByContactId(contactId);
  if (!conversationId) return [];

  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    )
    .all(conversationId);
  return (rows as import("./types").MessageRow[]).map(mapMessageRow);
}

export interface CreateContactInput {
  name: string;
  username: string;
  phone?: string;
  email?: string;
  company?: string;
  location?: string;
  revenue?: number;
  isOnline?: boolean;
  telegramId?: string | null;
  telegramAccessHash?: string | null;
}

export function createContact(input: CreateContactInput): ContactProfile {
  const db = getDb();
  const ts = nowIso();
  const username = input.username.startsWith("@")
    ? input.username
    : `@${input.username}`;
  const avatar = initialsFromName(input.name);
  const colorIndex =
    (db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as {
      count: number;
    }).count % AVATAR_COLORS.length;

  const result = db
    .prepare(
      `INSERT INTO contacts (
        name, username, avatar, avatar_color, phone, email, company, location,
        joined_at, revenue, revenue_trend, lead_score, lead_status, is_online,
        ppv_count, telegram_id, telegram_access_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'flat', 50, 'warm', ?, 0, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      username,
      avatar,
      AVATAR_COLORS[colorIndex],
      input.phone ?? "",
      input.email ?? "",
      input.company ?? "",
      input.location ?? "",
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      input.revenue ?? 0,
      input.isOnline ? 1 : 0,
      input.telegramId ?? null,
      input.telegramAccessHash ?? null,
      ts,
      ts,
    );

  const contactId = Number(result.lastInsertRowid);

  db.prepare(
    `INSERT INTO conversations (
      contact_id, last_message, last_message_time, unread_count, is_pinned,
      created_at, updated_at
    ) VALUES (?, '', ?, 0, 0, ?, ?)`,
  ).run(contactId, ts, ts, ts);

  const profile = getContactProfile(contactId);
  if (!profile) throw new Error("Failed to create contact");
  return profile;
}

export interface UpdateContactInput {
  name?: string;
  username?: string;
  phone?: string;
  email?: string;
  company?: string;
  location?: string;
  revenue?: number;
  revenueTrend?: string;
  leadScore?: number;
  leadStatus?: string;
  isOnline?: boolean;
  ppvCount?: number;
  telegramId?: string | null;
  telegramAccessHash?: string | null;
}

export function updateContact(
  contactId: number,
  input: UpdateContactInput,
): ContactProfile | null {
  const existing = getContactById(contactId);
  if (!existing) return null;

  const db = getDb();
  const ts = nowIso();

  db.prepare(
    `UPDATE contacts SET
      name = COALESCE(?, name),
      username = COALESCE(?, username),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      company = COALESCE(?, company),
      location = COALESCE(?, location),
      revenue = COALESCE(?, revenue),
      revenue_trend = COALESCE(?, revenue_trend),
      lead_score = COALESCE(?, lead_score),
      lead_status = COALESCE(?, lead_status),
      is_online = COALESCE(?, is_online),
      ppv_count = COALESCE(?, ppv_count),
      telegram_id = COALESCE(?, telegram_id),
      telegram_access_hash = COALESCE(?, telegram_access_hash),
      updated_at = ?
    WHERE id = ?`,
  ).run(
    input.name ?? null,
    input.username
      ? input.username.startsWith("@")
        ? input.username
        : `@${input.username}`
      : null,
    input.phone ?? null,
    input.email ?? null,
    input.company ?? null,
    input.location ?? null,
    input.revenue ?? null,
    input.revenueTrend ?? null,
    input.leadScore ?? null,
    input.leadStatus ?? null,
    input.isOnline !== undefined ? (input.isOnline ? 1 : 0) : null,
    input.ppvCount ?? null,
    input.telegramId ?? null,
    input.telegramAccessHash ?? null,
    ts,
    contactId,
  );

  if (input.name) {
    db.prepare("UPDATE contacts SET avatar = ? WHERE id = ?").run(
      initialsFromName(input.name),
      contactId,
    );
  }

  return getContactProfile(contactId);
}

export function deleteContact(contactId: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM contacts WHERE id = ?").run(contactId);
  return result.changes > 0;
}

export function addNote(contactId: number, content: string) {
  const db = getDb();
  const ts = nowIso();
  const result = db
    .prepare(
      "INSERT INTO notes (contact_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .run(contactId, content.trim(), ts, ts);

  return {
    id: Number(result.lastInsertRowid),
    contactId,
    content: content.trim(),
    createdAt: ts,
    updatedAt: ts,
  };
}

export function addTag(contactId: number, name: string) {
  const db = getDb();
  const ts = nowIso();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name is required");

  try {
    const result = db
      .prepare(
        "INSERT INTO tags (contact_id, name, created_at) VALUES (?, ?, ?)",
      )
      .run(contactId, trimmed, ts);
    return {
      id: Number(result.lastInsertRowid),
      contactId,
      name: trimmed,
    };
  } catch {
    throw new Error("Tag already exists for this contact");
  }
}

export function deleteTag(contactId: number, name: string): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM tags WHERE contact_id = ? AND name = ?")
    .run(contactId, name.trim());
  return result.changes > 0;
}

export function createMessage(
  contactId: number,
  text: string,
  direction: MessageDirection = "outgoing",
  telegramMessageId?: number | null,
): Message | null {
  const conversationId = getConversationIdByContactId(contactId);
  if (!conversationId) return null;

  const db = getDb();
  const ts = nowIso();
  const isRead = direction === "outgoing" ? 1 : 0;

  const result = db
    .prepare(
      `INSERT INTO messages (conversation_id, text, direction, is_read, telegram_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      conversationId,
      text.trim(),
      direction,
      isRead,
      telegramMessageId ?? null,
      ts,
    );

  db.prepare(
    `UPDATE conversations SET
      last_message = ?,
      last_message_time = ?,
      unread_count = CASE WHEN ? = 'incoming' THEN unread_count + 1 ELSE unread_count END,
      updated_at = ?
    WHERE id = ?`,
  ).run(text.trim(), ts, direction, ts, conversationId);

  const row = db
    .prepare("SELECT * FROM messages WHERE id = ?")
    .get(result.lastInsertRowid) as import("./types").MessageRow;

  return mapMessageRow(row);
}
