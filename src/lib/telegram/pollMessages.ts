import bigInt from "big-integer";
import { Api } from "telegram";
import { getDb, nowIso } from "@/lib/db";
import {
  createContact,
  createMessage,
  getMessagesByContactId,
} from "@/lib/db/service";
import type { ConversationRow } from "@/lib/db/types";
import type { ConvState } from "@/types";
import { razorpay } from "@/lib/razorpay";
import { suggestReply } from "@/lib/ai/suggest-reply";
import { getTelegramClient } from "./client";
import { sendTelegramMessage } from "./sendMessage";

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

async function getIncomingMessageCount(contactId: number): Promise<number> {
  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT COUNT(*) AS count FROM messages WHERE contact_id = ? AND direction = 'incoming'",
    )
    .get(contactId)) as { count: number };
  return row?.count ?? 0;
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

function getOfferPrice(): number {
  const raw = process.env.OFFER_PRICE;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 499;
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
  const contacts = await listContactConversations();
  const match = contacts.find((c) => c.telegram_id === telegramId);
  if (!match) throw new Error("Failed to create contact from dialog");
  return match;
}

async function sendAiReply(
  contactId: number,
  mode: "casual" | "premium" = "casual",
): Promise<void> {
  const messages = await getMessagesByContactId(contactId);
  const recent = messages.slice(-20);
  const reply = await suggestReply(recent, mode);
  await sendTelegramMessage(contactId, reply);
}

export async function createPaymentLink(contactId: number): Promise<string> {
  if (!razorpay) throw new Error("Razorpay not configured");
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const amount = getOfferPrice();
  const paymentLink = await razorpay.paymentLink.create({
    amount: amount,
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
  const link = await createPaymentLink(contactId);
  const text =
    `Hey! You've been enjoying the chat so here's something special 🔥\n\n` +
    `Unlock premium access for exclusive content, behind-the-scenes, and unlimited chat.\n\n` +
    `👉 ${link}`;
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

export async function pollIncomingMessages(): Promise<PollSummary> {
  const summary: PollSummary = {
    dialogsChecked: 0,
    newMessages: 0,
    repliesSent: 0,
    offersSent: 0,
    remindersSent: 0,
    errors: [],
  };

  try {
    await ensureConnected();
  } catch (e) {
    summary.errors.push(
      "Telegram connect failed: " + (e instanceof Error ? e.message : String(e)),
    );
    return summary;
  }

  const client = await getTelegramClient();
  const knownContacts = await listContactConversations();
  const knownMap = new Map<string, ContactWithConv>();
  for (const c of knownContacts) {
    knownMap.set(c.telegram_id, c);
  }

  for await (const dialog of client.iterDialogs()) {
    summary.dialogsChecked++;
    const entity = dialog.entity;
    if (!(entity instanceof Api.User)) continue;
    if (entity.bot || entity.deleted || entity.self) continue;

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
        if (!(message instanceof Api.Message) || !message.id) continue;
        if (message.out) continue;
        if (!message.message?.trim()) continue;
        if (message.id > maxId) maxId = message.id;

        const text = message.message.trim();
        const saved = await createMessage(contact.id, text, "incoming", message.id);
        if (!saved) {
          summary.errors.push(`Failed to save message for contact ${contact.id}`);
          continue;
        }
        summary.newMessages++;

        try {
          const count = await getIncomingMessageCount(contact.id);

          if (contact.conv_state === "PAID") {
            await sendAiReply(contact.id, "casual");
            summary.repliesSent++;
          } else if (contact.conv_state === "OFFER_SENT") {
            if (await shouldSendLockedResponse(contact.id)) {
              await sendLockedResponse(contact.id);
              summary.remindersSent++;
            }
          } else if (count <= 5) {
            await sendAiReply(contact.id, "casual");
            summary.repliesSent++;
          } else {
            await sendPremiumOffer(contact.id);
            summary.offersSent++;
            await setConvState(contact.id, "OFFER_SENT", nowIso());
          }
        } catch (e) {
          summary.errors.push(
            `Response error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } catch (e) {
      summary.errors.push(
        `Iteration error for contact ${contact.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (maxId > minId) {
      await updateSyncCursor(conversation.id, maxId);
    }
  }

  return summary;
}
