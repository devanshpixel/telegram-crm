import bigInt from "big-integer";
import { Api } from "telegram";
import { getDb, nowIso } from "@/lib/db";
import { createContact, createMessage, getContactByTelegramId } from "@/lib/db/service";
import type { ContactRow, ConversationRow } from "@/lib/db/types";
import { getTelegramClient } from "./client";

export interface MessageImportSummary {
  contactsProcessed: number;
  contactsCreated: number;
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

function formatUserName(user: Api.User): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.username || `User ${user.id}`;
}

function formatUsername(user: Api.User): string {
  return user.username ?? `user_${user.id}`;
}

export async function importDialogs(): Promise<number> {
  await ensureConnected();
  const client = getTelegramClient();

  let created = 0;
  for await (const dialog of client.iterDialogs()) {
    const entity = dialog.entity;
    if (!(entity instanceof Api.User)) continue;
    if (entity.bot || entity.deleted || entity.self) continue;

    const telegramId = entity.id.toString();
    if (getContactByTelegramId(telegramId)) continue;

    const accessHash = entity.accessHash?.toString();
    if (!accessHash) continue;

    createContact({
      name: formatUserName(entity),
      username: formatUsername(entity),
      phone: entity.phone ?? "",
      telegramId,
      telegramAccessHash: accessHash,
    });
    created++;
  }
  return created;
}

export async function importMessages(): Promise<MessageImportSummary> {
  const contactsCreated = await importDialogs();

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((message as any).id && (message as any).id > maxMessageId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          maxMessageId = (message as any).id;
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

  return { contactsProcessed, contactsCreated, messagesImported, messagesSkipped };
}
