import bigInt from "big-integer";
import { Api } from "telegram";
import { FloodWaitError } from "telegram/errors/RPCErrorList";
import { getDb } from "@/lib/db";
import { createMessage } from "@/lib/db/service";
import type { ContactRow } from "@/lib/db/types";
import type { Message } from "@/types";
import { getTelegramClient } from "./client";

const FLOOD_RETRY_MAX = 3;

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
  const trimmedText = text.trim();
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

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FLOOD_RETRY_MAX; attempt++) {
    try {
      const sent = await client.sendMessage(peer, { message: trimmedText });

      if (!(sent instanceof Api.Message) || !sent.id) {
        throw new Error("Failed to send Telegram message");
      }

      const saved = await createMessage(contactId, trimmedText, "outgoing", sent.id);
      if (!saved) {
        throw new Error(`No conversation found for contact ${contactId}`);
      }

      return saved;
    } catch (err: unknown) {
      const e = err as Error & { seconds?: number };
      const isFlood =
        err instanceof FloodWaitError ||
        e.name === "FloodWaitError" ||
        (e.message && e.message.includes("FLOOD_WAIT"));

      if (isFlood) {
        lastError = e;
        const seconds = e.seconds ?? Math.pow(2, attempt);
        console.warn(
          `[SEND_RETRY] FloodWait: sleeping ${seconds}s for contact ${contactId} (attempt ${attempt}/${FLOOD_RETRY_MAX})`,
        );
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        await ensureConnected();
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Failed to send message after retries");
}
