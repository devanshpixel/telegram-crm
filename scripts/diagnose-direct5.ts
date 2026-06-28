/**
 * Access Nayra Messages megagroup with proper InputPeerChannel.
 * ID=1073992005731, accessHash=3020895201056940616
 */
import "dotenv/config";
import { getTelegramClient } from "../src/lib/telegram/client";
import { Api } from "telegram";
import bigInt from "big-integer";

async function main() {
  const client = await getTelegramClient();
  await client.connect();

  const NAYRA_MSG_ID = bigInt("1073992005731");
  const NAYRA_MSG_HASH = bigInt("3020895201056940616");

  // Approach 1: InputPeerChannel with raw ID
  console.log("=== Approach 1: InputPeerChannel(raw ID) via iterMessages ===");
  const peer1 = new Api.InputPeerChannel({
    channelId: NAYRA_MSG_ID,
    accessHash: NAYRA_MSG_HASH,
  });
  let count = 0;
  try {
    for await (const msg of client.iterMessages(peer1, { limit: 10 })) {
      count++;
      const m = msg as any;
      if (count <= 3) console.log(`  [${m.out ? "OUT" : "IN"}] id=${m.id} text="${(m.message ?? "").slice(0, 60)}"`);
    }
    console.log(`  Total: ${count} messages`);
  } catch (e: any) {
    console.log("  Error:", e.message);
  }

  // Approach 2: Use GetHistory directly
  console.log("\n=== Approach 2: GetHistory with InputPeerChannel ===");
  try {
    const history = await client.invoke(
      new Api.messages.GetHistory({
        peer: peer1,
        limit: 10,
      })
    ) as any;
    console.log(`  Messages: ${history.messages?.length ?? 0}`);
    for (const msg of (history.messages ?? []).slice(0, 5)) {
      const m = msg as any;
      console.log(`  id=${m.id} from_id=${m.fromId?.userId ?? m.peerId?.userId ?? "?"} text="${(m.message ?? "").slice(0, 60)}" out=${m.out}`);
    }
  } catch (e: any) {
    console.log("  Error:", e.message);
  }

  // Approach 3: Try accessing as a user DM (maybe it's actually a user)
  console.log("\n=== Approach 3: Check if it resolves as a user ===");
  try {
    const entity = await client.getEntity(NAYRA_MSG_ID);
    console.log(`  Entity type: ${entity.constructor.name} id=${entity.id}`);
  } catch (e: any) {
    console.log("  getEntity error:", e.message);
  }

  // Approach 4: Check if -1000000000000 - NAYRA_MSG_ID works
  console.log("\n=== Approach 4: Try negated ID ===");
  const NEGATED = bigInt("-1000000000000").subtract(NAYRA_MSG_ID);
  console.log(`  Negated ID: ${NEGATED}`);
  try {
    const negHistory = await client.invoke(
      new Api.messages.GetHistory({
        peer: NEGATED,
        limit: 5,
      })
    ) as any;
    console.log(`  Messages: ${negHistory.messages?.length ?? 0}`);
  } catch (e: any) {
    console.log("  Error:", e.message);
  }

  // Approach 5: Try with -100 prefix
  console.log("\n=== Approach 5: -100 prefix ===");
  const WITH_PREFIX = bigInt("-100").shiftLeft(40).or(NAYRA_MSG_ID);
  // Actually, just try -100${NAYRA_MSG_ID} as a big integer
  const PREFIXED = bigInt("-1001073992005731");
  console.log(`  Prefixed ID: ${PREFIXED}`);
  try {
    const prefHistory = await client.invoke(
      new Api.messages.GetHistory({
        peer: new Api.InputPeerChannel({
          channelId: PREFIXED,
          accessHash: NAYRA_MSG_HASH,
        }),
        limit: 5,
      })
    ) as any;
    console.log(`  Messages: ${prefHistory.messages?.length ?? 0}`);
  } catch (e: any) {
    console.log("  Error:", e.message);
  }

  // Approach 6: Get the entity from the cached dialogs and use it directly
  console.log("\n=== Approach 6: Get entity from cached dialogs ===");
  try {
    // Get all dialogs again and find the entity object
    const dialogs = await client.invoke(
      new Api.messages.GetDialogs({
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        limit: 100,
        hash: bigInt(0),
        folderId: 1,
      })
    ) as any;

    for (const chat of dialogs.chats ?? []) {
      const c = chat as any;
      if (c.title === "Nayra Messages") {
        console.log(`  Found entity: id=${c.id} megagroup=${c.megagroup}`);

        // Try using the entity object directly
        try {
          for await (const msg of client.iterMessages(c, { limit: 10 })) {
            count++;
            const m = msg as any;
            console.log(`  [${m.out ? "OUT" : "IN"}] id=${m.id} text="${(m.message ?? "").slice(0, 80)}"`);
          }
          console.log(`  Total: ${count} messages`);
        } catch (e2: any) {
          console.log(`  iterMessages(chatEntity) error: ${e2.message}`);
        }
        break;
      }
    }
  } catch (e: any) {
    console.log("  Error:", e.message);
  }

  console.log("\n=== DIAGNOSTIC COMPLETE ===");
}
main().catch((e) => { console.error("Crashed:", e); process.exit(1); });