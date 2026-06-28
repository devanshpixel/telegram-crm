import "dotenv/config";
import { getDb } from "../lib/db";

async function main() {
  const db = await getDb();
  const contacts = db.prepare("SELECT id, name, telegram_id, conv_state, created_at FROM contacts ORDER BY id DESC LIMIT 5").all() as any[];
  console.log(JSON.stringify(contacts, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });