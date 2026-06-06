export interface ContactRow {
  id: number;
  name: string;
  username: string;
  avatar: string;
  avatar_color: string;
  phone: string;
  email: string;
  company: string;
  location: string;
  joined_at: string;
  revenue: number;
  revenue_trend: string;
  lead_score: number;
  lead_status: string;
  is_online: number;
  ppv_count: number;
  telegram_id: string | null;
  telegram_access_hash: string | null;
  total_spent: number;
  vip_level: string;
  fan_status: string;
  fan_score: number;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: number;
  contact_id: number;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_pinned: number;
  last_synced_message_id: number;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: number;
  conversation_id: number;
  text: string;
  direction: "incoming" | "outgoing";
  is_read: number;
  telegram_message_id: number | null;
  created_at: string;
}

export interface TagRow {
  id: number;
  contact_id: number;
  name: string;
  created_at: string;
}

export interface NoteRow {
  id: number;
  contact_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRow {
  id: number;
  contact_id: number;
  amount: number;
  purchase_date: string;
  note: string;
  kind: string;
  created_at: string;
}

export interface BroadcastRow {
  id: number;
  name: string;
  message: string;
  recipient_count: number;
  sent_count: number;
  trigger: string | null;
  created_at: string;
}

export interface ChatListRow extends ContactRow {
  conversation_id: number;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_pinned: number;
}
