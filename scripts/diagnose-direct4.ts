/**
 * Extract "Nayra Messages" from GetDialogs response directly.
 */
import "dotenv/config";
import { getTelegramClient } from "../src/lib/telegram/client";
import { Api } from "telegram";
import bigInt from "big-integer";

async function main() {
  const client = await getTelegramClient();
  await client.connect();

  // ── Get all dialogs from folder 1 where Nayra lives ────────
  console.log("=== GETTING DIALOGS FROM FOLDER 1 ===");
  const dialogsResult = await client.invoke(
    new Api.messages.GetDialogs({
      offsetDate: 0,
      offsetId: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      limit: 100,
      hash: bigInt(0),
      folderId: 1,
    })
  ) as any;

  console.log(`Dialogs count: ${dialogsResult.dialogs?.length ?? 0}`);
  console.log(`Chats count: ${dialogsResult.chats?.length ?? 0}`);
  console.log(`Users count: ${dialogsResult.users?.length ?? 0}`);

  let nayraMessagesEntity: any = null;

  // Print all chats in detail
  console.log("\n=== CHATS IN FOLDER 1 ===");
  for (const chat of (dialogsResult.chats ?? [])) {
    const c = chat as any;
    const className = c.constructor.name;
    console.log(`\nid=${c.id} title="${c.title}" className=${className}`);
    
    if (c instanceof Api.Channel) {
      console.log(`  broadcast=${c.broadcast} megagroup=${c.megagroup} forum=${c.forum}`);
      console.log(`  accessHash=${c.accessHash}`);
      console.log(`  participantsCount=${c.participantsCount}`);
      console.log(`  min=${c.min}`);
      console.log(`  creator=${c.creator}`);

      // Dump all props
      for (const key of Object.keys(c)) {
        try {
          const val = (c as any)[key];
          if (typeof val !== "object") {
            console.log(`  ${key}: ${val}`);
          }
        } catch {}
      }
    }

    if (c.title?.toLowerCase().includes("nayra") && c.title?.toLowerCase().includes("message")) {
      nayraMessagesEntity = c;
    }
  }

  if (!nayraMessagesEntity) {
    console.log("\n!!! 'Nayra Messages' NOT FOUND in chats array !!!");

    // Try searching by ID (the ID might be negative in the API)
    for (const chat of (dialogsResult.chats ?? [])) {
      const c = chat as any;
      // Try matching -100 prefix convention
      if (String(c.id).includes("1073992005731")) {
        nayraMessagesEntity = c;
        console.log(`  Found by ID match: id=${c.id} title="${c.title}"`);
        break;
      }
      // Try negative version
      if (String(c.id) === String(bigInt("1073992005731").negate())) {
        nayraMessagesEntity = c;
        console.log(`  Found by negated ID: id=${c.id} title="${c.title}"`);
        break;
      }
    }
  }

  if (nayraMessagesEntity) {
    console.log(`\n=== FOUND: "Nayra Messages" ===`);
    console.log(`id=${nayraMessagesEntity.id}`);
    console.log(`className=${nayraMessagesEntity.constructor.name}`);

    // ── Try iterMessages ──────────────────────────────────────
    console.log("\n=== iterMessages ON Nayra Messages ===");
    let msgCount = 0;
    try {
      for await (const msg of client.iterMessages(nayraMessagesEntity.id, { limit: 20 })) {
        msgCount++;
        const m = msg as any;
        const fromId = m.fromId?.userId?.toString() ?? m.peerId?.userId?.toString() ?? "?";
        const text = (m.message ?? "").slice(0, 80);
        console.log(`  [${m.out ? "OUT" : "IN"}] from=${fromId} id=${m.id} text="${text}"`);
      }
      console.log(`\nTotal: ${msgCount} messages`);
    } catch (e: any) {
      console.log("iterMessages error:", e.message);
    }

    // ── Try iterMessages using the entity directly ────────────
    console.log("\n=== iterMessages USING ENTITY DIRECTLY ===");
    msgCount = 0;
    try {
      for await (const msg of client.iterMessages(nayraMessagesEntity, { limit: 20 })) {
        msgCount++;
        const m = msg as any;
        const text = (m.message ?? "").slice(0, 80);
        console.log(`  [${m.out ? "OUT" : "IN"}] id=${m.id} text="${text}"`);
      }
      console.log(`\nTotal: ${msgCount} messages`);
    } catch (e: any) {
      console.log("iterMessages(entity) error:", e.message);
    }

    // ── Try GetHistory ────────────────────────────────────────
    console.log("\n=== messages.GetHistory ===");
    try {
      const history = await client.invoke(
        new Api.messages.GetHistory({
          peer: nayraMessagesEntity.id,
          limit: 10,
        })
      ) as any;
      console.log(`Messages count: ${history.messages?.length ?? 0}`);
      for (const msg of (history.messages ?? []).slice(0, 5)) {
        const m = msg as any;
        console.log(`  id=${m.id} text="${(m.message ?? "").slice(0, 60)}" out=${m.out}`);
      }
    } catch (e: any) {
      console.log("GetHistory error:", e.message);
    }
  } else {
    console.log("\nCould not find Nayra Messages entity anywhere.");
  }

  console.log("\n=== DIAGNOSTIC COMPLETE ===");
}
main().catch((e) => { console.error("Crashed:", e); process.exit(1); });