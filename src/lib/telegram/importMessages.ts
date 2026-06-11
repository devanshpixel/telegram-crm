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
  const client = await getTelegramClient();
  if (!client.connected) {
    await client.connect();
  }
}

async function listTelegramContacts(): Promise<ContactRow[]> {
  const db = await getDb();
  return (await db
    .prepare(
      `SELECT * FROM contacts
       WHERE telegram_id IS NOT NULL AND telegram_access_hash IS NOT NULL`,
    )
    .all()) as ContactRow[];
}

async function getConversationByContactId(
  contactId: number,
): Promise<ConversationRow | undefined> {
  const db = await getDb();
  return (await db
    .prepare("SELECT * FROM conversations WHERE contact_id = ?")
    .get(contactId)) as ConversationRow | undefined;
}

async function messageExists(
  conversationId: number,
  telegramMessageId: number,
): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .prepare(
      "SELECT id FROM messages WHERE conversation_id = ? AND telegram_message_id = ?",
    )
    .get(conversationId, telegramMessageId);
  return row !== undefined;
}

async function updateSyncCursor(
  conversationId: number,
  lastSyncedMessageId: number,
): Promise<void> {
  const db = await getDb();
  await db
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
  const client = await getTelegramClient();

  let created = 0;
  for await (const dialog of client.iterDialogs()) {
    const entity = dialog.entity;
    if (!(entity instanceof Api.User)) continue;
    if (entity.bot || entity.deleted || entity.self) continue;

    const telegramId = entity.id.toString();
    if (await getContactByTelegramId(telegramId)) continue;

    const accessHash = entity.accessHash?.toString();
    if (!accessHash) continue;

    await createContact({
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
  const client = await getTelegramClient();

  let contactsProcessed = 0;
  let messagesImported = 0;
  let messagesSkipped = 0;

  for (const contact of await listTelegramContacts()) {
    const conversation = await getConversationByContactId(contact.id);
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

      if (await messageExists(conversationId, message.id)) {
        messagesSkipped++;
        continue;
      }

      const direction = message.out ? "outgoing" : "incoming";
      const created = await createMessage(contact.id, text, direction, message.id);

      if (created) {
        messagesImported++;
      }
    }

    if (maxMessageId > minId) {
      await updateSyncCursor(conversationId, maxMessageId);
    }
  }

  return { contactsProcessed, contactsCreated, messagesImported, messagesSkipped };
}
