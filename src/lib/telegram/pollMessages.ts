import { existsSync } from "fs";
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
  enqueueFailedAction,
} from "@/lib/db/service";

import type { ConvState, ReplyMode } from "@/types";
import { razorpay } from "@/lib/razorpay";
import { suggestReply, detectMode } from "@/lib/ai/suggest-reply";
import { extractMemory, moodLabel } from "@/lib/ai/memory";
import { getAppUrl } from "@/lib/app-url";
import { getTelegramClient } from "./client";
import { sendTelegramMessage, sendTelegramPhoto } from "./sendMessage";
import { getLockedVariant, pickRandom, WELCOME_PAID } from "./messageVariants";
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

// Module-level cache for offer settings so the 4-SELECT query runs at most once per poll.
// Cleared in the poll's finally block. Not exported — only pollMessages.ts callers use it.
let _offerSettingsCache: Awaited<ReturnType<typeof getOfferSettings>> | null = null;

async function getCachedOfferSettings() {
  if (_offerSettingsCache) return _offerSettingsCache;
  _offerSettingsCache = await getOfferSettings();
  return _offerSettingsCache;
}

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
  } else if (state === "FREE_CHAT") {
    await db
      .prepare("UPDATE contacts SET conv_state = ?, offer_cooldown_until = NULL, updated_at = ? WHERE id = ?")
      .run(state, ts, contactId);
  } else {
    await db
      .prepare("UPDATE contacts SET conv_state = ?, updated_at = ? WHERE id = ?")
      .run(state, ts, contactId);
  }
}

async function getOfferSettings() {
  const [offerPrice, offerMessage, aiMode, automatedReplies] = await Promise.all([
    getSetting("offerPrice", OFFER.DEFAULT_PRICE),
    getSetting("offerMessage", "acha... itna hi dekhna hai? 😏\n\nfir shortcut ye hai 👇"),
    getSetting<ReplyMode>("aiMode", "auto"),
    getSetting<boolean>("automatedReplies", false),
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
    isBot: entity.bot === true,
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

  // Time-of-day awareness (IST = UTC+5:30)
  const istHour = (new Date().getUTCHours() + 5) % 24 + (new Date().getUTCMinutes() >= 30 ? 0 : 0);
  const isLateNight = istHour >= 1 && istHour < 7;   // 1am–7am: she's asleep
  const isEarlyMorning = istHour >= 7 && istHour < 10; // 7am–10am: slow to reply
  const isPeakHours = istHour >= 18 || istHour < 1;   // 6pm–1am: most active

  // Late night: always push to medium-slow — instant replies at 3am break the illusion
  if (isLateNight) {
    if (r < 0.40) return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
    if (r < 0.85) return TIMING.REPLY_DELAY_MIN_VERY_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_VERY_SLOW - TIMING.REPLY_DELAY_MIN_VERY_SLOW);
    return TIMING.REPLY_DELAY_MIN_EXTREMELY_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_EXTREMELY_SLOW - TIMING.REPLY_DELAY_MIN_EXTREMELY_SLOW);
  }

  // Early morning: slower than peak, no fast replies
  const fastFloor = isEarlyMorning ? TIMING.REPLY_DELAY_MIN_MEDIUM : (isPeakHours ? TIMING.REPLY_DELAY_MIN_FAST : TIMING.REPLY_DELAY_MIN_MEDIUM);
  const fastMax = isEarlyMorning ? TIMING.REPLY_DELAY_MAX_MEDIUM : (isPeakHours ? TIMING.REPLY_DELAY_MAX_FAST : TIMING.REPLY_DELAY_MAX_MEDIUM);

  if (convState === "PAID" || convState === "OFFER_SENT") {
    if (r < 0.50) return fastFloor + Math.random() * (fastMax - fastFloor);
    if (r < 0.85) return TIMING.REPLY_DELAY_MIN_MEDIUM + Math.random() * (TIMING.REPLY_DELAY_MAX_MEDIUM - TIMING.REPLY_DELAY_MIN_MEDIUM);
    return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
  }

  if (emotionalTemp >= EMOTIONAL_TEMP.HOT) {
    if (r < 0.30) return fastFloor + Math.random() * (fastMax - fastFloor);
    if (r < 0.60) return TIMING.REPLY_DELAY_MIN_MEDIUM + Math.random() * (TIMING.REPLY_DELAY_MAX_MEDIUM - TIMING.REPLY_DELAY_MIN_MEDIUM);
    if (r < 0.85) return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
    return TIMING.REPLY_DELAY_MIN_VERY_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_VERY_SLOW - TIMING.REPLY_DELAY_MIN_VERY_SLOW);
  }

  if (emotionalTemp >= EMOTIONAL_TEMP.WARM) {
    if (r < 0.15) return fastFloor + Math.random() * (fastMax - fastFloor);
    if (r < 0.40) return TIMING.REPLY_DELAY_MIN_MEDIUM + Math.random() * (TIMING.REPLY_DELAY_MAX_MEDIUM - TIMING.REPLY_DELAY_MIN_MEDIUM);
    if (r < 0.75) return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
    if (r < 0.93) return TIMING.REPLY_DELAY_MIN_VERY_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_VERY_SLOW - TIMING.REPLY_DELAY_MIN_VERY_SLOW);
    return TIMING.REPLY_DELAY_MIN_EXTREMELY_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_EXTREMELY_SLOW - TIMING.REPLY_DELAY_MIN_EXTREMELY_SLOW);
  }

  // Low emotional temp — slow, distant; cap at VERY_SLOW (no multi-hour delays for warm conversations)
  if (r < 0.20) return TIMING.REPLY_DELAY_MIN_MEDIUM + Math.random() * (TIMING.REPLY_DELAY_MAX_MEDIUM - TIMING.REPLY_DELAY_MIN_MEDIUM);
  if (r < 0.55) return TIMING.REPLY_DELAY_MIN_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_SLOW - TIMING.REPLY_DELAY_MIN_SLOW);
  return TIMING.REPLY_DELAY_MIN_VERY_SLOW + Math.random() * (TIMING.REPLY_DELAY_MAX_VERY_SLOW - TIMING.REPLY_DELAY_MIN_VERY_SLOW);
}

function splitMessage(text: string): string[] {
  // Priority 1: AI already output explicit line breaks → respect them as bubble boundaries.
  // This is the primary multi-message path — the sanitizer now preserves single \n.
  if (text.includes("\n")) {
    const lines = text.split("\n").map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2) return lines.slice(0, 4); // cap at 4 bubbles
  }
  // Priority 2: 30% chance skip (stay single bubble for variety)
  if (Math.random() < MESSAGE.SPLIT_CHANCE) return [text];
  // Priority 3: Short replies don't split — no content to divide
  if (text.length <= MESSAGE.SHORT_MESSAGE_LENGTH) return [text];
  // Priority 4: Split on sentence-ending punctuation
  const parts = text.match(/[^.!?…]+[.!?…]*/g);
  if (parts && parts.length > 1) {
    const cleaned = parts.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length > 4) {
      const mid = Math.ceil(cleaned.length / 2);
      return [cleaned.slice(0, mid).join(" "), cleaned.slice(mid).join(" ")];
    }
    return cleaned;
  }
  // Priority 5: No punctuation (Hinglish) — split at word boundary near midpoint.
  // Covers the common case where casual text has no .!?… at all.
  const mid = Math.floor(text.length / 2);
  const before = text.lastIndexOf(" ", mid);
  const after = text.indexOf(" ", mid);
  const splitAt = before > 0 ? before : after;
  if (splitAt < 1 || splitAt >= text.length - 1) return [text];
  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
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
        // Delete before send to prevent duplicate delivery if the send succeeds
        // but a subsequent operation (e.g. DELETE itself) fails. If send fails,
        // re-insert so the next poll retries.
        await db.prepare("DELETE FROM settings WHERE key = ?").run(row.key);
        const parts = splitMessage(data.text);
        try {
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) await new Promise((r) => setTimeout(r, TIMING.MULTI_MESSAGE_GAP_MIN + Math.random() * (TIMING.MULTI_MESSAGE_GAP_MAX - TIMING.MULTI_MESSAGE_GAP_MIN)));
            await sendTelegramMessage(contactId, parts[i]);
          }
        } catch (sendErr) {
          // Re-insert so the next poll retries
          await db.prepare(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)"
          ).run(row.key, row.value, nowIso());
          throw sendErr;
        }
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
  // 50 rows covers the last ~25 exchanges — enough for extractMemory facts and the
  // 12-message transcript. The previous 500-row fetch transferred ~480 wasted rows.
  const messages = await getMessagesByContactId(contactId, 50);
  const recent = messages.slice(-MESSAGE.RECENT_COUNT);

  const lastOutgoing = [...recent].reverse().find(m => m.direction === "outgoing");
  const lastTopic = lastOutgoing
    ? lastOutgoing.text.replace(/[LINK].*/i, "").replace(/https?:\/\/\S+/g, "").trim().slice(0, MESSAGE.TOPIC_MAX_LENGTH)
    : undefined;

  // Long-term memory: extract stable facts from the FULL history (not just the
  // recent window) plus paid status / favourite content, so replies stay
  // continuous across long conversations.
  const memory = extractMemory(messages);
  const mdb = await getDb();
  const meta = await mdb
    .prepare("SELECT total_spent, favorite_content_type, offer_declined_count FROM contacts WHERE id = ?")
    .get(contactId) as { total_spent: number; favorite_content_type: string | null; offer_declined_count: number } | undefined;

  const declineCount = meta?.offer_declined_count ?? 0;
  const lastOfferResult = declineCount > 0 ? "declined" : undefined;

  const reply = await suggestReply(recent, mode, emotionalTemp, intentScore, {
    previousTopic: lastTopic,
    convState,
    isPaid: (meta?.total_spent ?? 0) > 0,
    favoriteContent: meta?.favorite_content_type || undefined,
    mood: moodLabel(emotionalTemp),
    facts: memory.facts,
    nickname: memory.nickname,
    answered: memory.answered,
    lastOfferResult,
  });

  const linkMatch = reply.match(/\[link\]/i);
  if (linkMatch) {
    // AI decided to offer — backend executes it deterministically via sendPremiumOffer
    // so preview + payment link ALWAYS go out regardless of AI phrasing.
    const textPart = reply.replace(/\[link\]/gi, "").replace(/\s{2,}/g, " ").trim();
    if (textPart) {
      await scheduleOrSendReply(contactId, textPart, convState, emotionalTemp);
    }
    await sendPremiumOffer(contactId);
    return { offerSent: true };
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
  // sendTelegramMessage already runs a typingDelay of 1–8 s (sendMessage.ts:12-21)
  // which provides the human-like "thinking" pause the user sees. Scheduling to
  // pending_reply would defer delivery by a full poll cycle (60 s+), causing the
  // "replies never arrive" symptom. Instead: always send inline this poll, with a
  // short pre-typing pause capped at 3 s so the poll budget isn't consumed.
  const delayMs = getScheduledDelay(convState, emotionalTemp);
  const inlineWait = Math.min(delayMs, 3000);
  const tInlineWait = Date.now();
  if (inlineWait > 0) {
    await new Promise((r) => setTimeout(r, inlineWait));
  }
  console.log(JSON.stringify({ stage: "inline_wait", contactId, scheduledDelayMs: delayMs, inlineWaitMs: Date.now() - tInlineWait }));
  const parts = splitMessage(text);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, TIMING.MULTI_MESSAGE_GAP_MIN + Math.random() * (TIMING.MULTI_MESSAGE_GAP_MAX - TIMING.MULTI_MESSAGE_GAP_MIN)));
    await sendTelegramMessage(contactId, parts[i]);
  }
}

export async function createPaymentLink(
  contactId: number,
  overrideAmount?: number,
): Promise<string> {
  if (!razorpay) throw new Error("Razorpay not configured");
  const appUrl = getAppUrl();
  const settings = await getCachedOfferSettings();
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

const PREVIEW_IMAGE_PATH = process.cwd() + "/public/preview-blurred.jpg";

async function sendPremiumOffer(contactId: number): Promise<void> {
  console.log(`[Offer] Triggered contactId=${contactId}`);
  const settings = await getCachedOfferSettings();
  const amount = await selectOfferAmount(contactId, settings.offerPrice);
  const link = await createPaymentLink(contactId, amount);
  const text = `${settings.offerMessage}\n\n👉 ${link}`;
  const previewExists = existsSync(PREVIEW_IMAGE_PATH);
  console.log(JSON.stringify({ stage: "preview_check", contactId, path: PREVIEW_IMAGE_PATH, exists: previewExists }));
  if (previewExists) {
    try {
      await sendTelegramPhoto(contactId, PREVIEW_IMAGE_PATH);
    } catch (e) {
      console.error(`[sendPremiumOffer] Blurred preview send failed for contact ${contactId}:`, e);
    }
  } else {
    console.error(`[sendPremiumOffer] Preview image missing at ${PREVIEW_IMAGE_PATH} — photo skipped`);
  }
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

  const settings = await getCachedOfferSettings();
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
  // Launch price fixed: skip tier multiplier when price is at launch floor
  if (basePrice <= 49) return basePrice;
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

// ── Concurrent reply dispatch ────────────────────────────────────────────────
// Max AI calls running at once. GramJS multiplexes on one MTProto sender so
// 3 concurrent sends are safe; more risks FloodWait or response interleaving.
const REPLY_CONCURRENCY = 3;

interface ReplyJob {
  contact: ContactWithConv;
  incomingMessages: { text: string }[];
  maxId: number;
}

async function sendReadAcknowledgement(contact: ContactWithConv, maxId: number): Promise<void> {
  try {
    const client = await getTelegramClient();
    const peer = buildPeer(contact.telegram_id, contact.telegram_access_hash);
    await client.invoke(new Api.messages.ReadHistory({ peer, maxId }));
  } catch (e) {
    console.warn(`[Poll] ReadHistory failed for contact ${contact.id}:`, e);
  }
}

async function notifyAdmin(contact: ContactWithConv, incomingMessages: { text: string }[]): Promise<void> {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) { console.warn("[POLL] ADMIN_TELEGRAM_ID not set"); return; }
  try {
    const db = await getDb();
    const row = await db.prepare("SELECT name, username FROM contacts WHERE id = ?").get(contact.id) as { name: string; username: string } | undefined;
    const lastMsg = [...incomingMessages].reverse().find(m => m.text)?.text ?? "";
    const text = `🔥 HOT LEAD\n\nName: ${row?.name ?? "Unknown"}\nTelegram ID: ${contact.telegram_id}\nUsername: @${row?.username ?? "unknown"}\nLast message: ${lastMsg}`;
    const client = await getTelegramClient();
    const adminPeer = await client.getEntity(bigInt(adminId));
    await client.sendMessage(adminPeer, { message: text });
  } catch (e) {
    console.error("[POLL] notifyAdmin failed:", e);
  }
}

async function processReplyJob(
  job: ReplyJob,
  summary: PollSummary,
  automatedReplies: boolean,
  aiMode: ReplyMode,
): Promise<void> {
  const { contact, incomingMessages, maxId } = job;
  // Mark messages as read on Telegram so the sender sees ✓✓ instead of ✓.
  // Fire-and-forget: failure is non-fatal; the next poll will retry.
  sendReadAcknowledgement(contact, maxId);
  let replyFailed = false;
  let replyEnqueued = false;
  const tJob = Date.now();

  // Structured production log tracking — set as branches execute, emitted once at end.
  let _logIntentScore = 0;
  let _logMode: string = aiMode;
  let _logOfferTriggered = false;
  let _logOfferSent = false;
  let _logPaymentDetected = false;
  let _logUnlockSent = false;
  let _logInCooldown = false;
  let _logHasPurchaseIntent = false;
  let _logHasContentIntent = false;
  let _logDirectOfferSignal = false;
  let _logRepeatedContentSignal = false;
  let _logCurrentPollMode: string = aiMode;

  let emotionalTemp: number | undefined;
  try {
    const tRecalc = Date.now();
    await Promise.all([
      recalculateLeadScore(contact.id),
      recalculateSpendSegment(contact.id),
      updateRelationshipScore(contact.id),
    ]);
    [emotionalTemp] = await Promise.all([
      updateEmotionalTemp(contact.id),
      recalculateBuyerIntelligence(contact.id),
      recalculateCrmIntelligence(contact.id),
    ]);
    console.log(JSON.stringify({ stage: "db_recalcs", contactId: contact.id, ms: Date.now() - tRecalc }));
  } catch (e) {
    console.error(`CRM recalcs failed for contact ${contact.id}:`, e);
  }

  const intentScore = await getIntentScore(incomingMessages);
  _logIntentScore = intentScore;

  if (automatedReplies) {
    try {

      const skipReply = await shouldSkipDueToPacing(contact.id, emotionalTemp ?? 0.5);

      if (!skipReply && contact.conv_state === "PAID") {
        _logPaymentDetected = true;
        const phase = await getPostPurchasePhase(contact.id);
        if (phase === "welcome") {
          const welcomeMsg = pickRandom(WELCOME_PAID);
          await sendTelegramMessage(contact.id, welcomeMsg);
          try { await markWelcomeSent(contact.id); } catch (e) { console.error(`[POLL] markWelcomeSent failed for ${contact.id}:`, e); }
          summary.repliesSent++;
        } else if (phase === "reoffer" && !(await isInOfferCooldown(contact.id))) {
          await sendPremiumOffer(contact.id);
          await setOfferCooldown(contact.id, OFFER.COOLDOWN_DAYS);
          _logOfferTriggered = true; _logOfferSent = true;
          summary.offersSent++;
          contact.conv_state = "OFFER_SENT";
        } else {
          await sendAiReply(contact.id, "casual", emotionalTemp, intentScore, contact.conv_state);
          _logMode = "casual";
          summary.repliesSent++;
        }
      } else if (!skipReply && contact.conv_state === "OFFER_SENT") {
        if (await shouldSendLockedResponse(contact.id)) {
          await sendLockedResponse(contact.id);
          _logUnlockSent = true;
          summary.remindersSent++;
        } else {
          const ldb = await getDb();
          const row = await ldb
            .prepare("SELECT locked_response_count FROM contacts WHERE id = ?")
            .get(contact.id) as { locked_response_count: number } | undefined;
          if (row && (row.locked_response_count ?? 0) >= OFFER.MAX_LOCKED_RESPONSES) {
            await setConvState(contact.id, "FREE_CHAT");
            await setOfferCooldown(contact.id, OFFER.COOLDOWN_DAYS);
          } else {
            const { offerSent } = await sendAiReply(contact.id, "casual", emotionalTemp, intentScore, contact.conv_state);
            _logMode = "casual";
            if (offerSent) { _logOfferSent = true; summary.offersSent++; contact.conv_state = "OFFER_SENT"; }
            else summary.repliesSent++;
          }
        }
      } else if (!skipReply) {
        const inCooldown = await isInOfferCooldown(contact.id);
        _logInCooldown = inCooldown;
        // detectMode checks the CURRENT poll's messages for sales/content/pay keywords.
        // intentScore only scores the current-poll messages in isolation and never
        // reaches HIGH(60) from a single message — so the direct offer gate was never
        // triggering even on explicit "photo bhejo" / "I'll pay" messages.
        const currentPollMode = detectMode(incomingMessages.map(m => ({ ...m, direction: "incoming" as const })), emotionalTemp);
        _logCurrentPollMode = currentPollMode;
        // Require explicit content/purchase words — price/cost/kitna alone (e.g. "kya price h?")
        // must NOT fire an immediate payment link. Only content requests or clear buy intent do.
        const CONTENT_INTENT_WORDS = ["photo","pic","pics","photos","selfie","video","dikha","dikhana",
          "show yourself","send me","nude","nudes","sext","exclusive","premium","unlock",
          "subscription","membership","send link","i'll pay","i will pay","payment kar",
          "pay karna","ready to pay","buy now","join kar",
          "preview","demo","dikhao","bhejo","trial","sample"];
        const hasContentIntent = incomingMessages.some(m =>
          CONTENT_INTENT_WORDS.some(w => m.text.toLowerCase().includes(w))
        );
        _logHasContentIntent = hasContentIntent;
        // Explicit purchase words → fire offer immediately; no mode check needed
        const PURCHASE_INTENT_WORDS = ["pay","payment","buy","kharidna","i'll buy","i will buy",
          "offer do","offer kar","le lo","lelo","purchase","checkout"];
        const hasPurchaseIntent = !inCooldown && incomingMessages.some(m =>
          PURCHASE_INTENT_WORDS.some(w => m.text.toLowerCase().includes(w))
        );
        _logHasPurchaseIntent = hasPurchaseIntent;
        const directOfferSignal = hasPurchaseIntent || (currentPollMode === "sales" && !inCooldown && hasContentIntent);
        _logDirectOfferSignal = directOfferSignal;
        // Fire offer on 2nd+ content request — first stays natural, repeated intent converts.
        let repeatedContentSignal = false;
        if (hasContentIntent && !inCooldown) {
          const historyMsgs = await getMessagesByContactId(contact.id, 30);
          const totalContentCount = historyMsgs.filter(m =>
            m.direction === "incoming" &&
            CONTENT_INTENT_WORDS.some(w => m.text.toLowerCase().includes(w))
          ).length;
          // Subtract current-poll messages so we only count PRIOR requests.
          // Fires on the 2nd request: after the 1st "photo" gets a natural tease,
          // the 2nd "photo" has priorContentCount=1 → offer triggers immediately.
          const currentContentCount = incomingMessages.filter(m =>
            CONTENT_INTENT_WORDS.some(w => m.text.toLowerCase().includes(w))
          ).length;
          repeatedContentSignal = (totalContentCount - currentContentCount) >= 1;
        }
        _logRepeatedContentSignal = repeatedContentSignal;
        if ((intentScore >= INTENT_THRESHOLD.HIGH || directOfferSignal || repeatedContentSignal) && !inCooldown) {
          await sendPremiumOffer(contact.id);
          _logOfferTriggered = true; _logOfferSent = true; _logMode = currentPollMode;
          summary.offersSent++;
          contact.conv_state = "OFFER_SENT";
          notifyAdmin(contact, incomingMessages).catch(e => console.error("[POLL] notifyAdmin failed:", e));
        } else if (intentScore >= INTENT_THRESHOLD.VERY_LOW) {
          const { offerSent } = await sendAiReply(contact.id, aiMode, emotionalTemp, intentScore, contact.conv_state);
          _logMode = aiMode;
          if (offerSent) { _logOfferSent = true; summary.offersSent++; contact.conv_state = "OFFER_SENT"; }
          else summary.repliesSent++;
        } else {
          // intentScore < VERY_LOW but still use aiMode (not hard-coded "casual") so
          // auto-detection can inspect the full conversation history. Short follow-up
          // messages ("Abhi", "To kese milega?") score 0 in isolation but the full
          // transcript still contains the prior high-intent keywords — bypassing
          // auto-mode here permanently prevented the offer transition for those polls.
          const { offerSent } = await sendAiReply(contact.id, aiMode, emotionalTemp, intentScore, contact.conv_state);
          _logMode = aiMode;
          if (offerSent) { _logOfferSent = true; summary.offersSent++; contact.conv_state = "OFFER_SENT"; }
          else summary.repliesSent++;
        }
        if (contact.conv_state === "OFFER_SENT" && intentScore < INTENT_THRESHOLD.VERY_LOW) {
          try { await incrementOfferDeclined(contact.id); } catch (e) { console.error(`[POLL] incrementOfferDeclined failed for ${contact.id}:`, e); }
        }
      } else {
        replyFailed = true;
      }
    } catch (e) {
      replyFailed = true;
      const errMsg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`Response error for contact ${contact.id}: ${errMsg}`);
      try {
        await enqueueFailedAction("reengage", contact.id, errMsg);
        replyEnqueued = true;
      } catch (qe) {
        console.error(`[POLL] Failed to enqueue retry for contact ${contact.id}:`, qe);
      }
    }
  }

  const cursorSafe = !replyFailed || replyEnqueued;
  if (maxId > contact.last_synced_message_id && cursorSafe) {
    await updateSyncCursor(contact.conversation_id, maxId);
  } else if (maxId > contact.last_synced_message_id && !cursorSafe) {
    summary.errors.push(`[POLL] Cursor held for contact ${contact.id} — retry enqueue failed, will re-process next poll`);
  }
  if (replyFailed) {
    summary.errors.push(`Reply skipped for contact ${contact.id} (queued for retry)`);
  }

  console.log(JSON.stringify({
    event: "conversation",
    contact_id: contact.id,
    reply_latency_ms: Date.now() - tJob,
    intent_score: _logIntentScore,
    mode: _logMode,
    offer_triggered: _logOfferTriggered,
    offer_sent: _logOfferSent,
    payment_detected: _logPaymentDetected,
    unlock_sent: _logUnlockSent,
    conversation_state: contact.conv_state,
    in_cooldown: _logInCooldown,
    has_purchase_intent: _logHasPurchaseIntent,
    has_content_intent: _logHasContentIntent,
    direct_offer_signal: _logDirectOfferSignal,
    repeated_content_signal: _logRepeatedContentSignal,
    current_poll_mode: _logCurrentPollMode,
  }));
}
// ────────────────────────────────────────────────────────────────────────────

// Lock value is an ISO expiry timestamp (not a boolean). Comparing against now()
// means Vercel killing the function mid-run auto-expires the lock at the stored
// time — eliminating the previous 30–90 s dead-window where the next cron skipped
// because updated_at was still fresh even though the function was already dead.
const POLL_LOCK_DURATION_MS = 58_000; // slightly under Vercel's 60 s maxDuration

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
  const offerSettings = await getCachedOfferSettings();
  const { automatedReplies, aiMode } = offerSettings;

  try {
    // Atomic compare-and-set lock: INSERT OR REPLACE only succeeds when the
    // existing lock is NULL or expired (value < now()). This eliminates the
    // TOCTOU race where two concurrent polls both pass getLockStatus() and
    // overwrite each other's lock.
    try {
      const tLock = Date.now();
      const db = await getDb();
      const expiresAt = new Date(Date.now() + POLL_LOCK_DURATION_MS).toISOString();
      const now = new Date().toISOString();
      const result = await db
        .prepare(
          `INSERT OR REPLACE INTO settings (key, value, updated_at)
           SELECT 'is_polling', ?, ?
           WHERE NOT EXISTS (
             SELECT 1 FROM settings
             WHERE key = 'is_polling'
               AND value >= ?
           )`
        )
        .run(expiresAt, now, now);
      console.log(JSON.stringify({ stage: "lock_acquire", ms: Date.now() - tLock, acquired: result.changes > 0 }));
      if (result.changes === 0) {
        console.warn(`[Poll] Another poll is already in progress, skipping`);
        return summary;
      }
    } catch (e) {
      summary.errors.push(`Lock acquire failed: ${e instanceof Error ? e.message : String(e)}`);
      return summary;
    }

    try {
      const tConnect = Date.now();
      await ensureConnected();
      const client = await getTelegramClient();
      await client.getMe(); // validate session is alive
      console.log(JSON.stringify({ stage: "connect_and_auth", ms: Date.now() - tConnect }));

      // Set offline immediately after connecting so users never see "Online"
      // during the dialog scan + AI generation window (which can be 10–120 s).
      // Telegram will automatically restore Online when SetTyping fires in
      // sendMessage.ts just before the reply is delivered — the user sees a
      // brief "typing…" indicator and then the message, which is the correct UX.
      const tOffline = Date.now();
      try {
        await client.invoke(new Api.account.UpdateStatus({ offline: true }));
        console.log(JSON.stringify({ stage: "set_offline", ms: Date.now() - tOffline }));
      } catch (e) {
        console.warn("[Poll] Failed to set initial offline status:", e);
      }

      const tDueReplies = Date.now();
      if (automatedReplies) {
        await sendDueReplies(summary);
      }
      console.log(JSON.stringify({ stage: "send_due_replies", ms: Date.now() - tDueReplies }));

      const tContacts = Date.now();
      const knownContacts = await listContactConversations();
      const knownMap = new Map<string, ContactWithConv>();
      for (const c of knownContacts) {
        knownMap.set(c.telegram_id, c);
      }
      console.log(JSON.stringify({ stage: "list_contacts", count: knownContacts.length, ms: Date.now() - tContacts }));

      // Collected during Phase 1 (dialog scan); dispatched concurrently in Phase 2.
      const replyJobs: ReplyJob[] = [];
      const tPhase1 = Date.now();

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

            const saved = await createMessage(contact.id, text, "incoming", msgId, contact.conversation_id);
            if (saved) {
              summary.newMessages++;
              incomingMessages.push({ text });
            }
          }

          // Phase 1: collect contacts that need a reply for concurrent dispatch.
          // Contacts with only outgoing-sync activity get their cursor advanced now;
          // contacts with new incoming messages are deferred to Phase 2 below.
          if (incomingMessages.length > 0) {
            replyJobs.push({ contact, incomingMessages, maxId });
          } else if (maxId > minId) {
            // Outgoing messages advanced maxId but no reply needed — safe to move cursor.
            sendReadAcknowledgement(contact, maxId);
            await updateSyncCursor(contact.conversation_id, maxId);
          }
        } catch (e) {
          console.error(`[POLL] Message iteration error for contact ${contact.id}:`, e);
          summary.errors.push(
            `Iteration error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      console.log(JSON.stringify({
        stage: "phase1_scan",
        dialogsChecked: summary.dialogsChecked,
        replyJobs: replyJobs.length,
        phase1Ms: Date.now() - tPhase1,
      }));

      // Phase 2: dispatch reply jobs with bounded concurrency (REPLY_CONCURRENCY=3).
      // Each batch of 3 contacts runs their AI calls in parallel; batches are serial
      // so total concurrent Turso+OpenRouter connections stay bounded.
      for (let i = 0; i < replyJobs.length; i += REPLY_CONCURRENCY) {
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          console.warn("[Poll] Timeout reached during reply dispatch, remaining jobs skipped");
          break;
        }
        const batch = replyJobs.slice(i, i + REPLY_CONCURRENCY);
        await Promise.allSettled(
          batch.map(job => processReplyJob(job, summary, automatedReplies, aiMode)),
        );
      }

      console.log(`[Poll] Completed — dialogs=${summary.dialogsChecked} new=${summary.newMessages} replies=${summary.repliesSent} elapsed=${Date.now() - startTime}ms`);
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
    // Clear the cached settings so the next poll fetches fresh values
    _offerSettingsCache = null;
    try {
      // Write a past expiry to release the lock. A string value that parses as
      // a date < now is treated as "not polling" by getLockStatus.
      await updateSetting("is_polling", new Date(0).toISOString());
    } catch (e) {
      console.error("[Poll] Failed to release polling lock:", e);
    }
  }

  // Fire-and-forget self-trigger: schedule the next poll immediately instead of
  // waiting for the GitHub Actions 60s cron. This reduces the gap between polls
  // to ~poll_duration + HTTP round-trip (~100ms). On Vercel Hobby (1 concurrent
  // execution) the request is queued until the current invocation finishes.
  // The GitHub Actions 60s cron acts as a safety net if the chain breaks.
  try {
    const appUrl = getAppUrl();
    const secret = process.env.CRON_SECRET;
    if (appUrl && secret) {
      fetch(`${appUrl}/api/telegram/poll`, {
        method: "POST",
        headers: { "x-cron-secret": secret, "content-type": "application/json" },
        // 8 s gives Vercel enough time to cold-start and accept the request.
        // The previous 2 s limit caused silent chain breaks on cold starts (300 ms–3 s+),
        // falling back to the GitHub Actions 60 s cron and causing visible reply delays.
        signal: AbortSignal.timeout(8000),
      }).catch((e) => {
        console.warn("[Poll] Self-chain trigger failed:", e instanceof Error ? e.message : String(e));
      });
    }
  } catch {}

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
