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
  Media,
  Message,
  MessageDirection,
  PpvStats,
  RazorpayOrderResponse,
  ReengagementAudiences,
  ReengagementSendInput,
  ReengagementSendResult,
  ReplyMode,
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

async function crmFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}


export async function fetchChats(): Promise<Chat[]> {
  return parseJson<Chat[]>(await crmFetch("/api/contacts"));
}


export async function fetchStats(): Promise<DashboardStats> {
  return parseJson<DashboardStats>(await crmFetch("/api/stats"));
}

export async function fetchRevenue(
  months: number = 12,
  limit: number = 10,
): Promise<RevenueData> {
  return parseJson<RevenueData>(
    await crmFetch(`/api/revenue?months=${months}&limit=${limit}`),
  );
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  return parseJson<AnalyticsData>(await crmFetch("/api/analytics"));
}

export async function fetchPpvStats(limit: number = 10): Promise<PpvStats> {
  return parseJson<PpvStats>(
    await crmFetch(`/api/purchases/ppv?limit=${limit}`),
  );
}

export async function fetchFollowUps(limit: number = 10): Promise<FollowUpData> {
  return parseJson<FollowUpData>(
    await crmFetch(`/api/followups?limit=${limit}`),
  );
}

export async function fetchBroadcasts(): Promise<Broadcast[]> {
  return parseJson<Broadcast[]>(await crmFetch("/api/broadcasts"));
}

export async function previewBroadcastAudience(
  filters: BroadcastFilters,
): Promise<BroadcastAudiencePreview> {
  return parseJson<BroadcastAudiencePreview>(
    await crmFetch("/api/broadcasts/audience", {
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
    await crmFetch("/api/broadcasts", {
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
    await crmFetch("/api/reengagement/audiences"),
  );
}

export async function sendReengagementCampaign(
  body: ReengagementSendInput,
): Promise<ReengagementSendResult> {
  return parseJson<ReengagementSendResult>(
    await crmFetch("/api/reengagement/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function fetchContact(id: string): Promise<ContactProfile> {
  return parseJson<ContactProfile>(await crmFetch(`/api/contacts/${id}`));
}

export async function fetchMessages(contactId: string): Promise<Message[]> {
  return parseJson<Message[]>(
    await crmFetch(`/api/contacts/${contactId}/messages`),
  );
}


export async function fetchTimeline(
  contactId: string,
  limit: number = 100,
): Promise<TimelineEvent[]> {
  return parseJson<TimelineEvent[]>(
    await crmFetch(`/api/contacts/${contactId}/timeline?limit=${limit}`),
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
    await crmFetch("/api/contacts", {
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
    await crmFetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteContactApi(id: string): Promise<void> {
  await parseJson<{ success: boolean }>(
    await crmFetch(`/api/contacts/${id}`, { method: "DELETE" }),
  );
}

export async function addNoteApi(
  contactId: string,
  content: string,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await crmFetch("/api/notes", {
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
    await crmFetch("/api/tags", {
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
    await crmFetch("/api/tags", {
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
  return parseJson<Message>(
    await crmFetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: Number(contactId),
        text,
        direction,
      }),
    }),
  );
}


export interface ContactImportSummary {
  total: number;
  imported: number;
  skipped: number;
}

export async function importTelegramContacts(): Promise<ContactImportSummary> {
  return parseJson<ContactImportSummary>(
    await crmFetch("/api/telegram/import/contacts", { method: "POST" }),
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
    await crmFetch("/api/telegram/import/messages", { method: "POST" }),
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
    await crmFetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, text }),
    }),
  );
}

export async function telegramSendCode(
  phone: string,
): Promise<{ isCodeViaApp: boolean }> {
  return parseJson<{ isCodeViaApp: boolean }>(
    await crmFetch("/api/telegram/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }),
  );
}

export async function telegramVerifyCode(
  phone: string,
  code: string,
): Promise<{ success: true } | { needs2fa: true; error: string }> {
  return parseJson<{ success: true } | { needs2fa: true; error: string }>(
    await crmFetch("/api/telegram/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    }),
  );
}

export async function telegramStatus(): Promise<{ authenticated: boolean }> {
  return parseJson<{ authenticated: boolean }>(
    await crmFetch("/api/telegram/status"),
  );
}

export async function telegramSignOut(): Promise<{ success: boolean }> {
  return parseJson<{ success: boolean }>(
    await crmFetch("/api/telegram/sign-out", { method: "POST" }),
  );
}

export async function telegramVerifyPassword(
  password: string,
): Promise<{ success: boolean }> {
  return parseJson<{ success: boolean }>(
    await crmFetch("/api/telegram/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),
  );
}

export async function createRazorpayOrder(
  contactId: number,
  amount: number,
): Promise<RazorpayOrderResponse> {
  return parseJson<RazorpayOrderResponse>(
    await crmFetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, amount }),
    }),
  );
}

export async function createMediaUnlockRazorpayOrder(
  contactId: number,
  mediaId: number,
  amount: number,
): Promise<RazorpayOrderResponse> {
  return parseJson<RazorpayOrderResponse>(
    await crmFetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, amount, mediaId }),
    }),
  );
}

export async function uploadMedia(
  contactId: number,
  file: File,
  price?: number,
): Promise<Media> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("contactId", String(contactId));
  if (price !== undefined) formData.append("price", String(price));
  return parseJson<Media>(await crmFetch("/api/media/upload", { method: "POST", body: formData }));
}

export async function fetchContactMedia(contactId: number): Promise<Media[]> {
  return parseJson<Media[]>(await crmFetch(`/api/media?contactId=${contactId}`));
}

export async function fetchMedia(id: string): Promise<Media> {
  return parseJson<Media>(await crmFetch(`/api/media/${id}`));
}

export async function updateMediaPriceApi(id: string, price: number): Promise<Media> {
  return parseJson<Media>(await crmFetch(`/api/media/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ price }),
  }));
}

export async function deleteMediaApi(id: string): Promise<{ success: boolean }> {
  return parseJson<{ success: boolean }>(await crmFetch(`/api/media/${id}`, { method: "DELETE" }));
}

export async function suggestReplyApi(
  contactId: number,
  mode: ReplyMode = "auto",
): Promise<{ suggestion: string }> {
  return parseJson<{ suggestion: string }>(
    await crmFetch("/api/ai/suggest-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, mode }),
    }),
  );
}
