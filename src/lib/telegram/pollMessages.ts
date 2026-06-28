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
  emotionalTemp: number = 50,
  intentScore: number = 0,
): Promise<{ offerSent: boolean }> {
  const messages = await getMessagesByContactId(contactId);
  const recent = messages.slice(-20);
  const _t_suggest = Date.now();
  console.log(`[TIMING] START suggestReply contactId=${contactId} mode=${mode}`);
  let reply = await suggestReply(recent, mode, emotionalTemp, intentScore);
  console.log(`[TIMING] END suggestReply contactId=${contactId} (${Date.now() - _t_suggest}ms)`);
  console.log(`[PIPELINE:6] AI reply generated — contactId=${contactId} mode=${mode} reply="${reply.slice(0, 80)}"`);

  // The AI persona emits a literal "[LINK]" token when it decides to convert
  // the fan (sales/conversion phase). Nothing else substitutes it, so we MUST
  // replace it with a real payment link here — otherwise the fan receives a
  // dead "[LINK]" placeholder and can never pay (lost sale on the hottest lead).
  const linkMatch = reply.match(/\[link\]/i);
  if (linkMatch) {
    let linkSent = false;
    try {
      const settings = await getOfferSettings();
      const amount = await selectOfferAmount(contactId, settings.offerPrice);
      const link = await createPaymentLink(contactId, amount);
      reply = reply.replace(/\[link\]/gi, link).trim();
      const _t_send_link = Date.now();
      console.log(`[TIMING] START sendTelegramMessage[link] contactId=${contactId}`);
      await sendTelegramMessage(contactId, reply);
      console.log(`[TIMING] END sendTelegramMessage[link] contactId=${contactId} (${Date.now() - _t_send_link}ms)`);
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

  const _t_send_reply = Date.now();
  console.log(`[TIMING] START sendTelegramMessage contactId=${contactId}`);
  await sendTelegramMessage(contactId, reply);
  console.log(`[TIMING] END sendTelegramMessage contactId=${contactId} (${Date.now() - _t_send_reply}ms)`);
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


export const LOCKED_MESSAGES = [
  `Baby, this chat is locked now 😘💕 Unlock here for my exclusive content: `,
  `Still thinking? 😏 Meri private stuff is waiting inside... don't miss out: `,
  `Last chance babe 🥺 After this I'm closing the door for a while. Join fast: `,
];

const SEGMENT_LOCKED_INTERVALS: Record<string, number> = {
  prospect: 12,
  buyer: 18,
  premium: 24,
  high_value: 36,
  vip: 48,
  whale: 72,
};

const SEGMENT_LOCKED_MESSAGES: Record<string, string[]> = {
  prospect: [
    `hey! this chat is locked now 😘💕 unlock for exclusive content: `,
    `still here? 😏 my private stuff is waiting... don't miss out: `,
    `last chance 🥺 closing the door soon. join now: `,
  ],
  buyer: [
    `baby, locked chat time 😘💕 unlock your vip access here: `,
    `you liked it last time... ready for more? 😏 unlock here: `,
    `final reminder 🥺 door's closing. grab your access: `,
  ],
  premium: [
    `premium chat locked 😘💕 your exclusive content awaits: `,
    `still thinking? 😏 the good stuff is inside... unlock: `,
    `last call babe 🥺 this offer expires soon: `,
  ],
  high_value: [
    `hey you! locked chat for my favs 😘💕 unlock premium: `,
    `missed you in my vip 😏 the exclusive stuff is waiting: `,
    `final chance 🥺 this tier won't stay open long: `,
  ],
  vip: [
    `vip access locked 😘💕 your private content is ready: `,
    `exclusive tier still open 😏 don't let it slip: `,
    `closing vip doors 🥺 last chance for this tier: `,
  ],
  whale: [
    `my vip lounge is locked 😘💕 your content awaits: `,
    `whale tier exclusive 😏 the best stuff is inside: `,
    `final vip call 🥺 doors closing on this tier: `,
  ],
  default: [
    `Baby, this chat is locked now 😘💕 Unlock here for my exclusive content: `,
    `Still thinking? 😏 Meri private stuff is waiting inside... don't miss out: `,
    `Last chance babe 🥺 After this I'm closing the door for a while. Join fast: `,
  ],
};

async function getSegmentLockedInterval(segment: string): Promise<number> {
  return SEGMENT_LOCKED_INTERVALS[segment] ?? 24;
}

async function getSegmentLockedMessages(segment: string): Promise<string[]> {
  return SEGMENT_LOCKED_MESSAGES[segment] ?? SEGMENT_LOCKED_MESSAGES.default;
}

export async function sendLockedResponse(contactId: number): Promise<void> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT locked_response_count, spend_segment FROM contacts WHERE id = ?")
    .get(contactId) as { locked_response_count: number; spend_segment: string } | undefined;
  const count = row?.locked_response_count ?? 0;
  const segment = row?.spend_segment ?? "default";

  const messages = await getSegmentLockedMessages(segment);
  if (count >= messages.length) {
    await setConvState(contactId, "FREE_CHAT");
    await setOfferCooldown(contactId, 7);
    return;
  }

  const settings = await getOfferSettings();
  const amount = await selectOfferAmount(contactId, settings.offerPrice);
  const link = await createPaymentLink(contactId, amount);
  const text = messages[count] + link;

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
  const segment = row.spend_segment ?? "default";
  const messages = await getSegmentLockedMessages(segment);
  if ((row.locked_response_count ?? 0) >= messages.length) return false;
  if (!row.last_locked_response_at) return true;
  const intervalHours = await getSegmentLockedInterval(segment);
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
      const _t_connect = Date.now();
      console.log("[TIMING] START ensureConnected");
      await ensureConnected();
      console.log(`[TIMING] END ensureConnected (${Date.now() - _t_connect}ms)`);

      const _t_client = Date.now();
      console.log("[TIMING] START getTelegramClient");
      const client = await getTelegramClient();
      console.log(`[TIMING] END getTelegramClient (${Date.now() - _t_client}ms)`);

      const _t_getMe = Date.now();
      console.log("[TIMING] START getMe");
      const me = await client.getMe(); // validate session is alive
      console.log(`[TIMING] END getMe (${Date.now() - _t_getMe}ms)`);
      console.log(`[PIPELINE:1] Telegram connected — self userId=${me?.id} username=${me?.username ?? "—"}`);

      const knownContacts = await listContactConversations();
      console.log(`[PIPELINE:2] Poll started — ${knownContacts.length} known contacts in DB`);
      const knownMap = new Map<string, ContactWithConv>();
      for (const c of knownContacts) {
        knownMap.set(c.telegram_id, c);
      }

      let _dialogTick = 0;
      let _t_lastDialogTick = Date.now();
      console.log("[TIMING] START iterDialogs");
      for await (const dialog of client.iterDialogs({ folder: 0 })) {
        _dialogTick++;
        const _t_thisDialog = Date.now();
        console.log(`[TIMING] TICK iterDialogs #${_dialogTick} entity=${dialog.entity?.constructor?.name ?? "unknown"} (${_t_thisDialog - _t_lastDialogTick}ms since prev tick)`);
        _t_lastDialogTick = _t_thisDialog;

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
            const _t_createContact = Date.now();
            console.log(`[TIMING] START createContactFromDialog telegramId=${telegramId}`);
            contact = await createContactFromDialog(entity);
            console.log(`[TIMING] END createContactFromDialog telegramId=${telegramId} (${Date.now() - _t_createContact}ms)`);
            knownMap.set(telegramId, contact);
            console.log(`[PIPELINE:3] New contact created — contactId=${contact.id} telegramId=${telegramId} name=${formatUserName(entity)}`);
          } catch (e) {
            summary.errors.push(
              `Failed to create contact for ${telegramId}: ${e instanceof Error ? e.message : String(e)}`,
            );
            continue;
          }
        } else {
          console.log(`[PIPELINE:3] Known contact — contactId=${contact.id} telegramId=${telegramId} cursor=${contact.last_synced_message_id}`);
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

          let _msgTick = 0;
          const _t_iterMessages = Date.now();
          console.log(`[TIMING] START iterMessages contactId=${contact.id} minId=${minId}`);
          for await (const message of client.iterMessages(peer, {
            minId,
            reverse: true,
            limit: 50,
          })) {
            _msgTick++;
            console.log(`[TIMING] TICK iterMessages #${_msgTick} contactId=${contact.id}`);
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

            const _t_createMsg = Date.now();
            console.log(`[TIMING] START createMessage contactId=${contact.id} msgId=${msgId}`);
            const saved = await createMessage(contact.id, text, "incoming", msgId);
            console.log(`[TIMING] END createMessage contactId=${contact.id} msgId=${msgId} (${Date.now() - _t_createMsg}ms)`);
            if (!saved) {
              summary.errors.push(`Failed to save message for contact ${contact.id}`);
              continue;
            }
            console.log(`[PIPELINE:4] Message saved to DB — contactId=${contact.id} msgId=${msgId} text="${text.slice(0, 60)}"`);
            incomingMessages.push({ text });
            summary.newMessages++;
          }

          console.log(`[TIMING] END iterMessages contactId=${contact.id} total=${_msgTick} (${Date.now() - _t_iterMessages}ms)`);

          // Batched reply: one response per contact per poll regardless of
          // how many messages arrived (BUG-5 fix).
          let replyFailed = false;
          if (incomingMessages.length > 0 && automatedReplies) {
            console.log(`[PIPELINE:5] ${incomingMessages.length} new message(s) for contactId=${contact.id} conv_state=${contact.conv_state} — computing reply`);
            try {
              await recalculateLeadScore(contact.id);
              await recalculateSpendSegment(contact.id);
              await recalculateBuyerIntelligence(contact.id);
              await recalculateCrmIntelligence(contact.id);
              const emotionalTemp = await updateEmotionalTemp(contact.id);
              const intentScore = await getIntentScore(incomingMessages);
              await updateRelationshipScore(contact.id);

              const skipReply = await shouldSkipDueToPacing(contact.id, emotionalTemp);
              console.log(`[PIPELINE:5] contactId=${contact.id} emotionalTemp=${emotionalTemp} intentScore=${intentScore} skipReply=${skipReply}`);

              if (!skipReply && contact.conv_state === "PAID") {
                const phase = await getPostPurchasePhase(contact.id);
                if (phase === "welcome") {
                  const welcomeMsg = "you're officially my VIP now 😘💕 i don't let everyone in here, so feel special. want to see what else i've got for my favs?";
                  await sendTelegramMessage(contact.id, welcomeMsg);
                  try { await markWelcomeSent(contact.id); } catch (e) { console.error(`[POLL] markWelcomeSent failed for ${contact.id}:`, e); }
                  summary.repliesSent++;
                } else if (phase === "reoffer") {
                  await sendPremiumOffer(contact.id);
                  summary.offersSent++;
                  contact.conv_state = "OFFER_SENT";
                } else {
                  await sendAiReply(contact.id, "casual", emotionalTemp, intentScore);
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
                    const slug = row.spend_segment ?? "default";
                    const msgs = await getSegmentLockedMessages(slug);
                    if ((row.locked_response_count ?? 0) >= msgs.length) {
                      await setConvState(contact.id, "FREE_CHAT");
                      await setOfferCooldown(contact.id, 7);
                    }
                  }
                }
              } else if (!skipReply) {
                const inCooldown = await isInOfferCooldown(contact.id);

                if (intentScore >= 60 && !inCooldown) {
                  await sendPremiumOffer(contact.id);
                  summary.offersSent++;
                  contact.conv_state = "OFFER_SENT";
                } else if (intentScore >= 30) {
                  const { offerSent } = await sendAiReply(contact.id, aiMode, emotionalTemp, intentScore);
                  if (offerSent) {
                    summary.offersSent++;
                    contact.conv_state = "OFFER_SENT";
                  } else {
                    summary.repliesSent++;
                  }
                } else {
                  const { offerSent } = await sendAiReply(contact.id, "casual", emotionalTemp, intentScore);
                  if (offerSent) {
                    summary.offersSent++;
                    contact.conv_state = "OFFER_SENT";
                  } else {
                    summary.repliesSent++;
                  }
                }

                if (contact.conv_state === "OFFER_SENT" && intentScore < 20) {
                  try { await incrementOfferDeclined(contact.id); } catch (e) { console.error(`[POLL] incrementOfferDeclined failed for ${contact.id}:`, e); }
                }
              }
            } catch (e) {
              replyFailed = true;
              summary.errors.push(
                `Response error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }

          if (!replyFailed && maxId > minId) {
            const _t_cursor = Date.now();
            console.log(`[TIMING] START updateSyncCursor convId=${contact.conversation_id} newMax=${maxId}`);
            await updateSyncCursor(contact.conversation_id, maxId);
            console.log(`[TIMING] END updateSyncCursor convId=${contact.conversation_id} (${Date.now() - _t_cursor}ms)`);
            console.log(`[PIPELINE:8] Sync cursor advanced — convId=${contact.conversation_id} ${minId} → ${maxId}`);
          }
        } catch (e) {
          console.error(`[POLL] Message iteration error for contact ${contact.id}:`, e);
          summary.errors.push(
            `Iteration error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      console.log(`[TIMING] END iterDialogs totalTicks=${_dialogTick} userDialogs=${summary.dialogsChecked} elapsed=${Date.now() - startTime}ms`);
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
