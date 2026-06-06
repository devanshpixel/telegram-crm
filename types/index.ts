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

export interface Purchase {
  id: string;
  contactId: string;
  amount: number;
  purchaseDate: string;
  note: string;
  kind: string;
}

export interface DashboardStats {
  totalChats: number;
  onlineCount: number;
  totalRevenue: number;
  unreadTotal: number;
}

export interface MonthlyRevenue {
  month: string;
  total: number;
  count: number;
}

export interface TopSpender {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
  totalSpent: number;
  purchaseCount: number;
}

export interface RevenueData {
  monthly: MonthlyRevenue[];
  topSpenders: TopSpender[];
}

export interface PpvStats {
  totalRevenue: number;
  purchaseCount: number;
  uniqueBuyers: number;
  topBuyers: TopSpender[];
}

export interface FollowUpListItem {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
  hint: string;
}

export interface FollowUpList {
  key: string;
  title: string;
  description: string;
  count: number;
  items: FollowUpListItem[];
}

export interface FollowUpData {
  lists: FollowUpList[];
}

export type BroadcastVipLevel =
  | ""
  | "none"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum";

export type BroadcastFanStatus =
  | ""
  | "active"
  | "inactive"
  | "churned"
  | "new";

export interface BroadcastFilters {
  tags?: string[];
  vipLevel?: BroadcastVipLevel;
  fanStatus?: BroadcastFanStatus;
  minTotalSpent?: number;
  minFanScore?: number;
}

export interface BroadcastAudiencePreview {
  count: number;
}

export type BroadcastTrigger =
  | "no_message_7d"
  | "no_purchase_30d"
  | "vip_inactive_14d"
  | "high_spender_inactive"
  | "no_ppv_30d"
  | "never_purchased";

export interface Broadcast {
  id: string;
  name: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  trigger?: BroadcastTrigger | null;
  createdAt: string;
}

export interface CreateBroadcastInput {
  name: string;
  message: string;
  filters: BroadcastFilters;
}

export interface CreateBroadcastResult {
  broadcast: Broadcast;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

export interface ReengagementSendInput {
  name: string;
  message: string;
  segmentKey: BroadcastTrigger;
}

export interface ReengagementSendResult {
  count: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
  broadcast?: Broadcast;
}

export type ReengagementAudiences = Record<BroadcastTrigger, number>;

export interface AnalyticsOverview {
  totalFans: number;
  activeFans: number;
  vipFans: number;
  totalRevenue: number;
  revenueLast30Days: number;
  messagesSent: number;
  messagesReceived: number;
  revenueGrowthPercent: number;
}

export interface VipLevelBreakdown {
  level: string;
  count: number;
}

export interface FanStatusBreakdown {
  status: string;
  count: number;
}

export interface FanScoreStats {
  highest: number;
  average: number;
}

export interface ActiveContact {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
  messageCount: number;
}

export interface InactiveContact {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
  daysSinceActivity: number;
}

export interface RecentPurchaser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
  lastPurchaseDate: string;
  totalSpent: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  fansByVipLevel: VipLevelBreakdown[];
  fansByStatus: FanStatusBreakdown[];
  fanScores: FanScoreStats;
  mostActive: ActiveContact[];
  inactiveContacts: InactiveContact[];
  recentPurchasers: RecentPurchaser[];
}

export type TimelineEventType =
  | "message_in"
  | "message_out"
  | "purchase"
  | "note"
  | "tag_added"
  | "tag_removed";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  text?: string;
  amount?: number;
}
