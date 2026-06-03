import type {
  Chat,
  ContactProfile,
  DashboardStats,
  Message,
} from "@/types";
import type { ChatListRow, ContactRow, MessageRow } from "./types";

export function mapChatRow(row: ChatListRow, tags: string[]): Chat {
  return {
    id: String(row.id),
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    lastMessage: row.last_message,
    lastMessageTime: new Date(row.last_message_time),
    unreadCount: row.unread_count,
    isOnline: row.is_online === 1,
    isPinned: row.is_pinned === 1,
    revenue: row.revenue,
    tags,
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
  };
}

export function mapMessageRow(row: MessageRow): Message {
  return {
    id: String(row.id),
    text: row.text,
    direction: row.direction,
    timestamp: new Date(row.created_at),
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

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
