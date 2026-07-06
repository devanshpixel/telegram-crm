import bigInt from "big-integer";
import { Api, TelegramClient } from "telegram";
import { FloodWaitError } from "telegram/errors/RPCErrorList";
import { getDb, nowIso } from "@/lib/db";
import { createMessage, getConversationIdByContactId } from "@/lib/db/service";
import type { ContactRow } from "@/lib/db/types";
import type { Message } from "@/types";
import { getTelegramClient } from "./client";

const FLOOD_RETRY_MAX = 3;

async function typingDelay(client: TelegramClient, peer: Api.InputPeerUser, text: string): Promise<void> {
  try {
    await client.invoke(new Api.messages.SetTyping({
      peer,
      action: new Api.SendMessageTypingAction(),
    }));
  } catch {}
  // ~20ms per char, clamped 600ms–3s. Reduced from 40ms/char (1s–8s) which pushed
  // total reply latency over 5s for replies longer than ~60 chars. At 20ms/char a
  // 50-char reply shows ~1s of typing — still realistic for a fast mobile texter,
  // and the SetTyping action already signals "composing" to the user.
  const duration = Math.min(600, Math.max(200, Math.round(text.length * 8)));
  const t0 = Date.now();
  await new Promise(r => setTimeout(r, duration));
  console.log(JSON.stringify({ stage: "typing_delay", chars: text.length, targetMs: duration, actualMs: Date.now() - t0 }));
}

async function ensureConnected(): Promise<void> {
  const client = await getTelegramClient();
  if (!client.connected) {
    await client.connect();
  }
}

async function getContactById(contactId: number): Promise<ContactRow | undefined> {
  const db = await getDb();
  return (await db
    .prepare("SELECT * FROM contacts WHERE id = ?")
    .get(contactId)) as ContactRow | undefined;
}

function buildPeer(contact: ContactRow): Api.InputPeerUser {
  return new Api.InputPeerUser({
    userId: bigInt(contact.telegram_id!),
    accessHash: bigInt(contact.telegram_access_hash!),
  });
}

export async function sendTelegramMessage(
  contactId: number,
  text: string,
): Promise<Message> {
  // Strip any HTML tags the AI might have leaked (e.g. </blockquote>) before
  // they reach Telegram — plain-text MTProto rejects / renders them literally.
  const trimmedText = text.replace(/<[^>]*>/g, '').trim();
  if (!trimmedText) {
    throw new Error("Message text cannot be empty");
  }

  const contact = await getContactById(contactId);
  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }
  if (!contact.telegram_id) {
    throw new Error(`Contact ${contactId} is missing telegram_id`);
  }
  if (!contact.telegram_access_hash) {
    throw new Error(`Contact ${contactId} is missing telegram_access_hash`);
  }

  await ensureConnected();
  const client = await getTelegramClient();
  const peer = buildPeer(contact);

  const tSend = Date.now();

  // Typing indicator for the full message (shows realistic composing time)
  await typingDelay(client, peer, trimmedText);
  // Small random pause after typing stops — mirrors real human "sending" lag
  await new Promise(r => setTimeout(r, 50 + Math.random() * 150));

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FLOOD_RETRY_MAX; attempt++) {
    try {
      const tTelegram = Date.now();
      const sent = await client.sendMessage(peer, { message: trimmedText });

      if (!(sent instanceof Api.Message) || !sent.id) {
        throw new Error("Failed to send Telegram message");
      }

      let saved = await createMessage(contactId, trimmedText, "outgoing", sent.id);
      if (!saved) {
        // If no conversation exists, create one and retry
        const existingConv = await getConversationIdByContactId(contactId);
        if (!existingConv) {
          const db = await getDb();
          const ts = nowIso();
          const convResult = await db
            .prepare("INSERT INTO conversations (contact_id, last_message, last_message_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
            .run(contactId, trimmedText, ts, ts, ts);
          saved = await createMessage(contactId, trimmedText, "outgoing", sent.id, Number(convResult.lastInsertRowid));
        }
        if (!saved) {
          // Still null — likely the idempotency check (telegram_message_id already
          // exists). The Telegram message was already sent to the user; don't
          // throw or the caller will re-insert pending_reply and duplicate it.
          console.warn(`[sendMessage] createMessage returned null for contact ${contactId} (msg ${sent.id}) — already recorded`);
          // Return a minimal stub so the caller proceeds without duplication
          return { id: String(sent.id), text: trimmedText, direction: "outgoing", timestamp: new Date().toISOString(), read: true };
        }
      }

      console.log(JSON.stringify({
        stage: "telegram_send",
        contactId,
        chars: trimmedText.length,
        telegramMs: Date.now() - tTelegram,
        totalSendMs: Date.now() - tSend,
      }));

      return saved;
    } catch (err: unknown) {
      const e = err as Error & { seconds?: number };
      const isFlood =
        err instanceof FloodWaitError ||
        e.name === "FloodWaitError" ||
        (e.message && e.message.includes("FLOOD_WAIT"));

      if (isFlood) {
        lastError = e;
        const rawSeconds = e.seconds ?? Math.pow(2, attempt);
        // Cap at 45s — Vercel maxDuration is 60s and we need headroom for remaining
        // retries. For longer FloodWait values, bubble up so the retry queue handles it.
        if (rawSeconds > 45) {
          throw Object.assign(new Error(`FloodWait ${rawSeconds}s — too long to sleep inline`), { isFloodWait: true, seconds: rawSeconds });
        }
        console.warn(
          `[SEND_RETRY] FloodWait: sleeping ${rawSeconds}s for contact ${contactId} (attempt ${attempt}/${FLOOD_RETRY_MAX})`,
        );
        await new Promise((resolve) => setTimeout(resolve, rawSeconds * 1000));
        await ensureConnected();
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Failed to send message after retries");
}

export async function sendTelegramPhoto(
  contactId: number,
  photoPath: string,
  caption?: string,
): Promise<void> {
  const contact = await getContactById(contactId);
  if (!contact) throw new Error(`Contact not found: ${contactId}`);
  if (!contact.telegram_id) throw new Error(`Contact ${contactId} is missing telegram_id`);
  if (!contact.telegram_access_hash) throw new Error(`Contact ${contactId} is missing telegram_access_hash`);

  await ensureConnected();
  const client = await getTelegramClient();
  const peer = buildPeer(contact);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FLOOD_RETRY_MAX; attempt++) {
    try {
      const tSend = Date.now();
      await client.sendFile(peer, { file: photoPath, caption: caption ?? "" });
      console.log(JSON.stringify({
        stage: "telegram_photo_send",
        contactId,
        photoPath,
        totalSendMs: Date.now() - tSend,
      }));
      return;
    } catch (err: unknown) {
      const e = err as Error & { seconds?: number };
      const isFlood =
        err instanceof FloodWaitError ||
        e.name === "FloodWaitError" ||
        (e.message && e.message.includes("FLOOD_WAIT"));

      if (isFlood) {
        lastError = e;
        const rawSeconds = e.seconds ?? Math.pow(2, attempt);
        if (rawSeconds > 45) {
          throw Object.assign(new Error(`FloodWait ${rawSeconds}s — too long to sleep inline`), { isFloodWait: true, seconds: rawSeconds });
        }
        console.warn(`[SEND_RETRY] FloodWait: sleeping ${rawSeconds}s for photo to contact ${contactId} (attempt ${attempt}/${FLOOD_RETRY_MAX})`);
        await new Promise((resolve) => setTimeout(resolve, rawSeconds * 1000));
        await ensureConnected();
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Failed to send photo after retries");
}
