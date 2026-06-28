/**
 * Two-part investigation:
 * 1. Get linked_chat_id from Nayra channel's GetFullChannel
 * 2. Check last 10 messages in each user DM
 */
import "dotenv/config";
import { getTelegramClient } from "../src/lib/telegram/client";
import { Api } from "telegram";
import bigInt from "big-integer";

async function main() {
  const client = await getTelegramClient();
  await client.connect();

  // ── PART 1: Get Nayra channel's FullChannel info ───────────
  console.log("=== PART 1: NAYRA CHANNEL FULL INFO ===");
  for await (const dialog of client.iterDialogs()) {
    const entity = dialog.entity as any;
    if (entity.title === "Nayra" && entity instanceof Api.Channel) {
      console.log(`Found Nayra channel: id=${entity.id}`);

      // Use the ENTITY OBJECT for getFullChannel
      try {
        const full = await client.invoke(
          new Api.channels.GetFullChannel({ channel: entity })
        ) as any;

        const fc = full.fullChat;
        if (fc) {
          console.log("\nFullChat properties:");
          // Dump ALL properties
          for (const key of Object.keys(fc)) {
            try {
              const val = (fc as any)[key];
              if (typeof val !== "object" && val !== undefined) {
                console.log(`  ${key}: ${val}`);
              } else if (val && val.constructor) {
                console.log(`  ${key}: [${val.constructor.name}]`);
              } else {
                console.log(`  ${key}: ${val}`);
              }
            } catch {}
          }
        }

        // Check chats from response
        if (full.chats) {
          console.log("\nChats in response:");
          for (const chat of full.chats) {
            const c = chat as any;
            console.log(`  id=${c.id} title="${c.title}" type=${c.constructor.name} megagroup=${c.megagroup} broadcast=${c.broadcast}`);
          }
        }
      } catch (e: any) {
        console.log("GetFullChannel error:", e.message);
      }
      break;
    }
  }

  // ── PART 2: Check last 10 messages in each user DM ────────
  console.log("\n=== PART 2: LAST MESSAGES IN USER DMS ===");
  for await (const dialog of client.iterDialogs()) {
    const entity = dialog.entity;
    if (entity instanceof Api.User && !entity.bot && !entity.deleted && !entity.self) {
      const name = [entity.firstName, entity.lastName].filter(Boolean).join(" ") || entity.username || "?";
      console.log(`\n--- ${name} (id=${entity.id}) ---`);

      let msgCount = 0;
      let foundOut = false;
      try {
        for await (const msg of client.iterMessages(entity.id, { limit: 10 })) {
          msgCount++;
          const m = msg as any;
          const text = (m.message ?? "").slice(0, 100);
          // Print only if it's a recent message (outgoing from Dew or incoming from user)
          if (msgCount <= 3) {
            console.log(`  [${m.out ? "DEW→" : "→DEW"}] id=${m.id} date=${m.date} text="${text}"`);
          }
          if (m.out) foundOut = true;
        }
        console.log(`  Total: ${msgCount} msgs (${foundOut ? "with" : "NO"} outgoing)`);
      } catch (e: any) {
        console.log(`  Error: ${e.message}`);
      }
    }
  }

  // ── PART 3: Show dialog with unread count ──────────────────
  console.log("\n=== PART 3: DIALOGS WITH UNREAD ===");
  for await (const dialog of client.iterDialogs()) {
    const entity = dialog.entity;
    if (entity instanceof Api.User && !entity.bot && !entity.deleted && !entity.self) {
      const unread = (dialog as any).unreadCount ?? 0;
      if (unread > 0) {
        const name = [entity.firstName, entity.lastName].filter(Boolean).join(" ") || "?";
        console.log(`  ${name} (${entity.id}): ${unread} unread`);
      }
    }
  }
  console.log("  (no dialogs with unread messages)");

  console.log("\n=== DIAGNOSTIC COMPLETE ===");
}
main().catch((e) => { console.error("Crashed:", e); process.exit(1); });