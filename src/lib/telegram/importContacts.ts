import bigInt from "big-integer";
import { Api } from "telegram";
import { getDb } from "@/lib/db";
import { createContact } from "@/lib/db/service";
import { getTelegramClient } from "./client";
import type { TelegramClient } from "telegram";

export interface ContactImportSummary {
  total: number;
  imported: number;
  skipped: number;
}

async function ensureConnected(): Promise<void> {
  const client = getTelegramClient();
  if (!client.connected) {
    await client.connect();
  }
}

function contactExistsByTelegramId(telegramId: string): boolean {
  const row = getDb()
    .prepare("SELECT id FROM contacts WHERE telegram_id = ?")
    .get(telegramId);
  return row !== undefined;
}

function formatUserName(user: Api.User): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.username || `User ${user.id}`;
}

function formatUsername(user: Api.User): string {
  return user.username ?? `user_${user.id}`;
}

async function fetchTelegramContactUsers(
  client: TelegramClient,
): Promise<Api.User[]> {
  const result = await client.invoke(
    new Api.contacts.GetContacts({ hash: bigInt.zero }),
  );

  if (result instanceof Api.contacts.ContactsNotModified) {
    return [];
  }

  if (!(result instanceof Api.contacts.Contacts)) {
    return [];
  }

  return result.users.filter(
    (user): user is Api.User => user instanceof Api.User,
  );
}

export async function importContacts(): Promise<ContactImportSummary> {
  await ensureConnected();
  const client = getTelegramClient();
  const users = await fetchTelegramContactUsers(client);

  let total = 0;
  let imported = 0;
  let skipped = 0;

  for (const entity of users) {
    if (entity.bot || entity.deleted || entity.self) continue;

    total++;
    const telegramId = entity.id.toString();

    if (contactExistsByTelegramId(telegramId)) {
      skipped++;
      continue;
    }

    const accessHash = entity.accessHash?.toString();
    if (!accessHash) {
      skipped++;
      continue;
    }

    createContact({
      name: formatUserName(entity),
      username: formatUsername(entity),
      phone: entity.phone ?? "",
      telegramId,
      telegramAccessHash: accessHash,
    });
    imported++;
  }

  return { total, imported, skipped };
}
