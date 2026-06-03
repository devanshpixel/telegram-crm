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
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: number;
  conversation_id: number;
  text: string;
  direction: "incoming" | "outgoing";
  is_read: number;
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

export interface ChatListRow extends ContactRow {
  conversation_id: number;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_pinned: number;
}
