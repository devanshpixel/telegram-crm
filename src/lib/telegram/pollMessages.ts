import bigInt from "big-integer";
import { Api } from "telegram";
import { getDb, nowIso } from "@/lib/db";
import {
  createContact,
  createMessage,
  getMessagesByContactId,
  getSetting,
  updateSetting,
  recalculateLeadScore,
} from "@/lib/db/service";
import type { ConversationRow } from "@/lib/db/types";
import type { ConvState, ReplyMode } from "@/types";
import { razorpay } from "@/lib/razorpay";
import { suggestReply } from "@/lib/ai/suggest-reply";
import { getAppUrl } from "@/lib/app-url";
import { getTelegramClient } from "./client";
import { sendTelegramMessage } from "./sendMessage";

const MAX_DIALOGS_PER_POLL = 500;
// Keep under the Vercel function maxDuration (60s) so the poll exits cleanly
// and releases the lock before the platform kills the invocation.
const POLL_TIMEOUT_MS = 50000;

export interface PollSummary {
  dialogsChecked: number;
  newMessages: number;
  repliesSent: number;
  offersSent: number;
  remindersSent: number;
  errors: string[];
}

export async function ensureConnected(): Promise<void> {
  const client = await getTelegramClient();
  if (!client.connected) {
    await client.connect();
  }
}

function buildPeer(telegramId: string, accessHash: string): Api.InputPeerUser {
  return new Api.InputPeerUser({
    userId: bigInt(telegramId),
    accessHash: bigInt(accessHash),
  });
}

function formatUserName(user: Api.User): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.username || `User ${user.id}`;
}

function formatUsername(user: Api.User): string {
  return user.username ?? `user_${user.id}`;
}

interface ContactWithConv {
  id: number;
  telegram_id: string;
  telegram_access_hash: string;
  conversation_id: number;
  last_synced_message_id: number;
  conv_state: ConvState;
  offer_sent_at: string | null;
}

async function listContactConversations(): Promise<ContactWithConv[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.telegram_id, c.telegram_access_hash, c.conv_state, c.offer_sent_at,
              conv.id AS conversation_id, conv.last_synced_message_id
       FROM contacts c
       INNER JOIN conversations conv ON conv.contact_id = c.id
       WHERE c.telegram_id IS NOT NULL AND c.telegram_access_hash IS NOT NULL`,
    )
    .all() as ContactWithConv[];
  return rows;
}

async function getConversationByContactId(
  contactId: number,
): Promise<ConversationRow | undefined> {
  const db = await getDb();
  return (await db
    .prepare("SELECT * FROM conversations WHERE contact_id = ?")
    .get(contactId)) as ConversationRow | undefined;
}

async function updateSyncCursor(
  conversationId: number,
  lastSyncedMessageId: number,
): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db
    .prepare(
      "UPDATE conversations SET last_synced_message_id = ?, updated_at = ? WHERE id = ?",
    )
    .run(lastSyncedMessageId, ts, conversationId);
}

async function hasUserPaid(contactId: number): Promise<boolean> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT COUNT(*) AS count FROM purchases WHERE contact_id = ?")
    .get(contactId)) as { count: number };
  return (row?.count ?? 0) > 0;
}

async function setConvState(
  contactId: number,
  state: ConvState,
  offerSentAt?: string,
): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  if (offerSentAt) {
    await db
      .prepare(
        "UPDATE contacts SET conv_state = ?, offer_sent_at = ?, offer_sent = 1, updated_at = ? WHERE id = ?",
      )
      .run(state, offerSentAt, ts, contactId);
  } else {
    await db
      .prepare("UPDATE contacts SET conv_state = ?, updated_at = ? WHERE id = ?")
      .run(state, ts, contactId);
  }
}

async function getOfferSettings() {
  const [offerPrice, offerMessage, aiMode, automatedReplies] = await Promise.all([
    getSetting("offerPrice", 499),
    getSetting("offerMessage", "Hey! You've been enjoying the chat so here's something special 🔥\n\nUnlock premium access for exclusive content, behind-the-scenes, and unlimited chat."),
    getSetting<ReplyMode>("aiMode", "auto"),
    getSetting<boolean>("automatedReplies", true),
  ]);
  return { offerPrice, offerMessage, aiMode, automatedReplies };
}

function hoursSince(isoString: string | null): number {
  if (!isoString) return Infinity;
  const then = new Date(isoString).getTime();
  const now = Date.now();
  return (now - then) / 3_600_000;
}

async function createContactFromDialog(entity: Api.User): Promise<ContactWithConv> {
  const accessHash = entity.accessHash?.toString();
  const telegramId = entity.id.toString();
  await createContact({
    name: formatUserName(entity),
    username: formatUsername(entity),
    phone: entity.phone ?? "",
    telegramId,
    telegramAccessHash: accessHash ?? "",
  });
  
  const db = await getDb();
  const row = await db.prepare(
    `SELECT c.id, c.telegram_id, c.telegram_access_hash, c.conv_state, c.offer_sent_at,
            conv.id AS conversation_id, conv.last_synced_message_id
     FROM contacts c
     INNER JOIN conversations conv ON conv.contact_id = c.id
     WHERE c.telegram_id = ?`
  ).get(telegramId) as ContactWithConv | undefined;

  if (!row) throw new Error("Failed to retrieve created contact");
  return row;
}

async function sendAiReply(
  contactId: number,
  mode: ReplyMode = "casual",
): Promise<{ offerSent: boolean }> {
  const messages = await getMessagesByContactId(contactId);
  const recent = messages.slice(-20);
  let reply = await suggestReply(recent, mode);

  // The AI persona emits a literal "[LINK]" token when it decides to convert
  // the fan (sales/conversion phase). Nothing else substitutes it, so we MUST
  // replace it with a real payment link here — otherwise the fan receives a
  // dead "[LINK]" placeholder and can never pay (lost sale on the hottest lead).
  if (reply.includes("[LINK]")) {
    try {
      const link = await createPaymentLink(contactId);
      reply = reply.replace(/\[LINK\]/g, link).trim();
      await sendTelegramMessage(contactId, reply);
      await setConvState(contactId, "OFFER_SENT", nowIso());
      return { offerSent: true };
    } catch (e) {
      // Never ship the raw placeholder. Strip it and send a clean nudge.
      console.error(
        `[POLL] Payment link creation failed during [LINK] substitution (contact ${contactId}):`,
        e,
      );
      reply = reply.replace(/\[LINK\]/g, "").replace(/\s{2,}/g, " ").trim();
      if (!reply) reply = "ek sec babe... sending you something 💫";
    }
  }

  await sendTelegramMessage(contactId, reply);
  return { offerSent: false };
}

export async function createPaymentLink(
  contactId: number,
  overrideAmount?: number,
): Promise<string> {
  if (!razorpay) throw new Error("Razorpay not configured");
  const appUrl = getAppUrl();
  const settings = await getOfferSettings();
  const amount = overrideAmount ?? settings.offerPrice;
  const paymentLink = await razorpay.paymentLink.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    description: "Premium Chat Unlock",
    customer: { name: "Fan" },
    notes: { contactId: String(contactId) },
    callback_url: `${appUrl}?checkout=success`,
    callback_method: "get",
  });
  return (paymentLink as { short_url: string }).short_url;
}

async function sendPremiumOffer(contactId: number): Promise<void> {
  const settings = await getOfferSettings();
  const link = await createPaymentLink(contactId, settings.offerPrice);
  const text = `${settings.offerMessage}\n\n👉 ${link}`;
  await sendTelegramMessage(contactId, text);
  await setConvState(contactId, "OFFER_SENT", nowIso());
}


export async function sendLockedResponse(contactId: number): Promise<void> {
  const link = await createPaymentLink(contactId);
  const text = `Premium chat is locked. Unlock here: ${link}`;
  await sendTelegramMessage(contactId, text);
  const db = await getDb();
  const ts = nowIso();
  await db
    .prepare("UPDATE contacts SET last_locked_response_at = ?, updated_at = ? WHERE id = ?")
    .run(ts, ts, contactId);
}

async function shouldSendLockedResponse(contactId: number): Promise<boolean> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT last_locked_response_at FROM contacts WHERE id = ?")
    .get(contactId)) as { last_locked_response_at: string | null } | undefined;
  if (!row?.last_locked_response_at) return true;
  const h = hoursSince(row.last_locked_response_at);
  return h >= 24;
}

function hasPurchaseIntent(text: string): boolean {
  // Must cover every "ready to buy" signal, including the ones the AI's own
  // sales-mode detector reacts to (cost, pay, kitna, how much, join, link,
  // membership). Otherwise those messages skip the clean offer path and fall
  // through to the AI, which would emit the "[LINK]" conversion token.
  const keywords = [
    "buy", "price", "cost", "pay", "payment", "premium", "vip", "exclusive",
    "subscription", "membership", "unlock", "join", "link", "how much",
    "kitna", "kitne", "video", "content",
  ];
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

async function checkOfferExpiry(contactId: number, offerSentAt: string | null): Promise<boolean> {
  if (!offerSentAt) return false;
  const days = (Date.now() - new Date(offerSentAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days >= 7) {
    await setConvState(contactId, "FREE_CHAT");
    return true;
  }
  return false;
}

async function getLockStatus(): Promise<{ isPolling: boolean, lastUpdated: string | null }> {
  try {
    const db = await getDb();
    const row = await db.prepare("SELECT value, updated_at FROM settings WHERE key = 'is_polling'").get() as { value: string, updated_at: string } | undefined;
    if (!row) return { isPolling: false, lastUpdated: null };
    try {
      return { isPolling: JSON.parse(row.value), lastUpdated: row.updated_at };
    } catch {
      console.warn("[Poll] Invalid JSON in is_polling setting, recovering with default false");
      return { isPolling: false, lastUpdated: row.updated_at };
    }
  } catch (e) {
    // If DB is locked or table missing, rethrow to be caught by the main poll loop
    throw e;
  }
}

export async function pollIncomingMessages(): Promise<PollSummary> {
  const summary: PollSummary = {
    dialogsChecked: 0,
    newMessages: 0,
    repliesSent: 0,
    offersSent: 0,
    remindersSent: 0,
    errors: [],
  };

  const startTime = Date.now();

  // Read operator-controlled settings once before the poll loop
  const offerSettings = await getOfferSettings();
  const { automatedReplies, aiMode } = offerSettings;

  try {
    // Task: Prevent concurrent polls with stale lock protection - Now inside try/catch
    try {
      const lock = await getLockStatus();
      if (lock.isPolling && lock.lastUpdated) {
        const lockAgeMs = Date.now() - new Date(lock.lastUpdated).getTime();
        if (lockAgeMs < 5 * 60 * 1000) { // 5 minute timeout
          console.warn("[Poll] Another poll is already in progress, skipping");
          return summary;
        } else {
          console.warn("[Poll] Stale lock detected, overriding");
        }
      }
    } catch (e) {
      summary.errors.push(`Lock check failed: ${e instanceof Error ? e.message : String(e)}`);
      return summary;
    }

    try {
      await updateSetting("is_polling", true);
    } catch (e) {
      summary.errors.push(`Failed to set polling lock: ${e instanceof Error ? e.message : String(e)}`);
      return summary;
    }

    try {
      await ensureConnected();
      const client = await getTelegramClient();

      await client.getMe(); // validate session is alive

      const knownContacts = await listContactConversations();
      const knownMap = new Map<string, ContactWithConv>();
      for (const c of knownContacts) {
        knownMap.set(c.telegram_id, c);
      }

      for await (const dialog of client.iterDialogs()) {
        const entity = dialog.entity;

        // Skip non-users, bots, self early before counting against the quota
        if (!(entity instanceof Api.User)) {
          continue;
        }
        if (entity.bot) {
          continue;
        }
        if (entity.deleted) {
          continue;
        }
        if (entity.self) {
          continue;
        }

        if (summary.dialogsChecked >= MAX_DIALOGS_PER_POLL) break;
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          console.warn("[Poll] Timeout reached, stopping poll loop");
          break;
        }

        summary.dialogsChecked++;

        const telegramId = entity.id.toString();
        let contact = knownMap.get(telegramId);

        if (!contact) {
          try {
            contact = await createContactFromDialog(entity);
            knownMap.set(telegramId, contact);
          } catch (e) {
            summary.errors.push(
              `Failed to create contact for ${telegramId}: ${e instanceof Error ? e.message : String(e)}`,
            );
            continue;
          }
        }

        // Task E: Offer Expiry
        if (contact.conv_state === "OFFER_SENT") {
          const expired = await checkOfferExpiry(contact.id, contact.offer_sent_at);
          if (expired) {
            contact.conv_state = "FREE_CHAT";
          }
        }

        const conversation = await getConversationByContactId(contact.id);
        if (!conversation) {
          summary.errors.push(`No conversation for contact ${contact.id}`);
          continue;
        }

        const paid = await hasUserPaid(contact.id);
        if (paid && contact.conv_state !== "PAID") {
          await setConvState(contact.id, "PAID");
          contact.conv_state = "PAID";
        }

        const minId = conversation.last_synced_message_id || 0;
        let maxId = minId;
        const peer = buildPeer(contact.telegram_id, contact.telegram_access_hash);

        try {
          for await (const message of client.iterMessages(peer, {
            minId,
            reverse: true,
          })) {
            // Safely extract id before strict TS narrowing
            const msgId = (message as { id?: number }).id;

            if (!msgId) {
              continue;
            }
            if (msgId > maxId) maxId = msgId;

            if (!(message instanceof Api.Message)) {
              continue;
            }
            if (message.out) {
              continue;
            }

            const text = message.message?.trim() || (message.media ? "[Media]" : "");
            if (!text) {
              continue;
            }

            const saved = await createMessage(contact.id, text, "incoming", msgId);
            if (!saved) {
              summary.errors.push(`Failed to save message for contact ${contact.id}`);
              continue;
            }
            summary.newMessages++;

            // Task D: Update lead score
            await recalculateLeadScore(contact.id);

            try {
              if (automatedReplies) {
                if (contact.conv_state === "PAID") {
                  // Post-purchase: casual tone regardless of funnel mode
                  await sendAiReply(contact.id, "casual");
                  summary.repliesSent++;
                } else if (contact.conv_state === "OFFER_SENT") {
                  if (await shouldSendLockedResponse(contact.id)) {
                    await sendLockedResponse(contact.id);
                    summary.remindersSent++;
                  }
                } else {
                  // FREE_CHAT: respect operator aiMode setting.
                  // Intent-based offer trigger fires first; AI phase system handles
                  // rapport-building and soft pitching naturally via "auto" mode.
                  const hasIntent = hasPurchaseIntent(text);
                  if (hasIntent) {
                    await sendPremiumOffer(contact.id);
                    summary.offersSent++;
                    contact.conv_state = "OFFER_SENT";
                  } else {
                    const { offerSent } = await sendAiReply(contact.id, aiMode);
                    if (offerSent) {
                      // AI converted via [LINK] → real offer was sent.
                      summary.offersSent++;
                      contact.conv_state = "OFFER_SENT";
                    } else {
                      summary.repliesSent++;
                    }
                  }
                }
              }
            } catch (e) {
              summary.errors.push(
                `Response error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        } catch (e) {
          console.error(`[POLL] Message iteration error for contact ${contact.id}:`, e);
          summary.errors.push(
            `Iteration error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }

        if (maxId > minId) {
          await updateSyncCursor(conversation.id, maxId);
        }
      }
    } catch (e) {
      summary.errors.push(
        "Poll loop failed: " + (e instanceof Error ? e.message : String(e)),
      );
    }
  } catch (e) {
    summary.errors.push(
      "Critical poll error: " + (e instanceof Error ? e.message : String(e)),
    );
  } finally {
    try {
      await updateSetting("is_polling", false);
    } catch (e) {
      console.error("[Poll] Failed to release polling lock:", e);
    }
  }

  return summary;
}
