import "dotenv/config";
import { getTelegramClient } from "../src/lib/telegram/client";
import { Api } from "telegram";

async function main() {
  const client = await getTelegramClient();
  const me = await client.getMe();
  console.log(`Bot: ${(me as Api.User).firstName} id=${me.id}`);

  for await (const dialog of client.iterDialogs()) {
    const entity = dialog.entity;
    if (entity instanceof Api.User && !entity.bot && !entity.deleted && !entity.self) {
      const name = [entity.firstName, entity.lastName].filter(Boolean).join(" ");
      console.log(`User: id=${entity.id} name="${name}" username=@${entity.username ?? "—"}`);
    }
  }
  console.log("\nNow iterating ALL contacts in DB for comparison:");
  const { getDb } = await import("../lib/db");
  const db = await getDb();
  const contacts = db.prepare("SELECT id, name, telegram_id, conv_state FROM contacts ORDER BY id").all() as any[];
  for (const c of contacts) {
    console.log(`DB contact: id=${c.id} name="${c.name}" tg=${c.telegram_id} state=${c.conv_state}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });