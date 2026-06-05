export type MessageDirection = "incoming" | "outgoing";

export interface Message {
  id: string;
  text: string;
  direction: MessageDirection;
  timestamp: Date;
  read?: boolean;
}

export interface Chat {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
  isPinned?: boolean;
  revenue: number;
  tags: string[];
}

export interface ContactProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
  phone: string;
  email: string;
  company: string;
  location: string;
  joinedAt: string;
  notes: string;
  tags: string[];
  revenue: number;
  revenueTrend: "up" | "down" | "flat";
  leadScore: number;
  leadStatus: "hot" | "warm" | "cold";
  lastActivity: string;
  isOnline: boolean;
  ppvCount?: number;
  totalSpent: number;
  vipLevel: "none" | "bronze" | "silver" | "gold" | "platinum";
  fanStatus: "active" | "inactive" | "churned" | "new";
  fanScore: number;
  lastPurchaseDate: string | null;
}

export interface DashboardStats {
  totalChats: number;
  onlineCount: number;
  totalRevenue: number;
  unreadTotal: number;
}
