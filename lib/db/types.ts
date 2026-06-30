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
  offer_sent: number;
  conv_state: string;
  offer_sent_at: string | null;
  last_locked_response_at: string | null;
  emotional_temp: number;
  relationship_score: number;
  offer_declined_count: number;
  offer_cooldown_until: string | null;
  paid_at: string | null;
  post_purchase_welcome_sent: number;
  last_upsell_at: string | null;
  upsell_count: number;
  spend_segment: string;
  lead_classification: string;
  purchase_probability: number;
  churn_risk: number;
  conversation_health: number;
  lifetime_spend_score: number;
  last_objection: string | null;
  last_successful_offer: number | null;
  ai_conversation_summary: string | null;
  suggested_next_action: string | null;
  favorite_content_type: string;
  contact_health: number;
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

export interface PurchaseRow {
  id: number;
  contact_id: number;
  amount: number;
  purchase_date: string;
  note: string;
  kind: string;
  payment_id: string | null;
  created_at: string;
}

export interface MediaRow {
  id: number;
  contact_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  price: number;
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
