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

async function getTagsForContact(contactId: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .prepare("SELECT name FROM tags WHERE contact_id = ? ORDER BY name ASC")
    .all(contactId) as { name: string }[];
  return rows.map((r) => r.name);
}

async function getNotesText(contactId: number): Promise<string> {
  const db = await getDb();
  const rows = await db
    .prepare(
      "SELECT content FROM notes WHERE contact_id = ? ORDER BY updated_at DESC",
    )
    .all(contactId) as { content: string }[];
  return rows.map((r) => r.content).join("\n\n");
}

async function getContactById(id: number): Promise<ContactRow | undefined> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM contacts WHERE id = ?").get(id)) as
    | ContactRow
    | undefined;
}

export async function getContactByTelegramId(
  telegramId: string,
): Promise<ContactRow | undefined> {
  const db = await getDb();
  return (await db
    .prepare("SELECT * FROM contacts WHERE telegram_id = ?")
    .get(telegramId)) as ContactRow | undefined;
}

async function listChatRows(): Promise<ChatListRow[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.*, conv.id AS conversation_id, conv.last_message, conv.last_message_time,
              conv.unread_count, conv.is_pinned
       FROM contacts c
       INNER JOIN conversations conv ON conv.contact_id = c.id
       ORDER BY conv.is_pinned DESC, conv.last_message_time DESC`,
    )
    .all() as ChatListRow[];
  return rows;
}

export async function listChats(): Promise<Chat[]> {
  const rows = await listChatRows();
  if (rows.length === 0) return [];

  const db = await getDb();
  const tagsRows = await db
    .prepare("SELECT contact_id, name FROM tags ORDER BY name ASC")
    .all() as { contact_id: number; name: string }[];

  const tagsByContact = new Map<number, string[]>();
  for (const t of tagsRows) {
    const list = tagsByContact.get(t.contact_id) ?? [];
    list.push(t.name);
    tagsByContact.set(t.contact_id, list);
  }

  const result: Chat[] = [];
  for (const row of rows) {
    const tags = tagsByContact.get(row.id) ?? [];
    result.push(mapChatRow(row, tags));
  }
  return result;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();
  const totalChats = (
    await db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number }
  ).count;
  const onlineCount = (
    await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE is_online = 1")
      .get() as { count: number }
  ).count;
  const totalRevenue = (
    await db.prepare("SELECT COALESCE(SUM(revenue), 0) AS total FROM contacts").get() as {
      total: number;
    }
  ).total;
  const unreadTotal = (
    await db
      .prepare("SELECT COALESCE(SUM(unread_count), 0) AS total FROM conversations")
      .get() as { total: number }
  ).total;

  return mapDashboardStats(totalChats, onlineCount, totalRevenue, unreadTotal);
}

export async function getContactProfile(contactId: number): Promise<ContactProfile | null> {
  const contact = await getContactById(contactId);
  if (!contact) return null;
  const [tags, notesText, purchases] = await Promise.all([
    getTagsForContact(contactId),
    getNotesText(contactId),
    getPurchasesByContact(contactId),
  ]);
  return {
    ...mapContactToProfile(contact, tags, notesText),
    purchases,
  };
}

export async function getConversationIdByContactId(
  contactId: number,
): Promise<number | null> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT id FROM conversations WHERE contact_id = ?")
    .get(contactId) as { id: number } | undefined;
  return row?.id ?? null;
}

export async function getMessagesByContactId(contactId: number, limit = 50): Promise<Message[]> {
  const conversationId = await getConversationIdByContactId(contactId);
  if (!conversationId) return [];

  const db = await getDb();

  const rows = await db
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .all(conversationId, limit);
  return (rows as import("./types").MessageRow[]).reverse().map(mapMessageRow);
}

export async function markConversationRead(contactId: number): Promise<void> {
  const conversationId = await getConversationIdByContactId(contactId);
  if (!conversationId) return;

  const db = await getDb();
  const ts = nowIso();

  const markRead = db.transaction(async () => {
    await db.prepare(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND direction = 'incoming' AND is_read = 0",
    ).run(conversationId);
    await db.prepare(
      "UPDATE conversations SET unread_count = 0, updated_at = ? WHERE id = ?",
    ).run(ts, conversationId);
  });
  await markRead();
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

export async function createContact(input: CreateContactInput): Promise<ContactProfile> {
  const db = await getDb();
  const ts = nowIso();
  const username = input.username.startsWith("@")
    ? input.username
    : `@${input.username}`;
  const avatar = initialsFromName(input.name);
  const countRow = await db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number };
  const colorIndex = countRow.count % AVATAR_COLORS.length;

  const insertContactAndConversation = db.transaction(async () => {
    const result = await db
      .prepare(
        `INSERT INTO contacts (
          name, username, avatar, avatar_color, phone, email, company, location,
          joined_at, revenue, revenue_trend, lead_score, lead_status, is_online,
          ppv_count, telegram_id, telegram_access_hash, total_spent, vip_level,
          fan_status, fan_score, last_purchase_date, emotional_temp, relationship_score,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'flat', 50, 'warm', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 50, 0, ?, ?)`,
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
        nowIso(),
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

    await db.prepare(
      `INSERT INTO conversations (
        contact_id, last_message, last_message_time, unread_count, is_pinned,
        created_at, updated_at
      ) VALUES (?, '', ?, 0, 0, ?, ?)`,
    ).run(contactId, ts, ts, ts);

    return contactId;
  });

  const contactId = await insertContactAndConversation();

  const profile = await getContactProfile(contactId);
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

export async function updateContact(
  contactId: number,
  input: UpdateContactInput,
): Promise<ContactProfile | null> {
  const existing = await getContactById(contactId);
  if (!existing) return null;

  const db = await getDb();
  const ts = nowIso();

  const updateFieldsAndAvatar = db.transaction(async () => {
    await db.prepare(
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
      await db.prepare("UPDATE contacts SET avatar = ? WHERE id = ?").run(
        initialsFromName(input.name),
        contactId,
      );
    }
  });

  await updateFieldsAndAvatar();

  return getContactProfile(contactId);
}

export async function deleteContact(contactId: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.prepare("DELETE FROM contacts WHERE id = ?").run(contactId);
  return result.changes > 0;
}

export async function addNote(contactId: number, content: string) {
  const db = await getDb();
  const ts = nowIso();
  const result = await db
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

export async function addTag(contactId: number, name: string) {
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name is required");
  const ts = nowIso();

  try {
    const insertTagAndEvent = db.transaction(async () => {
      const result = await db
        .prepare(
          "INSERT INTO tags (contact_id, name, created_at) VALUES (?, ?, ?)",
        )
        .run(contactId, trimmed, ts);
      await db.prepare(
        "INSERT INTO tag_events (contact_id, tag_name, event_type, created_at) VALUES (?, ?, 'added', ?)",
      ).run(contactId, trimmed, ts);
      return {
        id: Number(result.lastInsertRowid),
        contactId,
        name: trimmed,
      };
    });

    return await insertTagAndEvent();
  } catch {
    throw new Error("Tag already exists for this contact");
  }
}

export async function deleteTag(contactId: number, name: string): Promise<boolean> {
  const db = await getDb();
  const trimmed = name.trim();
  const ts = nowIso();

  const deleteAndRecord = db.transaction(async () => {
    const result = await db
      .prepare("DELETE FROM tags WHERE contact_id = ? AND name = ?")
      .run(contactId, trimmed);
    if (result.changes === 0) return 0;
    await db.prepare(
      "INSERT INTO tag_events (contact_id, tag_name, event_type, created_at) VALUES (?, ?, 'removed', ?)",
    ).run(contactId, trimmed, ts);
    await db.prepare("UPDATE contacts SET updated_at = ? WHERE id = ?").run(ts, contactId);
    return result.changes;
  });

  return (await deleteAndRecord()) > 0;
}

export async function createMessage(
  contactId: number,
  text: string,
  direction: MessageDirection = "outgoing",
  telegramMessageId?: number | null,
): Promise<Message | null> {
  const conversationId = await getConversationIdByContactId(contactId);
  if (!conversationId) return null;

  const db = await getDb();

  // Idempotency: skip if this Telegram message was already saved
  if (telegramMessageId != null) {
    const exists = await db
      .prepare("SELECT id FROM messages WHERE telegram_message_id = ? AND conversation_id = ?")
      .get(telegramMessageId, conversationId);
    if (exists) return null;
  }
  const ts = nowIso();
  const isRead = direction === "outgoing" ? 1 : 0;

  const insertAndUpdateConversation = db.transaction(async () => {
    const result = await db
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

    await db.prepare(
      `UPDATE conversations SET
        last_message = ?,
        last_message_time = ?,
        unread_count = CASE WHEN ? = 'incoming' THEN unread_count + 1 ELSE unread_count END,
        updated_at = ?
      WHERE id = ?`,
    ).run(text.trim(), ts, direction, ts, conversationId);

    return (await db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(result.lastInsertRowid)) as import("./types").MessageRow;
  });

  const row = await insertAndUpdateConversation();
  return mapMessageRow(row);
}

export interface CreatePurchaseInput {
  contactId: number;
  amount: number;
  purchaseDate: string;
  note?: string;
  kind?: string;
  markPaid?: boolean;
  /** Razorpay payment ID for atomic idempotency check inside the transaction */
  paymentId?: string;
}

export async function createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
  const db = await getDb();
  const ts = nowIso();
  const kind = input.kind ?? "ppv";
  const contact = await db.prepare("SELECT id FROM contacts WHERE id = ?").get(input.contactId) as { id: number } | undefined;
  if (!contact) throw new Error("Contact not found");

  const insertAndUpdateStats = db.transaction(async () => {
    if (input.paymentId) {
      const existing = await db
        .prepare("SELECT id FROM purchases WHERE note LIKE ?")
        .get(`%razorpay_payment:${input.paymentId}%`);
      if (existing) {
        const row = await db
          .prepare("SELECT * FROM purchases WHERE id = ?")
          .get((existing as { id: number }).id) as import("./types").PurchaseRow;
        return row;
      }
    }

    const result = await db
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
    if (input.markPaid) {
      updateParts.push("conv_state = 'PAID'");
    }
    await db.prepare(
      `UPDATE contacts SET ${updateParts.join(", ")} WHERE id = ?`,
    ).run(...updateArgs, input.contactId);

    return (await db.prepare("SELECT * FROM purchases WHERE id = ?").get(result.lastInsertRowid)) as import("./types").PurchaseRow;
  });

  const row = await insertAndUpdateStats();
  return mapPurchaseRow(row);
}

export async function getPurchasesByContact(contactId: number): Promise<Purchase[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      "SELECT * FROM purchases WHERE contact_id = ? ORDER BY purchase_date DESC",
    )
    .all(contactId) as import("./types").PurchaseRow[];
  return rows.map(mapPurchaseRow);
}

export async function getMonthlyRevenue(months: number = 12): Promise<MonthlyRevenue[]> {
  const db = await getDb();
  const rows = await db
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

export async function getTopSpenders(limit: number = 10): Promise<TopSpender[]> {
  const db = await getDb();
  const rows = await db
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

export async function getRevenueData(months: number = 12, limit: number = 10): Promise<RevenueData> {
  const [monthly, topSpenders] = await Promise.all([
    getMonthlyRevenue(months),
    getTopSpenders(limit),
  ]);
  return { monthly, topSpenders };
}

export async function getPpvStats(limit: number = 10): Promise<PpvStats> {
  const db = await getDb();
  const totals = await db
    .prepare(
      `SELECT
         COALESCE(SUM(amount), 0) AS totalRevenue,
         COUNT(*) AS purchaseCount,
         COUNT(DISTINCT contact_id) AS uniqueBuyers
       FROM purchases
       WHERE kind = 'ppv'`,
    )
    .get() as { totalRevenue: number; purchaseCount: number; uniqueBuyers: number };
  const topBuyers = await db
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

export async function getBroadcastAudienceCount(filters: BroadcastFilters): Promise<number> {
  const db = await getDb();
  const { where, args } = buildBroadcastAudienceWhere(filters);
  const row = await db
    .prepare(
      `SELECT COUNT(DISTINCT c.id) AS count
       FROM contacts c
       WHERE ${where.join(" AND ")}`,
    )
    .get(...args) as { count: number };
  return row.count;
}

export async function getBroadcastRecipients(filters: BroadcastFilters): Promise<BroadcastRecipient[]> {
  const db = await getDb();
  const { where, args } = buildBroadcastAudienceWhere(filters);
  return db
    .prepare(
      `SELECT DISTINCT c.id, c.name, c.username
       FROM contacts c
       WHERE ${where.join(" AND ")}
       ORDER BY c.total_spent DESC, c.updated_at DESC`,
    )
    .all(...args) as Promise<BroadcastRecipient[]>;
}

export async function listBroadcasts(limit: number = 20): Promise<Broadcast[]> {
  const db = await getDb();
  const rows = await db
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

export async function getFollowUpAudience(
  segmentKey: string,
  limit: number = AUDIENCE_LIMIT,
): Promise<BroadcastRecipient[]> {
  const capped = Math.min(limit, AUDIENCE_LIMIT);
  switch (segmentKey) {
    case "no_message_7d":
      return audienceToRecipients(await getFollowUpNoMessageInDays(7, capped));
    case "no_purchase_30d":
      return audienceToRecipients(await getFollowUpNoPurchaseInDays(30, capped));
    case "vip_inactive_14d":
      return audienceToRecipients(
        await getFollowUpVipInactive(["gold", "platinum", "silver"], 14, capped),
      );
    case "high_spender_inactive":
      return audienceToRecipients(
        await getFollowUpHighSpenderInactive(1500, 30, capped),
      );
    case "no_ppv_30d":
      return audienceToRecipients(await getFollowUpNoPpvInDays(30, capped));
    case "never_purchased":
      return audienceToRecipients(await getFollowUpProspectEngaged(capped));
    default:
      return [];
  }
}

export async function getFollowUpAudienceCount(segmentKey: string): Promise<number> {
  const db = await getDb();
  switch (segmentKey) {
    case "no_message_7d":
      return (
        await db
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
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM contacts
             WHERE last_purchase_date IS NOT NULL
               AND last_purchase_date < date('now', '-30 days')`,
          )
          .get() as { count: number }
      ).count;
    case "vip_inactive_14d":
      return (
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM contacts
             WHERE vip_level IN ('gold', 'platinum', 'silver')
               AND updated_at < date('now', '-14 days')`,
          )
          .get() as { count: number }
      ).count;
    case "high_spender_inactive":
      return (
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM contacts
             WHERE total_spent >= 1500
               AND (last_purchase_date IS NULL OR last_purchase_date < date('now', '-30 days'))
               AND updated_at < date('now', '-30 days')`,
          )
          .get() as { count: number }
      ).count;
    case "no_ppv_30d":
      return (
        await db
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
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM contacts c
             INNER JOIN conversations conv ON conv.contact_id = c.id
             LEFT JOIN purchases p ON p.contact_id = c.id
             WHERE c.spend_segment = 'prospect'
               AND c.conv_state = 'FREE_CHAT'
               AND p.id IS NULL
               AND EXISTS (
                 SELECT 1 FROM messages m WHERE m.conversation_id = conv.id AND m.created_at >= date('now', '-7 days')
               )`,
          )
          .get() as { count: number }
      ).count;
    default:
      return 0;
  }
}

export async function createBroadcastHistory(input: {
  name: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  trigger?: string | null;
}): Promise<Broadcast> {
  const db = await getDb();
  const ts = nowIso();
  const result = await db
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
  const row = await db
    .prepare("SELECT * FROM broadcasts WHERE id = ?")
    .get(result.lastInsertRowid) as BroadcastRow;
  return mapBroadcastRow(row);
}

async function getOverview(): Promise<AnalyticsData["overview"]> {
  const db = await getDb();
  const [
    totalFansRow,
    activeFansRow,
    vipFansRow,
    totalRevenueRow,
    revenueLast30DaysRow,
    messagesSentRow,
    messagesReceivedRow,
    currentMonthRow,
    previousMonthRow,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) AS count FROM contacts WHERE fan_status = 'active'").get() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) AS count FROM contacts WHERE vip_level != 'none'").get() as Promise<{ count: number }>,
    db.prepare("SELECT COALESCE(SUM(revenue), 0) AS total FROM contacts").get() as Promise<{ total: number }>,
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM purchases WHERE purchase_date >= date('now', '-30 days')").get() as Promise<{ total: number }>,
    db.prepare("SELECT COUNT(*) AS count FROM messages WHERE direction = 'outgoing'").get() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) AS count FROM messages WHERE direction = 'incoming'").get() as Promise<{ count: number }>,
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM purchases WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now')").get() as Promise<{ total: number }>,
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM purchases WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now', '-1 month')").get() as Promise<{ total: number }>,
  ]);

  const totalFans = totalFansRow.count;
  const activeFans = activeFansRow.count;
  const vipFans = vipFansRow.count;
  const totalRevenue = totalRevenueRow.total;
  const revenueLast30Days = revenueLast30DaysRow.total;
  const messagesSent = messagesSentRow.count;
  const messagesReceived = messagesReceivedRow.count;
  const currentMonth = currentMonthRow.total;
  const previousMonth = previousMonthRow.total;

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

async function getFansByVipLevel(): Promise<VipLevelBreakdown[]> {
  const db = await getDb();
  return db
    .prepare(
      "SELECT vip_level AS level, COUNT(*) AS count FROM contacts GROUP BY vip_level ORDER BY count DESC",
    )
    .all() as Promise<VipLevelBreakdown[]>;
}

async function getFansByStatus(): Promise<FanStatusBreakdown[]> {
  const db = await getDb();
  return db
    .prepare(
      "SELECT fan_status AS status, COUNT(*) AS count FROM contacts GROUP BY fan_status ORDER BY count DESC",
    )
    .all() as Promise<FanStatusBreakdown[]>;
}

async function getFanScoreStats(): Promise<FanScoreStats> {
  const db = await getDb();
  const row = await db
    .prepare(
      "SELECT COALESCE(MAX(fan_score), 0) AS highest, COALESCE(ROUND(AVG(fan_score), 1), 0) AS average FROM contacts",
    )
    .get() as { highest: number; average: number };
  return row;
}

async function getMostActiveContacts(limit: number = 5): Promise<ActiveContact[]> {
  const db = await getDb();
  const rows = await db
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

async function getInactiveContacts(days: number = 30, limit: number = 10): Promise<InactiveContact[]> {
  const db = await getDb();
  const rows = await db
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

async function getRecentPurchasers(limit: number = 5): Promise<RecentPurchaser[]> {
  const db = await getDb();
  const rows = await db
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

export async function getAnalytics(): Promise<AnalyticsData> {
  const [
    overview,
    fansByVipLevel,
    fansByStatus,
    fanScores,
    mostActive,
    inactiveContacts,
    recentPurchasers,
    retention,
    campaigns,
  ] = await Promise.all([
    getOverview(),
    getFansByVipLevel(),
    getFansByStatus(),
    getFanScoreStats(),
    getMostActiveContacts(),
    getInactiveContacts(),
    getRecentPurchasers(),
    getRetentionData(),
    getCampaignAnalyticsSummary(),
  ]);
  return {
    overview,
    fansByVipLevel,
    fansByStatus,
    fanScores,
    mostActive,
    inactiveContacts,
    recentPurchasers,
    retention,
    campaigns,
  };
}

async function getCampaignAnalyticsSummary(): Promise<CampaignAnalyticsSummary> {
  const db = await getDb();
  const [totalCampaignsRow, totalMessagesSentRow] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM broadcasts WHERE created_at >= date('now', '-30 days')").get() as Promise<{ count: number }>,
    db.prepare("SELECT COALESCE(SUM(sent_count), 0) AS total FROM broadcasts WHERE created_at >= date('now', '-30 days')").get() as Promise<{ total: number }>,
  ]);
  const totalCampaigns = totalCampaignsRow.count;
  const totalMessagesSent = totalMessagesSentRow.total;
  const mostUsedRow = await db
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

async function getRetentionOverview(): Promise<RetentionData["overview"]> {
  const db = await getDb();
  const [activeFans30dRow, newFans30dRow, returningBuyersRow, totalBuyersRow, churnedBuyersRow] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases WHERE purchase_date >= date('now', '-30 days')").get() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) AS count FROM contacts WHERE created_at >= date('now', '-30 days')").get() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) AS count FROM (SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) > 1)").get() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases").get() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases WHERE contact_id IN (SELECT contact_id FROM purchases GROUP BY contact_id HAVING MAX(purchase_date) < date('now', '-60 days'))").get() as Promise<{ count: number }>,
  ]);
  const activeFans30d = activeFans30dRow.count;
  const newFans30d = newFans30dRow.count;
  const returningBuyers = returningBuyersRow.count;
  const totalBuyers = totalBuyersRow.count;
  const churnedBuyers = churnedBuyersRow.count;
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

async function getRetentionAnalytics(): Promise<RetentionData["analytics"]> {
  const db = await getDb();
  const [buyersThisMonthRow, buyersLastMonthRow, revenueFromRepeatBuyersRow, revenueFromNewBuyersRow] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now')").get() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now', '-1 month')").get() as Promise<{ count: number }>,
    db.prepare("SELECT COALESCE(SUM(p.amount), 0) AS total FROM purchases p WHERE p.contact_id IN (SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) > 1)").get() as Promise<{ total: number }>,
    db.prepare("SELECT COALESCE(SUM(p.amount), 0) AS total FROM purchases p WHERE p.contact_id IN (SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) = 1)").get() as Promise<{ total: number }>,
  ]);
  return {
    buyersThisMonth: buyersThisMonthRow.count,
    buyersLastMonth: buyersLastMonthRow.count,
    revenueFromRepeatBuyers: revenueFromRepeatBuyersRow.total,
    revenueFromNewBuyers: revenueFromNewBuyersRow.total,
  };
}

export async function getRetentionData(): Promise<RetentionData> {
  const [overview, analytics, segments] = await Promise.all([
    getRetentionOverview(),
    getRetentionAnalytics(),
    getRetentionSegmentCounts(),
  ]);
  return { overview, analytics, segments };
}

async function getRetentionSegmentCounts(): Promise<RetentionData["segments"]> {
  const db = await getDb();
  const row = await db
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

export async function getTimeline(contactId: number, limit: number = 100): Promise<TimelineEvent[]> {
  const db = await getDb();
  const rows = await db
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

async function getFollowUpNoMessageInDays(days: number, limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
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

async function getFollowUpNoPurchaseInDays(days: number, limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
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

async function getFollowUpNoPpvInDays(days: number, limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
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

async function getFollowUpVipInactive(vipLevels: string[], days: number, limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const placeholders = vipLevels.map(() => "?").join(",");
  const rows = await db
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

async function getFollowUpHighSpenderInactive(minSpent: number, days: number, limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
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
    mapFollowUpRow({ ...r, hint_value: `₹${r.total_spent.toFixed(0)}` }),
  );
}

async function getFollowUpPremiumInactive(limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(c.last_purchase_date) AS INTEGER) AS days_since
       FROM contacts c
       WHERE c.spend_segment = 'premium'
         AND c.last_purchase_date IS NOT NULL
         AND c.last_purchase_date < date('now', '-21 days')
       ORDER BY c.last_purchase_date ASC
       LIMIT ?`
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: `${r.days_since}d` }));
}

async function getFollowUpHighValueInactive(limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(c.last_purchase_date) AS INTEGER) AS days_since
       FROM contacts c
       WHERE c.spend_segment = 'high_value'
         AND c.last_purchase_date IS NOT NULL
         AND c.last_purchase_date < date('now', '-30 days')
       ORDER BY c.last_purchase_date ASC
       LIMIT ?`
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: `${r.days_since}d` }));
}

async function getFollowUpVipBySegment(limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(c.last_purchase_date) AS INTEGER) AS days_since
       FROM contacts c
       WHERE c.spend_segment = 'vip'
         AND c.last_purchase_date IS NOT NULL
         AND c.last_purchase_date < date('now', '-45 days')
       ORDER BY c.last_purchase_date ASC
       LIMIT ?`
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: `${r.days_since}d` }));
}

async function getFollowUpWhaleInactive(limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(c.last_purchase_date) AS INTEGER) AS days_since
       FROM contacts c
       WHERE c.spend_segment = 'whale'
         AND c.last_purchase_date IS NOT NULL
         AND c.last_purchase_date < date('now', '-60 days')
       ORDER BY c.last_purchase_date ASC
       LIMIT ?`
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: `${r.days_since}d` }));
}

async function getFollowUpProspectEngaged(limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(MAX(m.created_at)) AS INTEGER) AS days_since
       FROM contacts c
       INNER JOIN conversations conv ON conv.contact_id = c.id
       LEFT JOIN messages m ON m.conversation_id = conv.id
       WHERE c.spend_segment = 'prospect'
         AND c.conv_state = 'FREE_CHAT'
       GROUP BY c.id
       HAVING MAX(m.created_at) IS NOT NULL
          AND MAX(m.created_at) >= date('now', '-7 days')
       ORDER BY MAX(m.created_at) DESC
       LIMIT ?`
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: `${r.days_since}d` }));
}

async function getFollowUpBuyerInactive(limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.name, c.username, c.avatar, c.avatar_color,
              CAST(julianday('now') - julianday(c.last_purchase_date) AS INTEGER) AS days_since
       FROM contacts c
       WHERE c.spend_segment = 'buyer'
         AND c.last_purchase_date IS NOT NULL
         AND c.last_purchase_date < date('now', '-14 days')
       ORDER BY c.last_purchase_date ASC
       LIMIT ?`
    )
    .all(limit) as {
      id: number;
      name: string;
      username: string;
      avatar: string;
      avatar_color: string;
      days_since: number;
    }[];
  return rows.map((r) => mapFollowUpRow({ ...r, hint_value: `${r.days_since}d` }));
}

export async function getFollowUps(limit: number = 10): Promise<FollowUpData> {
  const lists: FollowUpList[] = [
    {
      key: "no_message_7d",
      title: "No message in 7 days",
      description: "Fans you haven't replied to in a week",
      count: 0,
      items: await getFollowUpNoMessageInDays(7, limit),
    },
    {
      key: "no_purchase_30d",
      title: "No purchase in 30 days",
      description: "Previous buyers at risk of churning",
      count: 0,
      items: await getFollowUpNoPurchaseInDays(30, limit),
    },
    {
      key: "vip_inactive_14d",
      title: "VIP inactive for 14 days",
      description: "VIP-tier fans who went quiet",
      count: 0,
      items: await getFollowUpVipInactive(["gold", "platinum", "silver"], 14, limit),
    },
    {
      key: "high_spender_inactive",
      title: "High spender inactive",
      description: "Top spenders (₹1500+) silent for 30+ days",
      count: 0,
      items: await getFollowUpHighSpenderInactive(1500, 30, limit),
    },
    {
      key: "no_ppv_30d",
      title: "No PPV purchase in 30 days",
      description: "Past PPV buyers who stopped unlocking",
      count: 0,
      items: await getFollowUpNoPpvInDays(30, limit),
    },
    {
      key: "prospect_engaged",
      title: "Prospect — engaged, never bought",
      description: "Active chatters who haven't purchased yet",
      count: 0,
      items: await getFollowUpProspectEngaged(limit),
    },
    {
      key: "buyer_inactive",
      title: "Buyer — inactive 14d+",
      description: "First-time buyers who went quiet",
      count: 0,
      items: await getFollowUpBuyerInactive(limit),
    },
    {
      key: "premium_inactive",
      title: "Premium — inactive 21d+",
      description: "Repeat buyers (2+ or ₹500+) at risk",
      count: 0,
      items: await getFollowUpPremiumInactive(limit),
    },
    {
      key: "high_value_inactive",
      title: "High Value — inactive 30d+",
      description: "High-value buyers (₹1500+) at risk",
      count: 0,
      items: await getFollowUpHighValueInactive(limit),
    },
    {
      key: "vip_segment_inactive",
      title: "VIP — inactive 45d+",
      description: "VIP buyers (₹5000+) at risk",
      count: 0,
      items: await getFollowUpVipBySegment(limit),
    },
    {
      key: "whale_inactive",
      title: "Whale — inactive 60d+",
      description: "Whale buyers (₹20000+) at risk",
      count: 0,
      items: await getFollowUpWhaleInactive(limit),
    },
  ];
  for (const list of lists) {
    try {
      list.count = await getFollowUpAudienceCount(list.key);
    } catch {
      list.count = list.items.length;
    }
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

export async function createMedia(input: CreateMediaInput): Promise<Media> {
  const db = await getDb();
  const ts = nowIso();
  const result = await db
    .prepare(
      `INSERT INTO media (contact_id, filename, original_name, mime_type, file_size, price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.contactId, input.filename, input.originalName, input.mimeType, input.fileSize, input.price ?? 0, ts);
  const row = await db.prepare("SELECT * FROM media WHERE id = ?").get(result.lastInsertRowid) as MediaRow;
  return mapMediaRow(row);
}

export async function getMediaById(id: number): Promise<Media | null> {
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM media WHERE id = ?").get(id) as MediaRow | undefined;
  return row ? mapMediaRow(row) : null;
}

export async function getContactMedia(contactId: number): Promise<Media[]> {
  const db = await getDb();
  const rows = await db
    .prepare("SELECT * FROM media WHERE contact_id = ? ORDER BY created_at DESC")
    .all(contactId) as MediaRow[];
  return rows.map(mapMediaRow);
}

export async function updateMediaPrice(id: number, price: number): Promise<Media | null> {
  const db = await getDb();
  await db.prepare("UPDATE media SET price = ? WHERE id = ?").run(price, id);
  return getMediaById(id);
}

export async function isMediaUnlocked(mediaId: number, contactId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT id FROM purchases WHERE kind = 'ppv' AND note LIKE ? AND contact_id = ?")
    .get(`media_unlock:${mediaId}:%`, contactId) as { id: number } | undefined;
  return !!row;
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDb();
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return defaultValue;
  }
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db
    .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
    .run(key, JSON.stringify(value), ts);
}

export async function recalculateLeadScore(contactId: number): Promise<number> {
  const db = await getDb();
  
  // Base score
  let score = 50;

  // 1. Message count (incoming)
  const msgRow = await db.prepare(
    "SELECT COUNT(*) AS count FROM messages m INNER JOIN conversations c ON m.conversation_id = c.id WHERE c.contact_id = ? AND m.direction = 'incoming'"
  ).get(contactId) as { count: number };
  score += Math.min(msgRow.count * 2, 20); // Max +20 from messages

  // 2. Payment history
  const purchaseRow = await db.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM purchases WHERE contact_id = ?"
  ).get(contactId) as { count: number, total: number };
  
  if (purchaseRow.count > 0) {
    score += 30; // Customer bonus
    score += Math.min(Math.floor(purchaseRow.total / 100), 20); // +1 per ₹100, max +20
  }

  // 3. Intent keywords in last 5 messages
  const lastMsgs = await db.prepare(
    "SELECT text FROM messages m INNER JOIN conversations c ON m.conversation_id = c.id WHERE c.contact_id = ? AND m.direction = 'incoming' ORDER BY m.created_at DESC LIMIT 5"
  ).all(contactId) as { text: string }[];
  
  const intentKeywords = ["buy", "price", "payment", "premium", "vip", "exclusive", "subscription", "unlock", "video", "content"];
  let intentCount = 0;
  for (const msg of lastMsgs) {
    const lower = msg.text.toLowerCase();
    if (intentKeywords.some(kw => lower.includes(kw))) {
      intentCount++;
    }
  }
  score += intentCount * 10;

  // Clamp score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, score));
  
  // Determine status
  let status = "cold";
  if (finalScore >= 80) status = "hot";
  else if (finalScore >= 50) status = "warm";

  await db.prepare(
    "UPDATE contacts SET lead_score = ?, lead_status = ?, updated_at = ? WHERE id = ?"
  ).run(finalScore, status, nowIso(), contactId);

  return finalScore;
}

export async function deleteMedia(id: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.prepare("SELECT filename FROM media WHERE id = ?").get(id) as { filename: string } | undefined;
  if (!row) return false;
  await db.prepare("DELETE FROM media WHERE id = ?").run(id);
  try {
    fs.unlinkSync(path.join(process.cwd(), "uploads", "media", row.filename));
  } catch {
  }
  return true;
}

const POSITIVE_WORDS = ["love", "nice", "cute", "beautiful", "gorgeous", "thanks", "thank", "awesome", "amazing", "wonderful", "great", "sweet", "pretty", "sexy", "hot", "miss you", "want you", "good", "best"];
const NEGATIVE_WORDS = ["bad", "hate", "stupid", "ugly", "worst", "terrible", "awful", "no", "don't", "dont", "not interested", "leave", "stop", "boring", "waste"];
const HIGH_ENERGY_WORDS = ["sexy", "hot", "miss you", "want you", "die", "crazy", "wild", "🔥", "❤️", "😍", "😘", "💕"];
const DISENGAGEMENT_WORDS = ["bye", "goodbye", "later", "busy", "talk later", "gotta go", "hh", "ok bye", "tata", "night", "sleep"];

export async function updateEmotionalTemp(contactId: number): Promise<number> {
  const db = await getDb();
  const last5 = await db
    .prepare(
      "SELECT text FROM messages m INNER JOIN conversations c ON m.conversation_id = c.id WHERE c.contact_id = ? AND m.direction = 'incoming' ORDER BY m.created_at DESC LIMIT 5"
    )
    .all(contactId) as { text: string }[];

  let temp = 50;
  for (const msg of last5) {
    const lower = msg.text.toLowerCase();
    if (POSITIVE_WORDS.some((w) => lower.includes(w))) temp += 6;
    if (HIGH_ENERGY_WORDS.some((w) => lower.includes(w))) temp += 8;
    if (NEGATIVE_WORDS.some((w) => lower.includes(w))) temp -= 6;
    if (DISENGAGEMENT_WORDS.some((w) => lower.includes(w))) temp -= 10;
  }

  temp = Math.max(0, Math.min(100, temp));

  await db
    .prepare("UPDATE contacts SET emotional_temp = ?, updated_at = ? WHERE id = ?")
    .run(temp, nowIso(), contactId);

  return temp;
}

export async function updateRelationshipScore(contactId: number): Promise<number> {
  const db = await getDb();
  const contact = await db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId) as ContactRow | undefined;
  if (!contact) return 0;

  let score = 0;

  const msgCount = await db
    .prepare("SELECT COUNT(*) AS count FROM messages m INNER JOIN conversations c ON m.conversation_id = c.id WHERE c.contact_id = ?")
    .get(contactId) as { count: number };
  score += Math.min(msgCount.count, 20);

  if (contact.created_at) {
    const daysSince = (Date.now() - new Date(contact.created_at).getTime()) / 86400000;
    score += Math.min(Math.floor(daysSince), 15);
  }

  const purchaseRow = await db
    .prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM purchases WHERE contact_id = ?")
    .get(contactId) as { count: number; total: number };
  if (purchaseRow.count > 0) {
    score += 30;
    score += Math.min(purchaseRow.count * 5, 10);
  }

  score += Math.floor((contact.emotional_temp - 50) * 0.3);

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  await db
    .prepare("UPDATE contacts SET relationship_score = ?, updated_at = ? WHERE id = ?")
    .run(finalScore, nowIso(), contactId);

  return finalScore;
}

export async function incrementOfferDeclined(contactId: number): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE contacts SET offer_declined_count = offer_declined_count + 1, updated_at = ? WHERE id = ?")
    .run(nowIso(), contactId);
}

export async function setOfferCooldown(contactId: number, cooldownDays: number = 7): Promise<void> {
  const db = await getDb();
  const until = new Date(Date.now() + cooldownDays * 86400000).toISOString();
  await db
    .prepare("UPDATE contacts SET offer_cooldown_until = ?, updated_at = ? WHERE id = ?")
    .run(until, nowIso(), contactId);
}

export async function getOfferCooldownRemaining(contactId: number): Promise<number> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT offer_cooldown_until FROM contacts WHERE id = ?")
    .get(contactId) as { offer_cooldown_until: string | null } | undefined;
  if (!row?.offer_cooldown_until) return 0;
  const remaining = new Date(row.offer_cooldown_until).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 86400000));
}

export async function isInOfferCooldown(contactId: number): Promise<boolean> {
  return (await getOfferCooldownRemaining(contactId)) > 0;
}

export type PostPurchasePhase = "welcome" | "nurture" | "reoffer" | "none";

export async function getPostPurchasePhase(contactId: number): Promise<PostPurchasePhase> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT paid_at, post_purchase_welcome_sent, last_upsell_at FROM contacts WHERE id = ?")
    .get(contactId) as { paid_at: string | null; post_purchase_welcome_sent: number; last_upsell_at: string | null } | undefined;

  if (!row?.paid_at) return "none";

  const hoursSince = (Date.now() - new Date(row.paid_at).getTime()) / 3600000;

  if (hoursSince < 24 && !row.post_purchase_welcome_sent) return "welcome";
  if (hoursSince < 168) return "nurture";
  return "reoffer";
}

export async function markWelcomeSent(contactId: number): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE contacts SET post_purchase_welcome_sent = 1, updated_at = ? WHERE id = ?")
    .run(nowIso(), contactId);
}

export async function recordPaid(contactId: number): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db
    .prepare("UPDATE contacts SET paid_at = COALESCE(paid_at, ?), conv_state = 'PAID', updated_at = ? WHERE id = ?")
    .run(ts, ts, contactId);
}

export async function recordUpsell(contactId: number): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db
    .prepare("UPDATE contacts SET upsell_count = upsell_count + 1, last_upsell_at = ?, updated_at = ? WHERE id = ?")
    .run(ts, ts, contactId);
}

export type SpendSegment = "prospect" | "buyer" | "premium" | "high_value" | "vip" | "whale";

export async function recalculateSpendSegment(contactId: number): Promise<SpendSegment> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM purchases WHERE contact_id = ?")
    .get(contactId) as { count: number; total: number };

  let segment: SpendSegment = "prospect";
  if (row.count === 0) segment = "prospect";
  else if (row.total >= 20000) segment = "whale";
  else if (row.total >= 5000) segment = "vip";
  else if (row.total >= 1500) segment = "high_value";
  else if (row.count >= 2 || row.total >= 500) segment = "premium";
  else segment = "buyer";

  await db
    .prepare("UPDATE contacts SET spend_segment = ?, updated_at = ? WHERE id = ?")
    .run(segment, nowIso(), contactId);

  return segment;
}

export async function getSpendSegmentMultipliers(segment: SpendSegment): Promise<number> {
  switch (segment) {
    case "prospect": return 0.7;
    case "buyer": return 0.9;
    case "premium": return 1.0;
    case "high_value": return 1.15;
    case "vip": return 1.5;
    case "whale": return 2.0;
    default: return 1.0;
  }
}

export async function getIntentScore(messages: { text: string }[]): Promise<number> {
  const direct = [
    "buy", "price", "cost", "pay", "payment", "premium", "vip", "exclusive",
    "subscription", "membership", "unlock", "join", "link", "how much",
    "kitna", "kitne", "send link", "meeting", "voice", "custom", "photos",
  ];
  const indirect = [
    "chahiye", "do na", "bhej de", "dikha", "want", "need", "show me",
    "let me see", "i want", "mujhe", "de do",
  ];
  const urgency = ["right now", "fast", "quick", "jaldi", "abhi"];

  let score = 0;
  for (const msg of messages) {
    const lower = msg.text.toLowerCase();
    const directHits = direct.filter((kw) => lower.includes(kw)).length;
    const indirectHits = indirect.filter((kw) => lower.includes(kw)).length;
    const urgencyHits = urgency.filter((kw) => lower.includes(kw)).length;

    score += directHits * 20;
    score += indirectHits * 10;
    if (urgencyHits > 0 && indirectHits > 0) score += 15;
  }

  return Math.min(100, score);
}

export async function getRevenueAnalytics(): Promise<{
  conversionRate: number;
  offerAcceptanceByTier: Record<string, { sent: number; purchased: number; rate: number }>;
  aov: number;
  ltv: number;
  repeatPurchaseRate: number;
}> {
  const db = await getDb();

  const totalOffers = (await db
    .prepare("SELECT COUNT(*) AS count FROM contacts WHERE offer_sent = 1")
    .get() as { count: number }).count;

  const totalBuyers = (await db
    .prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases")
    .get() as { count: number }).count;

  const conversionRate = totalOffers > 0 ? Math.round((totalBuyers / totalOffers) * 100) : 0;

  const aovRow = await db
    .prepare("SELECT COALESCE(AVG(amount), 0) AS avg FROM purchases")
    .get() as { avg: number };
  const aov = Math.round(aovRow.avg);

  const ltvRow = await db
    .prepare("SELECT COALESCE(AVG(total_spent), 0) AS avg FROM contacts WHERE total_spent > 0")
    .get() as { avg: number };
  const ltv = Math.round(ltvRow.avg);

  const repeatBuyers = (await db
    .prepare("SELECT COUNT(*) AS count FROM (SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) > 1)")
    .get() as { count: number }).count;
  const repeatPurchaseRate = totalBuyers > 0 ? Math.round((repeatBuyers / totalBuyers) * 100) : 0;

  const tiers = await db
    .prepare("SELECT c.spend_segment, COUNT(*) AS total, COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS purchased FROM (SELECT id, spend_segment FROM contacts WHERE offer_sent = 1) c LEFT JOIN purchases p ON p.contact_id = c.id GROUP BY c.spend_segment")
    .all() as { spend_segment: string; total: number; purchased: number }[];
  const offerAcceptanceByTier: Record<string, { sent: number; purchased: number; rate: number }> = {};
  for (const t of tiers) {
    offerAcceptanceByTier[t.spend_segment || "unknown"] = {
      sent: t.total,
      purchased: t.purchased,
      rate: t.total > 0 ? Math.round((t.purchased / t.total) * 100) : 0,
    };
  }

  return {
    conversionRate,
    offerAcceptanceByTier,
    aov,
    ltv,
    repeatPurchaseRate,
  };
}

export type LeadClassification = "cold" | "warm" | "hot";

function classifyLead(
  emotionalTemp: number,
  leadScore: number,
  daysSinceLastMessage: number | null,
  daysSinceLastPurchase: number | null,
  recentIntent: boolean,
): LeadClassification {
  const score =
    (emotionalTemp / 100) * 30 +
    (leadScore / 100) * 25 +
    (daysSinceLastMessage !== null && daysSinceLastMessage <= 3 ? 20 : daysSinceLastMessage !== null && daysSinceLastMessage <= 7 ? 10 : 0) +
    (daysSinceLastPurchase !== null && daysSinceLastPurchase <= 14 ? 15 : 0) +
    (recentIntent ? 10 : 0);
  if (score >= 60) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}

function calcPurchaseProbability(
  emotionalTemp: number,
  leadScore: number,
  daysSinceLastMessage: number | null,
  hasPurchased: boolean,
  daysSinceLastPurchase: number | null,
): number {
  let p = 0;
  p += (emotionalTemp / 100) * 30;
  p += (leadScore / 100) * 25;
  if (daysSinceLastMessage !== null && daysSinceLastMessage <= 1) p += 20;
  else if (daysSinceLastMessage !== null && daysSinceLastMessage <= 3) p += 15;
  else if (daysSinceLastMessage !== null && daysSinceLastMessage <= 7) p += 5;
  if (!hasPurchased) p += 10;
  else if (daysSinceLastPurchase !== null && daysSinceLastPurchase >= 30) p += 15;
  return Math.min(100, Math.max(0, Math.round(p)));
}

function calcChurnRisk(
  emotionalTemp: number,
  relationshipScore: number,
  daysSinceLastMessage: number | null,
  daysSinceLastPurchase: number | null,
  declinedCount: number,
  hasPurchased: boolean,
): number {
  let r = 0;
  if (emotionalTemp < 30) r += 25;
  else if (emotionalTemp < 45) r += 15;
  if (relationshipScore < 0) r += 20;
  if (daysSinceLastMessage !== null && daysSinceLastMessage > 14) r += 20;
  else if (daysSinceLastMessage !== null && daysSinceLastMessage > 7) r += 10;
  if (hasPurchased && daysSinceLastPurchase !== null && daysSinceLastPurchase > 60) r += 15;
  else if (hasPurchased && daysSinceLastPurchase !== null && daysSinceLastPurchase > 30) r += 10;
  r += Math.min(declinedCount * 5, 15);
  return Math.min(100, Math.max(0, r));
}

function calcConversationHealth(
  emotionalTemp: number,
  relationshipScore: number,
  daysSinceLastMessage: number | null,
): number {
  let h = 50;
  h += (emotionalTemp - 50) * 0.5;
  h += relationshipScore * 0.2;
  if (daysSinceLastMessage !== null && daysSinceLastMessage <= 1) h += 10;
  else if (daysSinceLastMessage !== null && daysSinceLastMessage <= 3) h += 5;
  else if (daysSinceLastMessage !== null && daysSinceLastMessage > 14) h -= 15;
  else if (daysSinceLastMessage !== null && daysSinceLastMessage > 7) h -= 5;
  return Math.min(100, Math.max(0, Math.round(h)));
}

function calcLifetimeSpendScore(totalSpent: number): number {
  if (totalSpent >= 20000) return 100;
  if (totalSpent >= 5000) return 85;
  if (totalSpent >= 1500) return 65;
  if (totalSpent >= 500) return 45;
  if (totalSpent > 0) return 25;
  return 0;
}

export async function recalculateBuyerIntelligence(contactId: number): Promise<void> {
  const db = await getDb();
  const contact = await db
    .prepare("SELECT emotional_temp, lead_score, relationship_score, total_spent, last_purchase_date, offer_declined_count, conv_state FROM contacts WHERE id = ?")
    .get(contactId) as {
      emotional_temp: number;
      lead_score: number;
      relationship_score: number;
      total_spent: number;
      last_purchase_date: string | null;
      offer_declined_count: number;
      conv_state: string;
    } | undefined;
  if (!contact) return;

  const conv = await db
    .prepare("SELECT id FROM conversations WHERE contact_id = ?")
    .get(contactId) as { id: number } | undefined;

  let daysSinceLastMessage: number | null = null;
  let recentIntent = false;
  if (conv) {
    const lastMsg = await db
      .prepare("SELECT created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(conv.id) as { created_at: string } | undefined;
    if (lastMsg) {
      daysSinceLastMessage = Math.floor((Date.now() - new Date(lastMsg.created_at).getTime()) / 86400000);
      const recentMsgs = await db
        .prepare("SELECT text FROM messages WHERE conversation_id = ? AND created_at >= datetime('now', '-3 days') AND direction = 'incoming' LIMIT 5")
        .all(conv.id) as { text: string }[];
      const intentKw = ["buy", "price", "cost", "pay", "premium", "link", "want", "need", "chahiye", "kitna", "how much"];
      recentIntent = recentMsgs.some((m) => intentKw.some((kw) => m.text.toLowerCase().includes(kw)));
    }
  }

  const hasPurchased = contact.total_spent > 0;
  const daysSinceLastPurchase =
    contact.last_purchase_date
      ? Math.floor((Date.now() - new Date(contact.last_purchase_date).getTime()) / 86400000)
      : null;

  const classification = classifyLead(
    contact.emotional_temp, contact.lead_score, daysSinceLastMessage, daysSinceLastPurchase, recentIntent,
  );
  const purchaseProbability = calcPurchaseProbability(
    contact.emotional_temp, contact.lead_score, daysSinceLastMessage, hasPurchased, daysSinceLastPurchase,
  );
  const churnRisk = calcChurnRisk(
    contact.emotional_temp, contact.relationship_score, daysSinceLastMessage, daysSinceLastPurchase, contact.offer_declined_count, hasPurchased,
  );
  const conversationHealth = calcConversationHealth(contact.emotional_temp, contact.relationship_score, daysSinceLastMessage);
  const lifetimeSpendScore = calcLifetimeSpendScore(contact.total_spent);

  await db
    .prepare(
      `UPDATE contacts SET lead_classification = ?, purchase_probability = ?, churn_risk = ?,
       conversation_health = ?, lifetime_spend_score = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(classification, purchaseProbability, churnRisk, conversationHealth, lifetimeSpendScore, nowIso(), contactId);
}

export async function getBuyerIntelligence(contactId: number): Promise<{
  leadClassification: LeadClassification;
  purchaseProbability: number;
  churnRisk: number;
  conversationHealth: number;
  lifetimeSpendScore: number;
  lastObjection: string | null;
  lastSuccessfulOffer: number | null;
} | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT lead_classification, purchase_probability, churn_risk, conversation_health,
              lifetime_spend_score, last_objection, last_successful_offer
       FROM contacts WHERE id = ?`
    )
    .get(contactId) as {
      lead_classification: string;
      purchase_probability: number;
      churn_risk: number;
      conversation_health: number;
      lifetime_spend_score: number;
      last_objection: string | null;
      last_successful_offer: number | null;
    } | undefined;
  if (!row) return null;
  return {
    leadClassification: row.lead_classification as LeadClassification,
    purchaseProbability: row.purchase_probability,
    churnRisk: row.churn_risk,
    conversationHealth: row.conversation_health,
    lifetimeSpendScore: row.lifetime_spend_score,
    lastObjection: row.last_objection,
    lastSuccessfulOffer: row.last_successful_offer,
  };
}

export async function getAllBuyerIntelligence(): Promise<{
  leadClassification: Record<string, number>;
  atRiskCount: number;
  highPurchaseProbabilityCount: number;
  averageChurnRisk: number;
  averageConversationHealth: number;
}> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT lead_classification, churn_risk, purchase_probability, conversation_health
       FROM contacts`
    )
    .all() as {
      lead_classification: string;
      churn_risk: number;
      purchase_probability: number;
      conversation_health: number;
    }[];
  const classification: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
  let atRiskCount = 0;
  let highPurchaseProbabilityCount = 0;
  let totalChurnRisk = 0;
  let totalConversationHealth = 0;
  for (const r of rows) {
    classification[r.lead_classification] = (classification[r.lead_classification] ?? 0) + 1;
    if (r.churn_risk >= 50) atRiskCount++;
    if (r.purchase_probability >= 60) highPurchaseProbabilityCount++;
    totalChurnRisk += r.churn_risk;
    totalConversationHealth += r.conversation_health;
  }
  const count = rows.length || 1;
  return {
    leadClassification: classification,
    atRiskCount,
    highPurchaseProbabilityCount,
    averageChurnRisk: Math.round(totalChurnRisk / count),
    averageConversationHealth: Math.round(totalConversationHealth / count),
  };
}

const AUTO_TAG_RULES: Array<{ tag: string; test: (c: { total_spent: number; last_purchase_date: string | null; lead_classification: string; churn_risk: number; purchase_count: number }) => boolean }> = [
  { tag: "big_spender", test: (c) => c.total_spent >= 20000 },
  { tag: "high_spender", test: (c) => c.total_spent >= 5000 },
  { tag: "repeat_buyer", test: (c) => c.purchase_count >= 2 },
  { tag: "first_time_buyer", test: (c) => c.purchase_count === 1 },
  { tag: "recent_buyer", test: (c) => c.last_purchase_date !== null && (Date.now() - new Date(c.last_purchase_date!).getTime()) / 86400000 <= 7 },
  { tag: "hot_lead", test: (c) => c.lead_classification === "hot" },
  { tag: "cold_lead", test: (c) => c.lead_classification === "cold" },
  { tag: "needs_attention", test: (c) => c.churn_risk >= 60 },
];

export async function updateAutoTags(contactId: number): Promise<string[]> {
  const db = await getDb();
  const contact = await db
    .prepare(
      `SELECT c.total_spent, c.last_purchase_date, c.lead_classification, c.churn_risk,
              (SELECT COUNT(*) FROM purchases p WHERE p.contact_id = c.id) AS purchase_count
       FROM contacts c WHERE c.id = ?`
    )
    .get(contactId) as {
      total_spent: number;
      last_purchase_date: string | null;
      lead_classification: string;
      churn_risk: number;
      purchase_count: number;
    } | undefined;
  if (!contact) return [];

  const existingTags = new Set(await getTagsForContact(contactId));
  const applied: string[] = [];
  const ts = nowIso();

  for (const rule of AUTO_TAG_RULES) {
    if (rule.test(contact) && !existingTags.has(rule.tag)) {
      try {
        await db
          .prepare("INSERT INTO tags (contact_id, name, created_at) VALUES (?, ?, ?)")
          .run(contactId, rule.tag, ts);
        await db
          .prepare("INSERT INTO tag_events (contact_id, tag_name, event_type, created_at) VALUES (?, ?, 'added', ?)")
          .run(contactId, rule.tag, ts);
        applied.push(rule.tag);
      } catch {
        // tag may already exist from concurrent call
      }
    } else if (!rule.test(contact) && existingTags.has(rule.tag)) {
      await db
        .prepare("DELETE FROM tags WHERE contact_id = ? AND name = ?")
        .run(contactId, rule.tag);
      await db
        .prepare("INSERT INTO tag_events (contact_id, tag_name, event_type, created_at) VALUES (?, ?, 'removed', ?)")
        .run(contactId, rule.tag, ts);
    }
  }

  return applied;
}

export async function generateConversationSummary(contactId: number): Promise<string> {
  const db = await getDb();
  const conv = await db
    .prepare("SELECT id FROM conversations WHERE contact_id = ?")
    .get(contactId) as { id: number } | undefined;
  if (!conv) {
    await db.prepare("UPDATE contacts SET ai_conversation_summary = '', updated_at = ? WHERE id = ?")
      .run(nowIso(), contactId);
    return "";
  }

  const recentMsgs = await db
    .prepare(
      `SELECT text, direction, created_at FROM messages
       WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(conv.id) as { text: string; direction: string; created_at: string }[];

  if (recentMsgs.length === 0) {
    await db.prepare("UPDATE contacts SET ai_conversation_summary = '', updated_at = ? WHERE id = ?")
      .run(nowIso(), contactId);
    return "";
  }

  const incoming = recentMsgs.filter((m) => m.direction === "incoming").map((m) => m.text.toLowerCase());

  const topics: string[] = [];
  if (incoming.some((t) => /buy|price|cost|pay|premium|link|how much|kitna|chahiye/.test(t))) topics.push("purchase_intent");
  if (incoming.some((t) => /too much|expensive|costly|nahi|no|not now/.test(t))) topics.push("objection");
  if (incoming.some((t) => /photo|pic|video|content|exclusive|see/.test(t))) topics.push("content_request");
  if (incoming.some((t) => /hi|hello|hey|how are you|kaise|kya/.test(t))) topics.push("casual");
  if (incoming.some((t) => /custom|meet|call|voice|personal/.test(t))) topics.push("custom_request");

  const sentimentLabel =
    incoming.filter((t) => /love|amazing|beautiful|yes|ok|sure|done|thanks/.test(t)).length >
    incoming.filter((t) => /no|nahi|not|stop|leave|bye/.test(t)).length
      ? "positive" : incoming.length > 0 ? "neutral" : "none";

  const msgCount = recentMsgs.length;
  const contactMsgs = incoming.length;
  const lastTopic = incoming.length > 0 ? incoming[0].slice(0, 80) : "none";

  const summary =
    `${msgCount}msgs, ${contactMsgs} from contact. ` +
    `Topics: ${topics.length > 0 ? topics.join(", ") : "general"}. ` +
    `Sentiment: ${sentimentLabel}. ` +
    `Last: "${lastTopic}${lastTopic.length >= 80 ? "..." : ""}"`;

  await db
    .prepare("UPDATE contacts SET ai_conversation_summary = ?, updated_at = ? WHERE id = ?")
    .run(summary, nowIso(), contactId);

  return summary;
}

export async function suggestNextAction(contactId: number): Promise<string> {
  const db = await getDb();
  const contact = await db
    .prepare(
      `SELECT lead_classification, purchase_probability, churn_risk, conversation_health,
              total_spent, emotional_temp, last_objection, conv_state
       FROM contacts WHERE id = ?`
    )
    .get(contactId) as {
      lead_classification: string;
      purchase_probability: number;
      churn_risk: number;
      conversation_health: number;
      total_spent: number;
      emotional_temp: number;
      last_objection: string | null;
      conv_state: string;
    } | undefined;
  if (!contact) return "";

  const conv = await db
    .prepare("SELECT id FROM conversations WHERE contact_id = ?")
    .get(contactId) as { id: number } | undefined;

  let daysSinceLastMessage: number | null = null;
  if (conv) {
    const lastMsg = await db
      .prepare("SELECT created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(conv.id) as { created_at: string } | undefined;
    if (lastMsg) {
      daysSinceLastMessage = Math.floor((Date.now() - new Date(lastMsg.created_at).getTime()) / 86400000);
    }
  }

  const hasPurchased = contact.total_spent > 0;
  let action = "";

  if (contact.last_objection) {
    action = `Address objection: "${contact.last_objection}"`;
  } else if (!hasPurchased && contact.lead_classification === "hot" && contact.purchase_probability >= 50) {
    action = "Send purchase offer — high intent detected";
  } else if (!hasPurchased && daysSinceLastMessage !== null && daysSinceLastMessage >= 3) {
    action = "Re-engage prospect — no recent activity";
  } else if (contact.conversation_health < 30) {
    action = "Repair relationship — low conversation health";
  } else if (contact.churn_risk >= 50 && hasPurchased) {
    action = "Send re-engagement offer — high churn risk";
  } else if (!hasPurchased && contact.emotional_temp >= 55) {
    action = "Capitalize on positive sentiment — introduce offer";
  } else if (hasPurchased && daysSinceLastMessage !== null && daysSinceLastMessage <= 3) {
    action = "Follow up on recent purchase experience";
  } else if (!hasPurchased) {
    action = "Continue building rapport — nurture conversation";
  } else {
    action = "Maintain engagement — casual check-in";
  }

  await db
    .prepare("UPDATE contacts SET suggested_next_action = ?, updated_at = ? WHERE id = ?")
    .run(action, nowIso(), contactId);

  return action;
}

export async function updateFavoriteContentType(contactId: number): Promise<string> {
  const db = await getDb();
  const purchases = await db
    .prepare("SELECT note FROM purchases WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10")
    .all(contactId) as { note: string }[];

  const typeKeywords: Record<string, RegExp[]> = {
    photos: [/photo/i, /pic/i, /image/i, /gallery/i, /picture/i],
    videos: [/video/i, /clip/i, /recording/i, /movie/i],
    custom: [/custom/i, /personal/i, /exclusive/i, /special/i],
    voice: [/voice/i, /audio/i, /call/i],
  };

  const scores: Record<string, number> = {};
  for (const p of purchases) {
    for (const [type, patterns] of Object.entries(typeKeywords)) {
      for (const re of patterns) {
        if (re.test(p.note)) {
          scores[type] = (scores[type] ?? 0) + 1;
        }
      }
    }
  }

  const entries = Object.entries(scores);
  const favorite = entries.length > 0 ? entries.sort((a, b) => b[1] - a[1])[0][0] : "general";

  await db
    .prepare("UPDATE contacts SET favorite_content_type = ?, updated_at = ? WHERE id = ?")
    .run(favorite, nowIso(), contactId);

  return favorite;
}

export async function recalculateContactHealth(contactId: number): Promise<number> {
  const db = await getDb();
  const contact = await db
    .prepare(
      `SELECT conversation_health, churn_risk, emotional_temp, lifetime_spend_score
       FROM contacts WHERE id = ?`
    )
    .get(contactId) as {
      conversation_health: number;
      churn_risk: number;
      emotional_temp: number;
      lifetime_spend_score: number;
    } | undefined;
  if (!contact) return 50;

  const health = Math.round(
    contact.conversation_health * 0.4 +
    (100 - contact.churn_risk) * 0.3 +
    contact.emotional_temp * 0.2 +
    contact.lifetime_spend_score * 0.1
  );

  const clamped = Math.min(100, Math.max(0, health));
  await db
    .prepare("UPDATE contacts SET contact_health = ?, updated_at = ? WHERE id = ?")
    .run(clamped, nowIso(), contactId);

  return clamped;
}

export async function recalculateCrmIntelligence(contactId: number): Promise<void> {
  await Promise.all([
    updateAutoTags(contactId),
    generateConversationSummary(contactId),
    suggestNextAction(contactId),
    updateFavoriteContentType(contactId),
    recalculateContactHealth(contactId),
  ]);
}

export async function getCrmIntelligence(contactId: number): Promise<{
  tags: string[];
  aiConversationSummary: string;
  suggestedNextAction: string;
  favoriteContentType: string;
  contactHealth: number;
  lastObjection: string | null;
  notes: string;
} | null> {
  const db = await getDb();
  const contact = await db
    .prepare(
      `SELECT ai_conversation_summary, suggested_next_action, favorite_content_type,
              contact_health, last_objection
       FROM contacts WHERE id = ?`
    )
    .get(contactId) as {
      ai_conversation_summary: string | null;
      suggested_next_action: string | null;
      favorite_content_type: string;
      contact_health: number;
      last_objection: string | null;
    } | undefined;
  if (!contact) return null;

  const [tags, notesText] = await Promise.all([
    getTagsForContact(contactId),
    getNotesText(contactId),
  ]);

  return {
    tags,
    aiConversationSummary: contact.ai_conversation_summary ?? "",
    suggestedNextAction: contact.suggested_next_action ?? "",
    favoriteContentType: contact.favorite_content_type,
    contactHealth: contact.contact_health,
    lastObjection: contact.last_objection,
    notes: notesText,
  };
}

export async function getAllCrmIntelligence(): Promise<{
  autoTagCounts: Record<string, number>;
  averageHealth: number;
  commonNextActions: Record<string, number>;
  contactsWithObjections: number;
  contactCount: number;
}> {
  const db = await getDb();
  const contacts = await db
    .prepare("SELECT id, contact_health, suggested_next_action, last_objection FROM contacts")
    .all() as { id: number; contact_health: number; suggested_next_action: string | null; last_objection: string | null }[];

  const tags = await db
    .prepare("SELECT name FROM tags WHERE name IN (?, ?, ?, ?, ?, ?, ?, ?)")
    .all("big_spender", "high_spender", "repeat_buyer", "first_time_buyer", "recent_buyer", "hot_lead", "cold_lead", "needs_attention") as { name: string }[];

  const autoTagCounts: Record<string, number> = {};
  for (const t of tags) autoTagCounts[t.name] = (autoTagCounts[t.name] ?? 0) + 1;

  const commonNextActions: Record<string, number> = {};
  let totalHealth = 0;
  let contactsWithObjections = 0;

  for (const c of contacts) {
    totalHealth += c.contact_health;
    if (c.suggested_next_action) {
      commonNextActions[c.suggested_next_action] = (commonNextActions[c.suggested_next_action] ?? 0) + 1;
    }
    if (c.last_objection) contactsWithObjections++;
  }

  return {
    autoTagCounts,
    averageHealth: contacts.length > 0 ? Math.round(totalHealth / contacts.length) : 50,
    commonNextActions,
    contactsWithObjections,
    contactCount: contacts.length,
  };
}

export async function enqueueFailedAction(
  actionType: string,
  contactId: number,
  error: string,
  payload?: string,
  maxRetries: number = 3,
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO failed_actions (action_type, contact_id, payload, error, retry_count, max_retries, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    )
    .run(actionType, contactId, payload ?? null, error, maxRetries, nowIso());
}

export async function dequeueFailedActions(limit: number = 50): Promise<{
  id: number;
  actionType: string;
  contactId: number;
  payload: string | null;
  error: string;
  retryCount: number;
}[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT id, action_type, contact_id, payload, error, retry_count
       FROM failed_actions
       WHERE resolved_at IS NULL AND retry_count < max_retries
       ORDER BY created_at ASC LIMIT ?`
    )
    .all(limit) as {
      id: number;
      action_type: string;
      contact_id: number;
      payload: string | null;
      error: string;
      retry_count: number;
    }[];
  return rows.map((r) => ({
    id: r.id,
    actionType: r.action_type,
    contactId: r.contact_id,
    payload: r.payload,
    error: r.error,
    retryCount: r.retry_count,
  }));
}

export async function completeFailedAction(id: number, success: boolean): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  if (success) {
    await db
      .prepare("UPDATE failed_actions SET resolved_at = ?, last_retry_at = ? WHERE id = ?")
      .run(ts, ts, id);
  } else {
    await db
      .prepare("UPDATE failed_actions SET retry_count = retry_count + 1, last_retry_at = ? WHERE id = ?")
      .run(ts, id);
  }
}

export async function getFailedActionStats(): Promise<{
  pending: number;
  resolved: number;
  stale: number;
  byType: Record<string, number>;
}> {
  const db = await getDb();
  const pending = (await db
    .prepare("SELECT COUNT(*) AS count FROM failed_actions WHERE resolved_at IS NULL AND retry_count < max_retries")
    .get() as { count: number }).count;
  const resolved = (await db
    .prepare("SELECT COUNT(*) AS count FROM failed_actions WHERE resolved_at IS NOT NULL")
    .get() as { count: number }).count;
  const stale = (await db
    .prepare("SELECT COUNT(*) AS count FROM failed_actions WHERE resolved_at IS NULL AND retry_count >= max_retries")
    .get() as { count: number }).count;
  const byTypeRows = await db
    .prepare("SELECT action_type, COUNT(*) AS count FROM failed_actions WHERE resolved_at IS NULL GROUP BY action_type")
    .all() as { action_type: string; count: number }[];
  const byType: Record<string, number> = {};
  for (const r of byTypeRows) byType[r.action_type] = r.count;
  return { pending, resolved, stale, byType };
}


