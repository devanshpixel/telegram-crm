/**
 * Investigate "Nayra Messages" (id=1073992005731) — the likely DIRECT inbox.
 */
import "dotenv/config";
import { getTelegramClient } from "../src/lib/telegram/client";
import { Api } from "telegram";
import bigInt from "big-integer";

async function main() {
  const client = await getTelegramClient();

  const NAYRA_MSG_ID = bigInt("1073992005731");

  // ── 1. Get entity info ──────────────────────────────────────
  console.log("=== 1. RESOLVE 'Nayra Messages' ENTITY ===");
  try {
    // First get the entity
    const entity = await client.getEntity(NAYRA_MSG_ID);
    console.log(`Entity class: ${entity.constructor.name}`);
    console.log(`Entity id: ${entity.id}`);
    console.log(`Entity title: ${(entity as any).title ?? "—"}`);

    if (entity instanceof Api.Channel) {
      console.log(`  broadcast=${entity.broadcast}`);
      console.log(`  megagroup=${entity.megagroup}`);
      console.log(`  forum=${entity.forum}`);
      console.log(`  gigagroup=${entity.gigagroup}`);
      console.log(`  min=${entity.min}`);
      console.log(`  accessHash: ${(entity as any).accessHash}`);

      // Get full info
      try {
        const full = await client.invoke(
          new Api.channels.GetFullChannel({ channel: entity.id })
        ) as any;
        if (full.fullChat) {
          console.log("Full chat props:");
          for (const key of Object.keys(full.fullChat)) {
            try {
              const val = (full.fullChat as any)[key];
              const str = typeof val === "object" ? `[${val?.constructor?.name}]` : String(val);
              console.log(`  ${key}: ${str}`);
            } catch {}
          }
        }
      } catch (e: any) {
        console.log("GetFullChannel error:", e.message);
      }
    } else if (entity instanceof Api.Chat) {
      console.log(`  Basic group: participants=${entity.participants_count}`);
    } else {
      console.log(`  Entity dump:`, Object.keys(entity));
    }
  } catch (e: any) {
    console.log("getEntity error:", e.message);
  }

  // ── 2. Try iterMessages ─────────────────────────────────────
  console.log("\n=== 2. iterMessages ON Nayra Messages ===");
  let msgCount = 0;
  let userMsgs = 0;
  let botMsgs = 0;
  try {
    for await (const msg of client.iterMessages(NAYRA_MSG_ID, { limit: 50 })) {
      msgCount++;
      const m = msg as any;
      const isOut = m.out;
      const fromId = m.fromId?.userId ?? m.peerId?.userId ?? m.senderId ?? "?";
      const text = (m.message ?? "").slice(0, 60);

      if (!isOut) {
        userMsgs++;
        if (userMsgs <= 5) {
          console.log(`  [IN]  from=${fromId} id=${m.id} text="${text}"`);
        }
      } else {
        botMsgs++;
        if (botMsgs <= 3) {
          console.log(`  [OUT] id=${m.id} text="${text}"`);
        }
      }
    }
    console.log(`\n  Total: ${msgCount} messages`);
    console.log(`  Incoming (from others): ${userMsgs}`);
    console.log(`  Outgoing (from Dew): ${botMsgs}`);
  } catch (e: any) {
    console.log("iterMessages error:", e.message);
  }

  // ── 3. Check if it's a forum with topics ────────────────────
  console.log("\n=== 3. CHECK FOR FORUM TOPICS ===");
  try {
    const entity = await client.getEntity(NAYRA_MSG_ID);
    if (entity instanceof Api.Channel && (entity as any).forum) {
      console.log("This IS a forum. Getting topics...");
      const topics = await client.invoke(
        new Api.channels.GetForumTopics({
          channel: entity.id,
          limit: 20,
        })
      ) as any;
      console.log(`Topics count: ${topics.count ?? topics.topics?.length ?? 0}`);
      if (topics.topics) {
        for (const t of topics.topics.slice(0, 10)) {
          console.log(`  Topic id=${t.id} title="${t.title}"`);
        }
      }
    } else {
      console.log("NOT a forum. Entity type:", entity.constructor.name);
    }
  } catch (e: any) {
    console.log("forum check error:", e.message);
  }

  // ── 4. Try to identify user-specific messages ───────────────
  console.log("\n=== 4. SENDER ANALYSIS ===");
  const senders = new Map<string, number>();
  try {
    for await (const msg of client.iterMessages(NAYRA_MSG_ID, { limit: 200 })) {
      const m = msg as any;
      if (!m.out) {
        // Get the sender
        let senderId: string;
        try {
          if (m.fromId?.userId) {
            senderId = m.fromId.userId.toString();
          } else if (m.peerId?.userId) {
            senderId = m.peerId.userId.toString();
          } else {
            senderId = "unknown";
          }
        } catch {
          senderId = "unknown";
        }
        senders.set(senderId, (senders.get(senderId) ?? 0) + 1);
      }
    }
    console.log(`Incoming messages analyzed from ${senders.size} senders`);
    for (const [senderId, count] of senders) {
      // Try to get the user's name
      let name = "?";
      try {
        const user = await client.getEntity(bigInt(senderId));
        name = (user as Api.User).firstName ?? "?";
      } catch {}
      console.log(`  ${name} (${senderId}): ${count} messages`);
    }
  } catch (e: any) {
    console.log("sender analysis error:", e.message);
  }

  console.log("\n=== DIAGNOSTIC COMPLETE ===");
}
main().catch((e) => { console.error("Crashed:", e); process.exit(1); });