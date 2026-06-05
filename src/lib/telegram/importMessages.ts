import bigInt from "big-integer";
import { Api } from "telegram";
import { getDb, nowIso } from "@/lib/db";
import { createMessage } from "@/lib/db/service";
import type { ContactRow, ConversationRow } from "@/lib/db/types";
import { getTelegramClient } from "./client";

export interface MessageImportSummary {
  contactsProcessed: number;
  messagesImported: number;
  messagesSkipped: number;
}

async function ensureConnected(): Promise<void> {
  const client = getTelegramClient();
  if (!client.connected) {
    await client.connect();
  }
}

function listTelegramContacts(): ContactRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM contacts
       WHERE telegram_id IS NOT NULL AND telegram_access_hash IS NOT NULL`,
    )
    .all() as ContactRow[];
}

function getConversationByContactId(
  contactId: number,
): ConversationRow | undefined {
  return getDb()
    .prepare("SELECT * FROM conversations WHERE contact_id = ?")
    .get(contactId) as ConversationRow | undefined;
}

function messageExists(
  conversationId: number,
  telegramMessageId: number,
): boolean {
  const row = getDb()
    .prepare(
      "SELECT id FROM messages WHERE conversation_id = ? AND telegram_message_id = ?",
    )
    .get(conversationId, telegramMessageId);
  return row !== undefined;
}

function updateSyncCursor(
  conversationId: number,
  lastSyncedMessageId: number,
): void {
  getDb()
    .prepare(
      "UPDATE conversations SET last_synced_message_id = ?, updated_at = ? WHERE id = ?",
    )
    .run(lastSyncedMessageId, nowIso(), conversationId);
}

function buildPeer(contact: ContactRow): Api.InputPeerUser {
  return new Api.InputPeerUser({
    userId: bigInt(contact.telegram_id!),
    accessHash: bigInt(contact.telegram_access_hash!),
  });
}

export async function importMessages(): Promise<MessageImportSummary> {
  await ensureConnected();
  const client = getTelegramClient();

  let contactsProcessed = 0;
  let messagesImported = 0;
  let messagesSkipped = 0;

  for (const contact of listTelegramContacts()) {
    const conversation = getConversationByContactId(contact.id);
    if (!conversation) continue;

    contactsProcessed++;
    const conversationId = conversation.id;
    const minId = conversation.last_synced_message_id;
    let maxMessageId = minId;
    const peer = buildPeer(contact);

    for await (const message of client.iterMessages(peer, {
      minId,
      reverse: true,
    })) {
      if (message instanceof Api.MessageService) {
        if (message.id && message.id > maxMessageId) {
          maxMessageId = message.id;
        }
        messagesSkipped++;
        continue;
      }

      if (!(message instanceof Api.Message) || !message.id) continue;

      if (message.id > maxMessageId) {
        maxMessageId = message.id;
      }

      const text = message.message?.trim() ?? "";
      if (!text) {
        messagesSkipped++;
        continue;
      }

      if (messageExists(conversationId, message.id)) {
        messagesSkipped++;
        continue;
      }

      const direction = message.out ? "outgoing" : "incoming";
      const created = createMessage(contact.id, text, direction, message.id);

      if (created) {
        messagesImported++;
      }
    }

    if (maxMessageId > minId) {
      updateSyncCursor(conversationId, maxMessageId);
    }
  }

  return { contactsProcessed, messagesImported, messagesSkipped };
}
