import { getDb } from "../lib/db/index";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const contactId = 19;
  const db = await getDb();
  const conv = await db.prepare("SELECT id FROM conversations WHERE contact_id = ?").get(contactId) as { id: number };
  if (!conv) {
    console.log("No conversation found for contact 19");
    return;
  }
  
  // Set sync cursor to 0 to re-process ALL messages
  await db.prepare("UPDATE conversations SET last_synced_message_id = 0 WHERE id = ?").run(conv.id);
  // Reset state
  await db.prepare("UPDATE contacts SET conv_state = 'FREE_CHAT', offer_sent = 0, offer_sent_at = NULL WHERE id = ?").run(contactId);
  
  console.log(`Reset sync for contact 19 (conv ${conv.id})`);
}

main().catch(console.error).finally(() => process.exit(0));
