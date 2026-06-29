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
  updateEmotionalTemp,
  updateRelationshipScore,
  recalculateSpendSegment,
  getSpendSegmentMultipliers,
  getIntentScore,
  isInOfferCooldown,
  setOfferCooldown,
  incrementOfferDeclined,
  getPostPurchasePhase,
  markWelcomeSent,
  recalculateBuyerIntelligence,
  recalculateCrmIntelligence,
} from "@/lib/db/service";

import type { ConvState, ReplyMode } from "@/types";
import { razorpay } from "@/lib/razorpay";
import { suggestReply } from "@/lib/ai/suggest-reply";
import { getAppUrl } from "@/lib/app-url";
import { getTelegramClient } from "./client";
import { sendTelegramMessage } from "./sendMessage";
import { getLockedVariant } from "./messageVariants";
import {
  TIMING,
  INTENT_THRESHOLD,
  EMOTIONAL_TEMP,
  OFFER,
  SEGMENT_INTERVALS,
  MESSAGE,
} from "./constants";

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
  paid: number;
}

async function listContactConversations(): Promise<ContactWithConv[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.telegram_id, c.telegram_access_hash, c.conv_state, c.offer_sent_at,
              conv.id AS conversation_id, conv.last_synced_message_id,
              (SELECT COUNT(*) FROM purchases WHERE contact_id = c.id) AS paid
       FROM contacts c
       INNER JOIN conversations conv ON conv.contact_id = c.id
       WHERE c.telegram_id IS NOT NULL AND c.telegram_access_hash IS NOT NULL`,
    )
    .all() as ContactWithConv[];
  return rows;
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
    getSetting("offerPrice", OFFER.DEFAULT_PRICE),
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

function getScheduledDelay(convState: string, emotionalTemp: number): number {
  const r = Math.random();

  if (convState === "PAID" || convState === "OFFER_SENT") {
    if (r < 0.50) return TIMING.REPLY_DELAY_MIN_FAST + Math.random() * (TIMING.REPLY_DELAY_MAX_FAST - TIMING.REPLY_DELAY_MIN_FAST);
    if (r < 0.85) return TIMING.REPLY_DELAY_MIN_MEDIUM + Math.random() * (TIMING.REPLY_DELAY_MAX_MEDIUM - TIMING.REPLY_DELAY_MIN_MEDIUM);
    return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
  }

  if (emotionalTemp >= EMOTIONAL_TEMP.HOT) {
    if (r < 0.30) return TIMING.REPLY_DELAY_MIN_FAST + Math.random() * (TIMING.REPLY_DELAY_MAX_FAST - TIMING.REPLY_DELAY_MIN_FAST);
    if (r < 0.60) return TIMING.REPLY_DELAY_MIN_MEDIUM + Math.random() * (TIMING.REPLY_DELAY_MAX_MEDIUM - TIMING.REPLY_DELAY_MIN_MEDIUM);
    if (r < 0.85) return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
    return TIMING.REPLY_DELAY_MIN_VERY_SLOW + Math.random() * TIMING.REPLY_DELAY_MIN_VERY_SLOW;
  }

  if (emotionalTemp >= EMOTIONAL_TEMP.WARM) {
    if (r < 0.15) return TIMING.REPLY_DELAY_MIN_FAST + Math.random() * (TIMING.REPLY_DELAY_MAX_FAST - TIMING.REPLY_DELAY_MIN_FAST);
    if (r < 0.40) return TIMING.REPLY_DELAY_MIN_MEDIUM + Math.random() * (TIMING.REPLY_DELAY_MAX_MEDIUM - TIMING.REPLY_DELAY_MIN_MEDIUM);
    if (r < 0.75) return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
    if (r < 0.93) return TIMING.REPLY_DELAY_MIN_VERY_SLOW + Math.random() * TIMING.REPLY_DELAY_MIN_VERY_SLOW;
    return TIMING.REPLY_DELAY_MIN_EXTREMELY_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_EXTREMELY_SLOW - TIMING.REPLY_DELAY_MIN_EXTREMELY_SLOW);
  }

  // Low emotional temp — slow, distant
  if (r < 0.20) return TIMING.REPLY_DELAY_MIN_MEDIUM + Math.random() * (TIMING.REPLY_DELAY_MAX_MEDIUM - TIMING.REPLY_DELAY_MIN_MEDIUM);
  if (r < 0.55) return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
  if (r < 0.80) return TIMING.REPLY_DELAY_MIN_VERY_SLOW + Math.random() * TIMING.REPLY_DELAY_MIN_VERY_SLOW;
  return TIMING.REPLY_DELAY_MIN_HOURS + Math.random() * (TIMING.REPLY_DELAY_MAX_HOURS - TIMING.REPLY_DELAY_MIN_HOURS);
}

function splitMessage(text: string): string[] {
  if (Math.random() < MESSAGE.SPLIT_CHANCE || text.length <= MESSAGE.SHORT_MESSAGE_LENGTH) return [text];
  // Split on sentence-ending punctuation
  const parts = text.match(/[^.!?…]+[.!?…]*/g);
  if (!parts || parts.length <= 1) return [text];
  const cleaned = parts.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length > 4) {
    const mid = Math.ceil(cleaned.length / 2);
    return [cleaned.slice(0, mid).join(" "), cleaned.slice(mid).join(" ")];
  }
  return cleaned;
}

async function schedulePendingReply(contactId: number, text: string, delayMs: number): Promise<void> {
  const db = await getDb();
  const scheduledAt = new Date(Date.now() + delayMs).toISOString();
  await db.prepare(
    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)"
  ).run(`pending_reply:${contactId}`, JSON.stringify({ text, scheduledAt }), nowIso());
}

async function sendDueReplies(summary: PollSummary): Promise<void> {
  const db = await getDb();
  const rows = await db.prepare(
    "SELECT key, value FROM settings WHERE key LIKE 'pending_reply:%'"
  ).all() as { key: string; value: string }[];
  const now = new Date();
  for (const row of rows) {
    try {
      const contactId = parseInt(row.key.split(":")[1]);
      const data = JSON.parse(row.value);
      if (new Date(data.scheduledAt) <= now) {
        await sendTelegramMessage(contactId, data.text);
        await db.prepare("DELETE FROM settings WHERE key = ?").run(row.key);
        summary.repliesSent++;
      }
    } catch (e) {
      console.error("[POLL] Pending reply error:", e);
    }
  }
}

async function sendAiReply(
  contactId: number,
  mode: ReplyMode = "casual",
  emotionalTemp: number = 50,
  intentScore: number = 0,
  convState: string = "FREE_CHAT",
): Promise<{ offerSent: boolean }> {
  const messages = await getMessagesByContactId(contactId);
  const recent = messages.slice(-MESSAGE.RECENT_COUNT);

  const lastOutgoing = [...recent].reverse().find(m => m.direction === "outgoing");
  const lastTopic = lastOutgoing
    ? lastOutgoing.text.replace(/[LINK].*/i, "").replace(/https?:\/\/\S+/g, "").trim().slice(0, MESSAGE.TOPIC_MAX_LENGTH)
    : undefined;

  let reply = await suggestReply(recent, mode, emotionalTemp, intentScore, {
    previousTopic: lastTopic,
    convState,
  });

  const linkMatch = reply.match(/\[link\]/i);
  if (linkMatch) {
    let linkSent = false;
    try {
      const settings = await getOfferSettings();
      const amount = await selectOfferAmount(contactId, settings.offerPrice);
      const link = await createPaymentLink(contactId, amount);
      reply = reply.replace(/\[link\]/gi, link).trim();
      await sendTelegramMessage(contactId, reply);
      linkSent = true;
      await setConvState(contactId, "OFFER_SENT", nowIso());
      return { offerSent: true };
    } catch (e) {
      if (linkSent) {
        console.error(`[POLL] Post-send state update failed for [LINK] offer (contact ${contactId}):`, e);
        return { offerSent: true };
      }
      console.error(
        `[POLL] Payment link creation failed during [LINK] substitution (contact ${contactId}):`,
        e,
      );
      reply = reply.replace(/\[link\]/gi, "").replace(/\s{2,}/g, " ").trim();
      if (!reply) reply = "ek sec babe... sending you something 💫";
    }
  }

  await scheduleOrSendReply(contactId, reply, convState, emotionalTemp);
  return { offerSent: false };
}

async function scheduleOrSendReply(
  contactId: number,
  text: string,
  convState: string,
  emotionalTemp: number,
): Promise<void> {
  const delayMs = getScheduledDelay(convState, emotionalTemp);
  if (delayMs < 50000) {
    await new Promise((r) => setTimeout(r, delayMs));
    const parts = splitMessage(text);
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, TIMING.MULTI_MESSAGE_GAP_MIN + Math.random() * (TIMING.MULTI_MESSAGE_GAP_MAX - TIMING.MULTI_MESSAGE_GAP_MIN)));
      await sendTelegramMessage(contactId, parts[i]);
    }
  } else {
    await schedulePendingReply(contactId, text, delayMs);
  }
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
    description: "Nayra Premium Unlock",
    customer: { name: "Fan" },
    notes: { contactId: String(contactId) },
    callback_url: `${appUrl}/api/checkout/success`,
    callback_method: "get",
    // Per-link checkout brand override so the fan sees "Nayra Premium" at
    // checkout instead of the registered Razorpay account name.
    options: { checkout: { name: "Nayra Premium" } },
  } as Parameters<typeof razorpay.paymentLink.create>[0]);
  return (paymentLink as { short_url: string }).short_url;
}

async function sendPremiumOffer(contactId: number): Promise<void> {
  const settings = await getOfferSettings();
  const amount = await selectOfferAmount(contactId, settings.offerPrice);
  const link = await createPaymentLink(contactId, amount);
  const text = `${settings.offerMessage}\n\n👉 ${link}`;
  await sendTelegramMessage(contactId, text);
  try {
    await setConvState(contactId, "OFFER_SENT", nowIso());
  } catch (e) {
    console.error(`[POLL] Failed to update conv_state after premium offer for contact ${contactId}:`, e);
  }
}


const SEGMENT_LOCKED_INTERVALS: Record<string, number> = SEGMENT_INTERVALS;

async function getSegmentLockedInterval(segment: string): Promise<number> {
  return SEGMENT_LOCKED_INTERVALS[segment as keyof typeof SEGMENT_LOCKED_INTERVALS] ?? SEGMENT_INTERVALS.default;
}

export async function sendLockedResponse(contactId: number): Promise<void> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT locked_response_count, spend_segment FROM contacts WHERE id = ?")
    .get(contactId) as { locked_response_count: number; spend_segment: string } | undefined;
  const count = row?.locked_response_count ?? 0;
  const segment = row?.spend_segment ?? "default";

  if (count >= OFFER.MAX_LOCKED_RESPONSES) {
    await setConvState(contactId, "FREE_CHAT");
    await setOfferCooldown(contactId, OFFER.COOLDOWN_DAYS);
    return;
  }

  const settings = await getOfferSettings();
  const amount = await selectOfferAmount(contactId, settings.offerPrice);
  const link = await createPaymentLink(contactId, amount);
  const text = getLockedVariant(segment, count) + link;

  await sendTelegramMessage(contactId, text);

  const ts = nowIso();
  try {
    await db
      .prepare("UPDATE contacts SET last_locked_response_at = ?, locked_response_count = locked_response_count + 1, updated_at = ? WHERE id = ?")
      .run(ts, ts, contactId);
  } catch (e) {
    console.error(`[POLL] Failed to update locked response count for contact ${contactId}:`, e);
  }
}

async function shouldSendLockedResponse(contactId: number): Promise<boolean> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT last_locked_response_at, locked_response_count, spend_segment FROM contacts WHERE id = ?")
    .get(contactId)) as { last_locked_response_at: string | null; locked_response_count: number; spend_segment: string } | undefined;
  if (!row) return false;
  if ((row.locked_response_count ?? 0) >= OFFER.MAX_LOCKED_RESPONSES) return false;
  if (!row.last_locked_response_at) return true;
  const intervalHours = await getSegmentLockedInterval(row.spend_segment ?? "default");
  const h = hoursSince(row.last_locked_response_at);
  return h >= intervalHours;
}

async function selectOfferAmount(contactId: number, basePrice: number): Promise<number> {
  const segment = await recalculateSpendSegment(contactId);
  const multiplier = await getSpendSegmentMultipliers(segment);
  return Math.round(basePrice * multiplier);
}

async function checkOfferExpiry(contactId: number, offerSentAt: string | null): Promise<boolean> {
  if (!offerSentAt) return false;
  const days = (Date.now() - new Date(offerSentAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days >= OFFER.EXPIRY_DAYS) {
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
        if (lockAgeMs < 90 * 1000) { // 90s — 1.5× Vercel's 60s maxDuration so a timed-out poll releases before the next cron fires
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

      await sendDueReplies(summary);

      const knownContacts = await listContactConversations();
      const knownMap = new Map<string, ContactWithConv>();
      for (const c of knownContacts) {
        knownMap.set(c.telegram_id, c);
      }

      for await (const dialog of client.iterDialogs({ folder: 0 })) {
        const entity = dialog.entity;

        // Skip non-users, bots, self, and Telegram system accounts early
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
        // 777000 = Telegram's own notification account (not a real user)
        if (entity.id.toString() === "777000") {
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
            console.log(`[POLL] New contact — ${formatUserName(entity)}`);
          } catch (e) {
            summary.errors.push(
              `Failed to create contact for ${telegramId}: ${e instanceof Error ? e.message : String(e)}`,
            );
            continue;
          }
        } else {
          console.log(`[POLL] Contact — ${contact.id} cursor=${contact.last_synced_message_id}`);
        }

        // Task E: Offer Expiry
        if (contact.conv_state === "OFFER_SENT") {
          const expired = await checkOfferExpiry(contact.id, contact.offer_sent_at);
          if (expired) {
            contact.conv_state = "FREE_CHAT";
          }
        }

        if (contact.paid && contact.conv_state !== "PAID") {
          await setConvState(contact.id, "PAID");
          contact.conv_state = "PAID";
        }

        const minId = contact.last_synced_message_id || 0;
        let maxId = minId;
        const peer = buildPeer(contact.telegram_id, contact.telegram_access_hash);

        try {
          const incomingMessages: { text: string }[] = [];

          for await (const message of client.iterMessages(peer, {
            minId,
            reverse: true,
            limit: 50,
          })) {
            const msgId = (message as { id?: number }).id;

            if (!msgId) {
              continue;
            }

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

            if (msgId > maxId) maxId = msgId;

            const saved = await createMessage(contact.id, text, "incoming", msgId);
            if (saved) {
              summary.newMessages++;
              incomingMessages.push({ text });
            }
          }

          // Batched reply: one response per contact per poll regardless of
          // how many messages arrived (BUG-5 fix).
          let replyFailed = false;
          if (incomingMessages.length > 0 && automatedReplies) {
            try {
              await recalculateLeadScore(contact.id);
              await recalculateSpendSegment(contact.id);
              await recalculateBuyerIntelligence(contact.id);
              await recalculateCrmIntelligence(contact.id);
              const emotionalTemp = await updateEmotionalTemp(contact.id);
              const intentScore = await getIntentScore(incomingMessages);
              await updateRelationshipScore(contact.id);

              const skipReply = await shouldSkipDueToPacing(contact.id, emotionalTemp);

              if (!skipReply && contact.conv_state === "PAID") {
                const phase = await getPostPurchasePhase(contact.id);
                if (phase === "welcome") {
                  const welcomeMsg = "you're officially in my vip section now... hope you're ready for what's inside ☕️";
                  await sendTelegramMessage(contact.id, welcomeMsg);
                  try { await markWelcomeSent(contact.id); } catch (e) { console.error(`[POLL] markWelcomeSent failed for ${contact.id}:`, e); }
                  summary.repliesSent++;
                } else if (phase === "reoffer") {
                  await sendPremiumOffer(contact.id);
                  summary.offersSent++;
                  contact.conv_state = "OFFER_SENT";
                } else {
                  await sendAiReply(contact.id, "casual", emotionalTemp, intentScore, contact.conv_state);
                  summary.repliesSent++;
                }
              } else if (!skipReply && contact.conv_state === "OFFER_SENT") {
                if (await shouldSendLockedResponse(contact.id)) {
                  await sendLockedResponse(contact.id);
                  summary.remindersSent++;
                } else {
                  const ldb = await getDb();
                  const row = await ldb
                    .prepare("SELECT locked_response_count, spend_segment FROM contacts WHERE id = ?")
                    .get(contact.id) as { locked_response_count: number; spend_segment: string } | undefined;
                  if (row) {
                    if ((row.locked_response_count ?? 0) >= 22) {
                      await setConvState(contact.id, "FREE_CHAT");
                      await setOfferCooldown(contact.id, 7);
                    }
                  }
                }
              } else if (!skipReply) {
                const inCooldown = await isInOfferCooldown(contact.id);

                if (intentScore >= INTENT_THRESHOLD.HIGH && !inCooldown) {
                  await sendPremiumOffer(contact.id);
                  summary.offersSent++;
                  contact.conv_state = "OFFER_SENT";
                } else if (intentScore >= INTENT_THRESHOLD.LOW) {
                  const { offerSent } = await sendAiReply(contact.id, aiMode, emotionalTemp, intentScore, contact.conv_state);
                  if (offerSent) {
                    summary.offersSent++;
                    contact.conv_state = "OFFER_SENT";
                  } else {
                    summary.repliesSent++;
                  }
                } else {
                  const { offerSent } = await sendAiReply(contact.id, "casual", emotionalTemp, intentScore, contact.conv_state);
                  if (offerSent) {
                    summary.offersSent++;
                    contact.conv_state = "OFFER_SENT";
                  } else {
                    summary.repliesSent++;
                  }
                }

                if (contact.conv_state === "OFFER_SENT" && intentScore < INTENT_THRESHOLD.VERY_LOW) {
                  try { await incrementOfferDeclined(contact.id); } catch (e) { console.error(`[POLL] incrementOfferDeclined failed for ${contact.id}:`, e); }
                }
              } else {
                replyFailed = true;
              }
            } catch (e) {
              replyFailed = true;
              summary.errors.push(
                `Response error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }

          if (!replyFailed && maxId > minId) {
            await updateSyncCursor(contact.conversation_id, maxId);
          }
        } catch (e) {
          console.error(`[POLL] Message iteration error for contact ${contact.id}:`, e);
          summary.errors.push(
            `Iteration error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      console.log(`[Poll] Completed — dialogs=${summary.dialogsChecked} new=${summary.newMessages} elapsed=${Date.now() - startTime}ms`);
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

async function shouldSkipDueToPacing(contactId: number, emotionalTemp: number): Promise<boolean> {
  if (emotionalTemp >= 40) return false;
  const db = await getDb();
  const lastMsg = await db
    .prepare(
      `SELECT m.created_at FROM messages m
       JOIN conversations conv ON conv.id = m.conversation_id
       WHERE conv.contact_id = ? AND m.direction = 'outgoing'
       ORDER BY m.created_at DESC LIMIT 1`
    )
    .get(contactId) as { created_at: string } | undefined;
  if (!lastMsg) return false;
  const elapsed = (Date.now() - new Date(lastMsg.created_at).getTime()) / 1000 / 60;
  return elapsed < 5;
}
