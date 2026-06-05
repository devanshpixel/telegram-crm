import bigInt from "big-integer";
import { Api } from "telegram";
import { getDb } from "@/lib/db";
import { createMessage } from "@/lib/db/service";
import type { ContactRow } from "@/lib/db/types";
import { getTelegramClient } from "./client";

export interface SendTelegramMessageResult {
  contactId: number;
  telegramMessageId: number;
  text: string;
  sentAt: string;
}

async function ensureConnected(): Promise<void> {
  const client = getTelegramClient();
  if (!client.connected) {
    await client.connect();
  }
}

function getContactById(contactId: number): ContactRow | undefined {
  return getDb()
    .prepare("SELECT * FROM contacts WHERE id = ?")
    .get(contactId) as ContactRow | undefined;
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
): Promise<SendTelegramMessageResult> {
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Message text cannot be empty");
  }

  const contact = getContactById(contactId);
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
  const client = getTelegramClient();
  const peer = buildPeer(contact);

  const sent = await client.sendMessage(peer, { message: trimmedText });
  if (!(sent instanceof Api.Message) || !sent.id) {
    throw new Error("Failed to send Telegram message");
  }

  const saved = createMessage(contactId, trimmedText, "outgoing", sent.id);
  if (!saved) {
    throw new Error(`No conversation found for contact ${contactId}`);
  }

  return {
    contactId,
    telegramMessageId: sent.id,
    text: trimmedText,
    sentAt: saved.timestamp.toISOString(),
  };
}
