import bigInt from "big-integer";
import { Api } from "telegram";
import { getDb } from "@/lib/db";
import { createContact } from "@/lib/db/service";
import { getTelegramClient } from "./client";
import type { TelegramClient } from "telegram";

const DB_PATH =
  process.env.NODE_ENV === "production"
    ? "/tmp/crm.db"
    : "data/crm.db";

export interface ContactImportSummary {
  total: number;
  imported: number;
  skipped: number;
}

async function ensureConnected(): Promise<void> {
  const client = await getTelegramClient();

  if (!(client as any).connected) {
    await client.connect();
  }
}

async function contactExistsByTelegramId(telegramId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db
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
  console.log("[IMPORT] DB_PATH =", DB_PATH);
  const db = await getDb();
  const beforeContacts = (await db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number })?.count ?? 0;
  const beforeConversations = (await db.prepare("SELECT COUNT(*) AS count FROM conversations").get() as { count: number })?.count ?? 0;
  const beforeMessages = (await db.prepare("SELECT COUNT(*) AS count FROM messages").get() as { count: number })?.count ?? 0;
  console.log("[IMPORT] contacts before:", beforeContacts);
  console.log("[IMPORT] conversations before:", beforeConversations);
  console.log("[IMPORT] messages before:", beforeMessages);

  await ensureConnected();
  const client = await getTelegramClient();
  const users = await fetchTelegramContactUsers(client);

  console.log("[IMPORT] fetched users:", users.length);

  let total = 0;
  let imported = 0;
  let skipped = 0;

  for (const entity of users) {
    if (entity.bot || entity.deleted || entity.self) continue;

    total++;
    const telegramId = entity.id.toString();

    if (await contactExistsByTelegramId(telegramId)) {
      skipped++;
      continue;
    }

    const accessHash = entity.accessHash?.toString();
    if (!accessHash) {
      skipped++;
      continue;
    }

    await createContact({
      name: formatUserName(entity),
      username: formatUsername(entity),
      phone: entity.phone ?? "",
      telegramId,
      telegramAccessHash: accessHash,
    });
    imported++;
  }

  const afterContacts = (await db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number })?.count ?? 0;
  const afterConversations = (await db.prepare("SELECT COUNT(*) AS count FROM conversations").get() as { count: number })?.count ?? 0;
  const afterMessages = (await db.prepare("SELECT COUNT(*) AS count FROM messages").get() as { count: number })?.count ?? 0;
  console.log("[IMPORT] contacts after:", afterContacts);
  console.log("[IMPORT] conversations after:", afterConversations);
  console.log("[IMPORT] messages after:", afterMessages);
  console.log("[IMPORT] summary:", { total, imported, skipped });

  return { total, imported, skipped };
}
