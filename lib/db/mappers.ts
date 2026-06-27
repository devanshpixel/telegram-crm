import type {
  Chat,
  ContactProfile,
  DashboardStats,
  Media,
  Message,
  Purchase,
} from "@/types";
import type { ChatListRow, ContactRow, MediaRow, MessageRow, PurchaseRow } from "./types";

export function mapChatRow(row: ChatListRow, tags: string[]): Chat {
  return {
    id: String(row.id),
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    lastMessage: row.last_message,
    lastMessageTime: row.last_message_time,
    unreadCount: row.unread_count,
    isOnline: row.is_online === 1,
    isPinned: row.is_pinned === 1,
    revenue: row.revenue,
    tags,
    convState: row.conv_state as Chat["convState"],
    leadScore: row.lead_score,
    leadStatus: row.lead_status,
  };
}


export function mapContactToProfile(
  contact: ContactRow,
  tags: string[],
  notesText: string,
): ContactProfile {
  return {
    id: String(contact.id),
    name: contact.name,
    username: contact.username,
    avatar: contact.avatar,
    avatarColor: contact.avatar_color,
    phone: contact.phone,
    email: contact.email,
    company: contact.company,
    location: contact.location,
    joinedAt: contact.joined_at,
    notes: notesText,
    tags,
    revenue: contact.revenue,
    revenueTrend: contact.revenue_trend as ContactProfile["revenueTrend"],
    leadScore: contact.lead_score,
    leadStatus: contact.lead_status as ContactProfile["leadStatus"],
    lastActivity: contact.is_online === 1 ? "Active now" : "Recently",
    isOnline: contact.is_online === 1,
    ppvCount: contact.ppv_count,
    totalSpent: contact.total_spent,
    vipLevel: contact.vip_level as ContactProfile["vipLevel"],
    fanStatus: contact.fan_status as ContactProfile["fanStatus"],
    fanScore: contact.fan_score,
    lastPurchaseDate: contact.last_purchase_date,
    leadClassification: contact.lead_classification as ContactProfile["leadClassification"],
    purchaseProbability: contact.purchase_probability,
    churnRisk: contact.churn_risk,
    conversationHealth: contact.conversation_health,
    lifetimeSpendScore: contact.lifetime_spend_score,
    lastObjection: contact.last_objection,
    lastSuccessfulOffer: contact.last_successful_offer,
  };
}

export function mapMessageRow(row: MessageRow): Message {
  return {
    id: String(row.id),
    text: row.text,
    direction: row.direction,
    timestamp: row.created_at,
    read: row.is_read === 1,
  };
}


export function mapDashboardStats(
  totalChats: number,
  onlineCount: number,
  totalRevenue: number,
  unreadTotal: number,
): DashboardStats {
  return { totalChats, onlineCount, totalRevenue, unreadTotal };
}

export function mapPurchaseRow(row: PurchaseRow): Purchase {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    amount: row.amount,
    purchaseDate: row.purchase_date,
    note: row.note,
    kind: row.kind,
  };
}

export function mapMediaRow(row: MediaRow): Media {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    price: row.price,
    createdAt: row.created_at,
  };
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
