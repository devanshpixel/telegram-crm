import type {
  AnalyticsData,
  Broadcast,
  BroadcastAudiencePreview,
  BroadcastFilters,
  Chat,
  ContactProfile,
  CreateBroadcastInput,
  CreateBroadcastResult,
  DashboardStats,
  FollowUpData,
  Message,
  MessageDirection,
  PpvStats,
  ReengagementAudiences,
  ReengagementSendInput,
  ReengagementSendResult,
  RevenueData,
  TimelineEvent,
} from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data as T;
}

function reviveChat(chat: Chat): Chat {
  return { ...chat, lastMessageTime: new Date(chat.lastMessageTime) };
}

function reviveMessage(m: Message): Message {
  return { ...m, timestamp: new Date(m.timestamp) };
}

export async function fetchChats(): Promise<Chat[]> {
  const data = await parseJson<Chat[]>(await fetch("/api/contacts"));
  return data.map(reviveChat);
}

export async function fetchStats(): Promise<DashboardStats> {
  return parseJson<DashboardStats>(await fetch("/api/stats"));
}

export async function fetchRevenue(
  months: number = 12,
  limit: number = 10,
): Promise<RevenueData> {
  return parseJson<RevenueData>(
    await fetch(`/api/revenue?months=${months}&limit=${limit}`),
  );
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  return parseJson<AnalyticsData>(await fetch("/api/analytics"));
}

export async function fetchPpvStats(limit: number = 10): Promise<PpvStats> {
  return parseJson<PpvStats>(
    await fetch(`/api/purchases/ppv?limit=${limit}`),
  );
}

export async function fetchFollowUps(limit: number = 10): Promise<FollowUpData> {
  return parseJson<FollowUpData>(
    await fetch(`/api/followups?limit=${limit}`),
  );
}

export async function fetchBroadcasts(): Promise<Broadcast[]> {
  return parseJson<Broadcast[]>(await fetch("/api/broadcasts"));
}

export async function previewBroadcastAudience(
  filters: BroadcastFilters,
): Promise<BroadcastAudiencePreview> {
  return parseJson<BroadcastAudiencePreview>(
    await fetch("/api/broadcasts/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters }),
    }),
  );
}

export async function sendBroadcast(
  body: CreateBroadcastInput,
): Promise<CreateBroadcastResult> {
  return parseJson<CreateBroadcastResult>(
    await fetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function fetchReengagementAudiences(): Promise<{
  counts: ReengagementAudiences;
}> {
  return parseJson<{ counts: ReengagementAudiences }>(
    await fetch("/api/reengagement/audiences"),
  );
}

export async function sendReengagementCampaign(
  body: ReengagementSendInput,
): Promise<ReengagementSendResult> {
  return parseJson<ReengagementSendResult>(
    await fetch("/api/reengagement/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function fetchContact(id: string): Promise<ContactProfile> {
  return parseJson<ContactProfile>(await fetch(`/api/contacts/${id}`));
}

export async function fetchMessages(contactId: string): Promise<Message[]> {
  const data = await parseJson<Message[]>(
    await fetch(`/api/contacts/${contactId}/messages`),
  );
  return data.map(reviveMessage);
}

export async function fetchTimeline(
  contactId: string,
  limit: number = 100,
): Promise<TimelineEvent[]> {
  return parseJson<TimelineEvent[]>(
    await fetch(`/api/contacts/${contactId}/timeline?limit=${limit}`),
  );
}

export async function createContactApi(body: {
  name: string;
  username: string;
  phone?: string;
  email?: string;
  company?: string;
  location?: string;
  revenue?: number;
}): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function updateContactApi(
  id: string,
  body: Record<string, unknown>,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteContactApi(id: string): Promise<void> {
  await parseJson<{ success: boolean }>(
    await fetch(`/api/contacts/${id}`, { method: "DELETE" }),
  );
}

export async function addNoteApi(
  contactId: string,
  content: string,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: Number(contactId), content }),
    }),
  );
}

export async function addTagApi(
  contactId: string,
  name: string,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: Number(contactId), name }),
    }),
  );
}

export async function deleteTagApi(
  contactId: string,
  name: string,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch("/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: Number(contactId), name }),
    }),
  );
}

export async function createMessageApi(
  contactId: string,
  text: string,
  direction: MessageDirection = "outgoing",
): Promise<Message> {
  const data = await parseJson<Message>(
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: Number(contactId),
        text,
        direction,
      }),
    }),
  );
  return reviveMessage(data);
}

export interface ContactImportSummary {
  total: number;
  imported: number;
  skipped: number;
}

export async function importTelegramContacts(): Promise<ContactImportSummary> {
  return parseJson<ContactImportSummary>(
    await fetch("/api/telegram/import/contacts", { method: "POST" }),
  );
}

export interface MessageImportSummary {
  contactsProcessed: number;
  contactsCreated: number;
  messagesImported: number;
  messagesSkipped: number;
}

export async function importTelegramMessages(): Promise<MessageImportSummary> {
  return parseJson<MessageImportSummary>(
    await fetch("/api/telegram/import/messages", { method: "POST" }),
  );
}

export interface SendTelegramMessageResult {
  contactId: number;
  telegramMessageId: number;
  text: string;
  sentAt: string;
}

export async function sendTelegramMessageApi(
  contactId: number,
  text: string,
): Promise<SendTelegramMessageResult> {
  return parseJson<SendTelegramMessageResult>(
    await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, text }),
    }),
  );
}
