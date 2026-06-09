import type {
  ActiveContact,
  AnalyticsData,
  Broadcast,
  CampaignAnalyticsSummary,
  BroadcastFilters,
  Chat,
  ContactProfile,
  DashboardStats,
  FanScoreStats,
  FanStatusBreakdown,
  FollowUpData,
  FollowUpList,
  FollowUpListItem,
  InactiveContact,
  Media,
  Message,
  MessageDirection,
  MonthlyRevenue,
  PpvStats,
  Purchase,
  RecentPurchaser,
  RetentionData,
  RevenueData,
  TimelineEvent,
  TopSpender,
  VipLevelBreakdown,
} from "@/types";
import fs from "fs";
import path from "path";
import { getDb, nowIso } from "./index";
import {
  initialsFromName,
  mapChatRow,
  mapContactToProfile,
  mapDashboardStats,
  mapMediaRow,
  mapMessageRow,
  mapPurchaseRow,
} from "./mappers";
import type { BroadcastRow, ChatListRow, ContactRow, MediaRow } from "./types";

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

export function getContactByTelegramId(
  telegramId: string,
): ContactRow | undefined {
  return getDb()
    .prepare("SELECT * FROM contacts WHERE telegram_id = ?")
    .get(telegramId) as ContactRow | undefined;
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
  return {
    ...mapContactToProfile(
      contact,
      getTagsForContact(contactId),
      getNotesText(contactId),
    ),
    purchases: getPurchasesByContact(contactId),
  };
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
  const ts = nowIso();

  const markRead = db.transaction(() => {
    db.prepare(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND direction = 'incoming' AND is_read = 0",
    ).run(conversationId);
    db.prepare(
      "UPDATE conversations SET unread_count = 0, updated_at = ? WHERE id = ?",
    ).run(ts, conversationId);
  });
  markRead();

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
  totalSpent?: number;
  vipLevel?: string;
  fanStatus?: string;
  fanScore?: number;
  lastPurchaseDate?: string | null;
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

  const insertContactAndConversation = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO contacts (
          name, username, avatar, avatar_color, phone, email, company, location,
          joined_at, revenue, revenue_trend, lead_score, lead_status, is_online,
          ppv_count, telegram_id, telegram_access_hash, total_spent, vip_level,
          fan_status, fan_score, last_purchase_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'flat', 50, 'warm', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        input.totalSpent ?? 0,
        input.vipLevel ?? "none",
        input.fanStatus ?? "active",
        input.fanScore ?? 0,
        input.lastPurchaseDate ?? null,
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

    return contactId;
  });

  const contactId = insertContactAndConversation();

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
  totalSpent?: number;
  vipLevel?: string;
  fanStatus?: string;
  fanScore?: number;
  lastPurchaseDate?: string | null;
}

export function updateContact(
  contactId: number,
  input: UpdateContactInput,
): ContactProfile | null {
  const existing = getContactById(contactId);
  if (!existing) return null;

  const db = getDb();
  const ts = nowIso();

  const updateFieldsAndAvatar = db.transaction(() => {
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
        total_spent = COALESCE(?, total_spent),
        vip_level = COALESCE(?, vip_level),
        fan_status = COALESCE(?, fan_status),
        fan_score = COALESCE(?, fan_score),
        last_purchase_date = COALESCE(?, last_purchase_date),
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
      input.totalSpent ?? null,
      input.vipLevel ?? null,
      input.fanStatus ?? null,
      input.fanScore ?? null,
      input.lastPurchaseDate ?? null,
      ts,
      contactId,
    );

    if (input.name) {
      db.prepare("UPDATE contacts SET avatar = ? WHERE id = ?").run(
        initialsFromName(input.name),
        contactId,
      );
    }
  });

  updateFieldsAndAvatar();

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
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name is required");
  const ts = nowIso();

  const insertTagAndEvent = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO tags (contact_id, name, created_at) VALUES (?, ?, ?)",
      )
      .run(contactId, trimmed, ts);
    db.prepare(
      "INSERT INTO tag_events (contact_id, tag_name, event_type, created_at) VALUES (?, ?, 'added', ?)",
    ).run(contactId, trimmed, ts);
    return {
      id: Number(result.lastInsertRowid),
      contactId,
      name: trimmed,
    };
  });

  try {
    return insertTagAndEvent();
  } catch {
    throw new Error("Tag already exists for this contact");
  }
}

export function deleteTag(contactId: number, name: string): boolean {
  const db = getDb();
  const trimmed = name.trim();
  const ts = nowIso();

  const deleteAndRecord = db.transaction(() => {
    const result = db
      .prepare("DELETE FROM tags WHERE contact_id = ? AND name = ?")
      .run(contactId, trimmed);
    if (result.changes === 0) return 0;
    db.prepare(
      "INSERT INTO tag_events (contact_id, tag_name, event_type, created_at) VALUES (?, ?, 'removed', ?)",
    ).run(contactId, trimmed, ts);
    db.prepare("UPDATE contacts SET updated_at = ? WHERE id = ?").run(ts, contactId);
    return result.changes;
  });

  return deleteAndRecord() > 0;
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

  const insertAndUpdateConversation = db.transaction(() => {
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

    return db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(result.lastInsertRowid) as import("./types").MessageRow;
  });

  const row = insertAndUpdateConversation();
  return mapMessageRow(row);
}

export interface CreatePurchaseInput {
  contactId: number;
  amount: number;
  purchaseDate: string;
  note?: string;
  kind?: string;
}

export function createPurchase(input: CreatePurchaseInput): Purchase {
  const db = getDb();
  const ts = nowIso();
  const kind = input.kind ?? "ppv";
  const contact = db.prepare("SELECT id FROM contacts WHERE id = ?").get(input.contactId) as { id: number } | undefined;
  if (!contact) throw new Error("Contact not found");

  const insertAndUpdateStats = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO purchases (contact_id, amount, purchase_date, note, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(input.contactId, input.amount, input.purchaseDate, input.note ?? "", kind, ts);

    const updateParts = [
      "total_spent = total_spent + ?",
      "revenue = revenue + ?",
      "last_purchase_date = MAX(COALESCE(last_purchase_date, ''), ?)",
      "updated_at = ?",
    ];
    const updateArgs: (string | number)[] = [input.amount, input.amount, input.purchaseDate, ts];
    if (kind === "ppv") {
      updateParts.push("ppv_count = ppv_count + 1");
    }
    db.prepare(
      `UPDATE contacts SET ${updateParts.join(", ")} WHERE id = ?`,
    ).run(...updateArgs, input.contactId);

    return db.prepare("SELECT * FROM purchases WHERE id = ?").get(result.lastInsertRowid) as import("./types").PurchaseRow;
  });

  const row = insertAndUpdateStats();
  return mapPurchaseRow(row);
}

export function getPurchasesByContact(contactId: number): Purchase[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM purchases WHERE contact_id = ? ORDER BY purchase_date DESC",
    )
    .all(contactId) as import("./types").PurchaseRow[];
  return rows.map(mapPurchaseRow);
}

export function getMonthlyRevenue(months: number = 12): MonthlyRevenue[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         strftime('%Y-%m', purchase_date) AS month,
         COALESCE(SUM(amount), 0) AS total,
         COUNT(*) AS count
       FROM purchases
       WHERE purchase_date >= date('now', ?)
       GROUP BY strftime('%Y-%m', purchase_date)
       ORDER BY month DESC`,
    )
    .all(`-${months} months`) as { month: string; total: number; count: number }[];
  return rows;
}

export function getTopSpenders(limit: number = 10): TopSpender[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         c.id,
         c.name,
         c.username,
         c.avatar,
         c.avatar_color,
         c.total_spent,
         (SELECT COUNT(*) FROM purchases p WHERE p.contact_id = c.id) AS purchase_count
       FROM contacts c
       WHERE c.total_spent > 0
       ORDER BY c.total_spent DESC
       LIMIT ?`,
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      total_spent: number;
      purchase_count: number;
    }[];
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    totalSpent: row.total_spent,
    purchaseCount: row.purchase_count,
  }));
}

export function getRevenueData(months: number = 12, limit: number = 10): RevenueData {
  return {
    monthly: getMonthlyRevenue(months),
    topSpenders: getTopSpenders(limit),
  };
}

export function getPpvStats(limit: number = 10): PpvStats {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(amount), 0) AS totalRevenue,
         COUNT(*) AS purchaseCount,
         COUNT(DISTINCT contact_id) AS uniqueBuyers
       FROM purchases
       WHERE kind = 'ppv'`,
    )
    .get() as { totalRevenue: number; purchaseCount: number; uniqueBuyers: number };
  const topBuyers = db
    .prepare(
      `SELECT
         c.id,
         c.name,
         c.username,
         c.avatar,
         c.avatar_color,
         c.total_spent,
         (SELECT COUNT(*) FROM purchases p WHERE p.contact_id = c.id AND p.kind = 'ppv') AS purchase_count
       FROM contacts c
       WHERE EXISTS (SELECT 1 FROM purchases p WHERE p.contact_id = c.id AND p.kind = 'ppv')
       ORDER BY c.total_spent DESC
       LIMIT ?`,
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      total_spent: number;
      purchase_count: number;
    }[];
  return {
    totalRevenue: totals.totalRevenue,
    purchaseCount: totals.purchaseCount,
    uniqueBuyers: totals.uniqueBuyers,
    topBuyers: topBuyers.map((row) => ({
      id: String(row.id),
      name: row.name,
      username: row.username,
      avatar: row.avatar,
      avatarColor: row.avatar_color,
      totalSpent: row.total_spent,
      purchaseCount: row.purchase_count,
    })),
  };
}

export interface BroadcastRecipient {
  id: number;
  name: string;
  username: string;
}

function mapBroadcastRow(row: BroadcastRow): Broadcast {
  return {
    id: String(row.id),
    name: row.name,
    message: row.message,
    recipientCount: row.recipient_count,
    sentCount: row.sent_count,
    trigger: row.trigger as Broadcast["trigger"],
    createdAt: row.created_at,
  };
}

function normalizeBroadcastFilters(filters: BroadcastFilters = {}): BroadcastFilters {
  return {
    tags: (filters.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, tags) => tags.indexOf(tag) === index),
    vipLevel: filters.vipLevel,
    fanStatus: filters.fanStatus,
    minTotalSpent: filters.minTotalSpent,
    minFanScore: filters.minFanScore,
  };
}

function buildBroadcastAudienceWhere(filters: BroadcastFilters): {
  where: string[];
  args: (number | string)[];
} {
  const normalized = normalizeBroadcastFilters(filters);
  const where = [
    "c.telegram_id IS NOT NULL",
    "c.telegram_access_hash IS NOT NULL",
  ];
  const args: (number | string)[] = [];

  if (normalized.tags?.length) {
    where.push(
      `EXISTS (
        SELECT 1 FROM tags t
        WHERE t.contact_id = c.id AND t.name IN (${normalized.tags.map(() => "?").join(", ")})
      )`,
    );
    args.push(...normalized.tags);
  }
  if (normalized.vipLevel) {
    where.push("c.vip_level = ?");
    args.push(normalized.vipLevel);
  }
  if (normalized.fanStatus) {
    where.push("c.fan_status = ?");
    args.push(normalized.fanStatus);
  }
  if (normalized.minTotalSpent !== undefined) {
    where.push("c.total_spent >= ?");
    args.push(normalized.minTotalSpent);
  }
  if (normalized.minFanScore !== undefined) {
    where.push("c.fan_score >= ?");
    args.push(normalized.minFanScore);
  }

  return { where, args };
}

export function getBroadcastAudienceCount(filters: BroadcastFilters): number {
  const db = getDb();
  const { where, args } = buildBroadcastAudienceWhere(filters);
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT c.id) AS count
       FROM contacts c
       WHERE ${where.join(" AND ")}`,
    )
    .get(...args) as { count: number };
  return row.count;
}

export function getBroadcastRecipients(filters: BroadcastFilters): BroadcastRecipient[] {
  const db = getDb();
  const { where, args } = buildBroadcastAudienceWhere(filters);
  return db
    .prepare(
      `SELECT DISTINCT c.id, c.name, c.username
       FROM contacts c
       WHERE ${where.join(" AND ")}
       ORDER BY c.total_spent DESC, c.updated_at DESC`,
    )
    .all(...args) as BroadcastRecipient[];
}

export function listBroadcasts(limit: number = 20): Broadcast[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT ?")
    .all(limit) as BroadcastRow[];
  return rows.map(mapBroadcastRow);
}

const AUDIENCE_LIMIT = 1000;

function audienceToRecipients(items: FollowUpListItem[]): BroadcastRecipient[] {
  return items.map((item) => ({
    id: Number(item.id),
    name: item.name,
    username: item.username,
  }));
}

export function getFollowUpAudience(
  segmentKey: string,
  limit: number = AUDIENCE_LIMIT,
): BroadcastRecipient[] {
  const capped = Math.min(limit, AUDIENCE_LIMIT);
  switch (segmentKey) {
    case "no_message_7d":
      return audienceToRecipients(getFollowUpNoMessageInDays(7, capped));
    case "no_purchase_30d":
      return audienceToRecipients(getFollowUpNoPurchaseInDays(30, capped));
    case "vip_inactive_14d":
      return audienceToRecipients(
        getFollowUpVipInactive(["gold", "platinum", "silver"], 14, capped),
      );
    case "high_spender_inactive":
      return audienceToRecipients(
        getFollowUpHighSpenderInactive(200, 30, capped),
      );
    case "no_ppv_30d":
      return audienceToRecipients(getFollowUpNoPpvInDays(30, capped));
    case "never_purchased":
      return audienceToRecipients(getFollowUpNeverPurchased(capped));
    default:
      return [];
  }
}

export function getFollowUpAudienceCount(segmentKey: string): number {
  const db = getDb();
  switch (segmentKey) {
    case "no_message_7d":
      return (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM (
              SELECT c.id
              FROM contacts c
              INNER JOIN conversations conv ON conv.contact_id = c.id
              LEFT JOIN messages m ON m.conversation_id = conv.id
              GROUP BY c.id
              HAVING MAX(m.created_at) IS NOT NULL
                AND MAX(m.created_at) < date('now', '-7 days')
            )`,
          )
          .get() as { count: number }
      ).count;
    case "no_purchase_30d":
      return (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM contacts
             WHERE last_purchase_date IS NOT NULL
               AND last_purchase_date < date('now', '-30 days')`,
          )
          .get() as { count: number }
      ).count;
    case "vip_inactive_14d":
      return (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM contacts
             WHERE vip_level IN ('gold', 'platinum', 'silver')
               AND updated_at < date('now', '-14 days')`,
          )
          .get() as { count: number }
      ).count;
    case "high_spender_inactive":
      return (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM contacts
             WHERE total_spent >= 200
               AND (last_purchase_date IS NULL OR last_purchase_date < date('now', '-30 days'))
               AND updated_at < date('now', '-30 days')`,
          )
          .get() as { count: number }
      ).count;
    case "no_ppv_30d":
      return (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM (
              SELECT c.id
              FROM contacts c
              INNER JOIN purchases p ON p.contact_id = c.id
              WHERE p.kind = 'ppv'
              GROUP BY c.id
              HAVING MAX(p.purchase_date) < date('now', '-30 days')
            )`,
          )
          .get() as { count: number }
      ).count;
    case "never_purchased":
      return (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM contacts c
             LEFT JOIN purchases p ON p.contact_id = c.id
             WHERE p.id IS NULL`,
          )
          .get() as { count: number }
      ).count;
    default:
      return 0;
  }
}

export function createBroadcastHistory(input: {
  name: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  trigger?: string | null;
}): Broadcast {
  const db = getDb();
  const ts = nowIso();
  const result = db
    .prepare(
      `INSERT INTO broadcasts (name, message, recipient_count, sent_count, trigger, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name.trim(),
      input.message.trim(),
      input.recipientCount,
      input.sentCount,
      input.trigger ?? null,
      ts,
    );
  const row = db
    .prepare("SELECT * FROM broadcasts WHERE id = ?")
    .get(result.lastInsertRowid) as BroadcastRow;
  return mapBroadcastRow(row);
}

function getOverview(): AnalyticsData["overview"] {
  const db = getDb();
  const totalFans = (
    db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number }
  ).count;
  const activeFans = (
    db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE fan_status = 'active'")
      .get() as { count: number }
  ).count;
  const vipFans = (
    db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE vip_level != 'none'")
      .get() as { count: number }
  ).count;
  const totalRevenue = (
    db.prepare("SELECT COALESCE(SUM(revenue), 0) AS total FROM contacts").get() as {
      total: number;
    }
  ).total;
  const revenueLast30Days = (
    db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM purchases WHERE purchase_date >= date('now', '-30 days')",
      )
      .get() as { total: number }
  ).total;
  const messagesSent = (
    db
      .prepare("SELECT COUNT(*) AS count FROM messages WHERE direction = 'outgoing'")
      .get() as { count: number }
  ).count;
  const messagesReceived = (
    db
      .prepare("SELECT COUNT(*) AS count FROM messages WHERE direction = 'incoming'")
      .get() as { count: number }
  ).count;

  const currentMonth = (
    db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM purchases WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now')",
      )
      .get() as { total: number }
  ).total;
  const previousMonth = (
    db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM purchases WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now', '-1 month')",
      )
      .get() as { total: number }
  ).total;
  const revenueGrowthPercent =
    previousMonth > 0
      ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
      : currentMonth > 0
        ? 100
        : 0;

  return {
    totalFans,
    activeFans,
    vipFans,
    totalRevenue,
    revenueLast30Days,
    messagesSent,
    messagesReceived,
    revenueGrowthPercent,
  };
}

function getFansByVipLevel(): VipLevelBreakdown[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT vip_level AS level, COUNT(*) AS count FROM contacts GROUP BY vip_level ORDER BY count DESC",
    )
    .all() as VipLevelBreakdown[];
}

function getFansByStatus(): FanStatusBreakdown[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT fan_status AS status, COUNT(*) AS count FROM contacts GROUP BY fan_status ORDER BY count DESC",
    )
    .all() as FanStatusBreakdown[];
}

function getFanScoreStats(): FanScoreStats {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(fan_score), 0) AS highest, COALESCE(ROUND(AVG(fan_score), 1), 0) AS average FROM contacts",
    )
    .get() as { highest: number; average: number };
  return row;
}

function getMostActiveContacts(limit: number = 5): ActiveContact[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              COUNT(m.id) AS message_count
       FROM contacts c
       INNER JOIN conversations conv ON conv.contact_id = c.id
       LEFT JOIN messages m ON m.conversation_id = conv.id
       GROUP BY c.id
       ORDER BY message_count DESC
       LIMIT ?`,
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      message_count: number;
    }[];
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    messageCount: row.message_count,
  }));
}

function getInactiveContacts(days: number = 30, limit: number = 10): InactiveContact[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(c.updated_at) AS INTEGER) AS days_since_activity
       FROM contacts c
       WHERE c.updated_at < date('now', ?)
         AND c.is_online = 0
       ORDER BY c.updated_at ASC
       LIMIT ?`,
    )
    .all(`-${days} days`, limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since_activity: number;
    }[];
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    daysSinceActivity: row.days_since_activity,
  }));
}

function getRecentPurchasers(limit: number = 5): RecentPurchaser[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, username, avatar, avatar_color, last_purchase_date, total_spent
       FROM contacts
       WHERE last_purchase_date IS NOT NULL
       ORDER BY last_purchase_date DESC
       LIMIT ?`,
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      last_purchase_date: string;
      total_spent: number;
    }[];
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    lastPurchaseDate: row.last_purchase_date,
    totalSpent: row.total_spent,
  }));
}

export function getAnalytics(): AnalyticsData {
  return {
    overview: getOverview(),
    fansByVipLevel: getFansByVipLevel(),
    fansByStatus: getFansByStatus(),
    fanScores: getFanScoreStats(),
    mostActive: getMostActiveContacts(),
    inactiveContacts: getInactiveContacts(),
    recentPurchasers: getRecentPurchasers(),
    retention: getRetentionData(),
    campaigns: getCampaignAnalyticsSummary(),
  };
}

function getCampaignAnalyticsSummary(): CampaignAnalyticsSummary {
  const db = getDb();
  const totalCampaigns = (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM broadcasts WHERE created_at >= date('now', '-30 days')",
      )
      .get() as { count: number }
  ).count;
  const totalMessagesSent = (
    db
      .prepare(
        "SELECT COALESCE(SUM(sent_count), 0) AS total FROM broadcasts WHERE created_at >= date('now', '-30 days')",
      )
      .get() as { total: number }
  ).total;
  const mostUsedRow = db
    .prepare(
      `SELECT trigger, SUM(sent_count) AS total
       FROM broadcasts
       WHERE trigger IS NOT NULL
         AND created_at >= date('now', '-30 days')
       GROUP BY trigger
       ORDER BY total DESC, trigger ASC
       LIMIT 1`,
    )
    .get() as { trigger: string; total: number } | undefined;
  const mostUsedSegment = mostUsedRow
    ? { trigger: mostUsedRow.trigger, sentCount: mostUsedRow.total }
    : null;
  return {
    totalCampaigns,
    totalMessagesSent,
    mostUsedSegment,
  };
}

function getRetentionOverview(): RetentionData["overview"] {
  const db = getDb();
  const activeFans30d = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT contact_id) AS count FROM purchases WHERE purchase_date >= date('now', '-30 days')",
      )
      .get() as { count: number }
  ).count;
  const newFans30d = (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM contacts WHERE created_at >= date('now', '-30 days')",
      )
      .get() as { count: number }
  ).count;
  const returningBuyers = (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM (SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) > 1)",
      )
      .get() as { count: number }
  ).count;
  const totalBuyers = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT contact_id) AS count FROM purchases",
      )
      .get() as { count: number }
  ).count;
  const churnedBuyers = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT contact_id) AS count FROM purchases
         WHERE contact_id IN (
           SELECT contact_id FROM purchases
           GROUP BY contact_id
           HAVING MAX(purchase_date) < date('now', '-60 days')
         )`,
      )
      .get() as { count: number }
  ).count;
  const repeatBuyerPercent =
    totalBuyers > 0 ? Math.round((returningBuyers / totalBuyers) * 100) : 0;
  return {
    activeFans30d,
    newFans30d,
    returningBuyers,
    churnedBuyers,
    repeatBuyerPercent,
  };
}

function getRetentionAnalytics(): RetentionData["analytics"] {
  const db = getDb();
  const buyersThisMonth = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT contact_id) AS count FROM purchases
         WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now')`,
      )
      .get() as { count: number }
  ).count;
  const buyersLastMonth = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT contact_id) AS count FROM purchases
         WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now', '-1 month')`,
      )
      .get() as { count: number }
  ).count;
  const revenueFromRepeatBuyers = (
    db
      .prepare(
        `SELECT COALESCE(SUM(p.amount), 0) AS total FROM purchases p
         WHERE p.contact_id IN (
           SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) > 1
         )`,
      )
      .get() as { total: number }
  ).total;
  const revenueFromNewBuyers = (
    db
      .prepare(
        `SELECT COALESCE(SUM(p.amount), 0) AS total FROM purchases p
         WHERE p.contact_id IN (
           SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) = 1
         )`,
      )
      .get() as { total: number }
  ).total;
  return {
    buyersThisMonth,
    buyersLastMonth,
    revenueFromRepeatBuyers,
    revenueFromNewBuyers,
  };
}

export function getRetentionData(): RetentionData {
  return {
    overview: getRetentionOverview(),
    analytics: getRetentionAnalytics(),
    segments: getRetentionSegmentCounts(),
  };
}

function getRetentionSegmentCounts(): RetentionData["segments"] {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        SUM(CASE
              WHEN c.last_purchase_date >= date('now', '-30 days') THEN 1
              WHEN c.last_purchase_date IS NULL AND c.created_at >= date('now', '-30 days') THEN 1
              ELSE 0
            END) AS active_count,
        SUM(CASE
              WHEN c.last_purchase_date < date('now', '-30 days')
               AND c.last_purchase_date >= date('now', '-60 days') THEN 1
              ELSE 0
            END) AS at_risk_count,
        SUM(CASE
              WHEN c.last_purchase_date < date('now', '-60 days') THEN 1
              WHEN c.last_purchase_date IS NULL AND c.created_at < date('now', '-30 days') THEN 1
              ELSE 0
            END) AS churned_count
      FROM contacts c`,
    )
    .get() as { active_count: number | null; at_risk_count: number | null; churned_count: number | null };
  return {
    active: row.active_count ?? 0,
    at_risk: row.at_risk_count ?? 0,
    churned: row.churned_count ?? 0,
  };
}

interface TimelineRow {
  id: number;
  type: "message_in" | "message_out" | "purchase" | "note" | "tag_added" | "tag_removed";
  ts: string;
  text: string | null;
  amount: number | null;
}

export function getTimeline(contactId: number, limit: number = 100): TimelineEvent[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, type, ts, text, amount FROM (
        SELECT
          m.id AS id,
          CASE WHEN m.direction = 'incoming' THEN 'message_in' ELSE 'message_out' END AS type,
          m.created_at AS ts,
          m.text AS text,
          NULL AS amount
        FROM messages m
        INNER JOIN conversations conv ON conv.id = m.conversation_id
        WHERE conv.contact_id = ?

        UNION ALL

        SELECT
          p.id AS id,
          'purchase' AS type,
          COALESCE(p.purchase_date, p.created_at) AS ts,
          p.note AS text,
          p.amount AS amount
        FROM purchases p
        WHERE p.contact_id = ?

        UNION ALL

        SELECT
          n.id AS id,
          'note' AS type,
          n.created_at AS ts,
          n.content AS text,
          NULL AS amount
        FROM notes n
        WHERE n.contact_id = ?

        UNION ALL

        SELECT
          te.id AS id,
          CASE WHEN te.event_type = 'added' THEN 'tag_added' ELSE 'tag_removed' END AS type,
          te.created_at AS ts,
          te.tag_name AS text,
          NULL AS amount
        FROM tag_events te
        WHERE te.contact_id = ?
      )
      ORDER BY ts DESC
      LIMIT ?`,
    )
    .all(contactId, contactId, contactId, contactId, limit) as TimelineRow[];

  return rows.map((row) => ({
    id: `${row.type}-${row.id}`,
    type: row.type,
    timestamp: row.ts,
    text: row.text ?? undefined,
    amount: row.amount ?? undefined,
  }));
}

function mapFollowUpRow(row: {
  id: number;
  name: string;
  username: string;
  avatar: string;
  avatar_color: string;
  days_since: number | null;
  hint_value: string | number | null;
}): FollowUpListItem {
  return {
    id: String(row.id),
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    hint:
      row.hint_value !== null && row.hint_value !== undefined
        ? String(row.hint_value)
        : row.days_since !== null
          ? `${row.days_since}d`
          : "—",
  };
}

function getFollowUpNoMessageInDays(days: number, limit: number): FollowUpListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(MAX(m.created_at)) AS INTEGER) AS days_since
       FROM contacts c
       INNER JOIN conversations conv ON conv.contact_id = c.id
       LEFT JOIN messages m ON m.conversation_id = conv.id
       GROUP BY c.id
       HAVING MAX(m.created_at) IS NOT NULL
          AND MAX(m.created_at) < date('now', ?)
       ORDER BY MAX(m.created_at) ASC
       LIMIT ?`,
    )
    .all(`-${days} days`, limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: null }));
}

function getFollowUpNoPurchaseInDays(days: number, limit: number): FollowUpListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, username, avatar, avatar_color,
              CAST(julianday('now') - julianday(last_purchase_date) AS INTEGER) AS days_since
       FROM contacts
       WHERE last_purchase_date IS NOT NULL
         AND last_purchase_date < date('now', ?)
       ORDER BY last_purchase_date ASC
       LIMIT ?`,
    )
    .all(`-${days} days`, limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: null }));
}

function getFollowUpNoPpvInDays(days: number, limit: number): FollowUpListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(MAX(p.purchase_date)) AS INTEGER) AS days_since
       FROM contacts c
       INNER JOIN purchases p ON p.contact_id = c.id
       WHERE p.kind = 'ppv'
       GROUP BY c.id
       HAVING MAX(p.purchase_date) < date('now', ?)
       ORDER BY MAX(p.purchase_date) ASC
       LIMIT ?`,
    )
    .all(`-${days} days`, limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: null }));
}

function getFollowUpVipInactive(vipLevels: string[], days: number, limit: number): FollowUpListItem[] {
  const db = getDb();
  const placeholders = vipLevels.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT id, name, username, avatar, avatar_color,
              CAST(julianday('now') - julianday(updated_at) AS INTEGER) AS days_since
       FROM contacts
       WHERE vip_level IN (${placeholders})
         AND updated_at < date('now', ?)
       ORDER BY updated_at ASC
       LIMIT ?`,
    )
    .all(...vipLevels, `-${days} days`, limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: null }));
}

function getFollowUpHighSpenderInactive(minSpent: number, days: number, limit: number): FollowUpListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, username, avatar, avatar_color, total_spent,
              CAST(julianday('now') - julianday(COALESCE(last_purchase_date, updated_at)) AS INTEGER) AS days_since
       FROM contacts
       WHERE total_spent >= ?
         AND (last_purchase_date IS NULL OR last_purchase_date < date('now', ?))
         AND updated_at < date('now', ?)
       ORDER BY total_spent DESC
       LIMIT ?`,
    )
    .all(minSpent, `-${days} days`, `-${days} days`, limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      total_spent: number;
      days_since: number;
    }[];
  return rows.map((r) =>
    mapFollowUpRow({ ...r, hint_value: `$${r.total_spent.toFixed(0)}` }),
  );
}

function getFollowUpNeverPurchased(limit: number): FollowUpListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color
       FROM contacts c
       LEFT JOIN purchases p ON p.contact_id = c.id
       WHERE p.id IS NULL
       ORDER BY c.created_at DESC
       LIMIT ?`,
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
    }[];
  return rows.map((r) =>
    mapFollowUpRow({ ...r, days_since: null, hint_value: "no purchases" }),
  );
}

export function getFollowUps(limit: number = 10): FollowUpData {
  const lists: FollowUpList[] = [
    {
      key: "no_message_7d",
      title: "No message in 7 days",
      description: "Fans you haven't replied to in a week",
      count: 0,
      items: getFollowUpNoMessageInDays(7, limit),
    },
    {
      key: "no_purchase_30d",
      title: "No purchase in 30 days",
      description: "Previous buyers at risk of churning",
      count: 0,
      items: getFollowUpNoPurchaseInDays(30, limit),
    },
    {
      key: "vip_inactive_14d",
      title: "VIP inactive for 14 days",
      description: "VIP-tier fans who went quiet",
      count: 0,
      items: getFollowUpVipInactive(["gold", "platinum", "silver"], 14, limit),
    },
    {
      key: "high_spender_inactive",
      title: "High spender inactive",
      description: "Top spenders (≥$200) silent for 30+ days",
      count: 0,
      items: getFollowUpHighSpenderInactive(200, 30, limit),
    },
    {
      key: "no_ppv_30d",
      title: "No PPV purchase in 30 days",
      description: "Past PPV buyers who stopped unlocking",
      count: 0,
      items: getFollowUpNoPpvInDays(30, limit),
    },
    {
      key: "never_purchased",
      title: "Never purchased",
      description: "Engaged fans who never bought",
      count: 0,
      items: getFollowUpNeverPurchased(limit),
    },
  ];
  for (const list of lists) {
    list.count = list.items.length;
  }
  return { lists };
}

export interface CreateMediaInput {
  contactId: number;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  price?: number;
}

export function createMedia(input: CreateMediaInput): Media {
  const db = getDb();
  const ts = nowIso();
  const result = db
    .prepare(
      `INSERT INTO media (contact_id, filename, original_name, mime_type, file_size, price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.contactId, input.filename, input.originalName, input.mimeType, input.fileSize, input.price ?? 0, ts);
  const row = db.prepare("SELECT * FROM media WHERE id = ?").get(result.lastInsertRowid) as MediaRow;
  return mapMediaRow(row);
}

export function getMediaById(id: number): Media | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM media WHERE id = ?").get(id) as MediaRow | undefined;
  return row ? mapMediaRow(row) : null;
}

export function getContactMedia(contactId: number): Media[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM media WHERE contact_id = ? ORDER BY created_at DESC")
    .all(contactId) as MediaRow[];
  return rows.map(mapMediaRow);
}

export function updateMediaPrice(id: number, price: number): Media | null {
  const db = getDb();
  db.prepare("UPDATE media SET price = ? WHERE id = ?").run(price, id);
  return getMediaById(id);
}

export function deleteMedia(id: number): boolean {
  const db = getDb();
  const row = db.prepare("SELECT filename FROM media WHERE id = ?").get(id) as { filename: string } | undefined;
  if (!row) return false;
  db.prepare("DELETE FROM media WHERE id = ?").run(id);
  try {
    fs.unlinkSync(path.join(process.cwd(), "uploads", "media", row.filename));
  } catch {
    // file may not exist on disk
  }
  return true;
}
