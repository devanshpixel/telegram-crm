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

export async function getMessagesByContactId(contactId: number): Promise<Message[]> {
  const conversationId = await getConversationIdByContactId(contactId);
  if (!conversationId) return [];

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

  const rows = await db
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
        await getFollowUpHighSpenderInactive(200, 30, capped),
      );
    case "no_ppv_30d":
      return audienceToRecipients(await getFollowUpNoPpvInDays(30, capped));
    case "never_purchased":
      return audienceToRecipients(await getFollowUpNeverPurchased(capped));
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
             WHERE total_spent >= 200
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
             LEFT JOIN purchases p ON p.contact_id = c.id
             WHERE p.id IS NULL`,
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
    mapFollowUpRow({ ...r, hint_value: `$${r.total_spent.toFixed(0)}` }),
  );
}

async function getFollowUpNeverPurchased(limit: number): Promise<FollowUpListItem[]> {
  const db = await getDb();
  const rows = await db
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
      description: "Top spenders (≥$200) silent for 30+ days",
      count: 0,
      items: await getFollowUpHighSpenderInactive(200, 30, limit),
    },
    {
      key: "no_ppv_30d",
      title: "No PPV purchase in 30 days",
      description: "Past PPV buyers who stopped unlocking",
      count: 0,
      items: await getFollowUpNoPpvInDays(30, limit),
    },
    {
      key: "never_purchased",
      title: "Never purchased",
      description: "Engaged fans who never bought",
      count: 0,
      items: await getFollowUpNeverPurchased(limit),
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
    score += Math.min(Math.floor(purchaseRow.total / 10), 20); // +1 per $10, max +20
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
