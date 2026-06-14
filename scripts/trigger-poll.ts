import { getDb } from "../lib/db/index";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const db = await getDb();
  
  // Find a conversation with incoming messages
  const messages = await db.prepare("SELECT conversation_id, id FROM messages WHERE direction = 'incoming' ORDER BY id DESC LIMIT 1").all() as { conversation_id: number, id: number }[];
  
  if (messages.length === 0) {
    console.log("No incoming messages found");
    return;
  }
  
  const convId = messages[0].conversation_id;
  const contactRow = await db.prepare("SELECT contact_id FROM conversations WHERE id = ?").get(convId) as { contact_id: number };
  const contactId = contactRow.contact_id;
  
  // Delete all but 2 messages for this conversation to trigger AI reply logic
  const allMessages = await db.prepare("SELECT id FROM messages WHERE conversation_id = ? AND direction = 'incoming' ORDER BY id ASC").all(convId) as { id: number }[];
  if (allMessages.length > 2) {
    const toDelete = allMessages.slice(0, allMessages.length - 2);
    for (const msg of toDelete) {
      await db.prepare("DELETE FROM messages WHERE id = ?").run(msg.id);
    }
  }

  // Update last_synced_message_id to just before the last incoming message
  await db.prepare("UPDATE conversations SET last_synced_message_id = ? WHERE id = ?").run(messages[0].id - 1, convId);
  await db.prepare("UPDATE contacts SET conv_state = 'FREE_CHAT', offer_sent_at = NULL WHERE id = ?").run(contactId);
  console.log(`Lowered last_synced_message_id for conversation ${convId} and reset conv_state to FREE_CHAT to trigger AI reply polling.`);
}

main().catch(console.error).finally(() => process.exit(0));
