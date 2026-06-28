/**
 * DIRECT chat diagnostic.
 * Determines how GramJS exposes the "Nayra (DIRECT)" conversation.
 */
import "dotenv/config";
import { getTelegramClient } from "../src/lib/telegram/client";
import { Api } from "telegram";

async function main() {
  const client = await getTelegramClient();
  const me = await client.getMe();
  console.log(`=== AUTHENTICATED AS ===`);
  console.log(`  id: ${me.id}`);
  console.log(`  firstName: ${(me as Api.User).firstName}`);
  console.log(`  username: @${(me as Api.User).username ?? "—"}`);
  console.log(`  phone: ${(me as Api.User).phone ?? "—"}`);

  // ── 1. LIST ALL DIALOGS ──────────────────────────────────
  console.log(`\n=== ALL DIALOGS (iterDialogs) ===`);
  let dialogIndex = 0;
  const directDialogs: { index: number; dialog: any; entity: any }[] = [];

  for await (const dialog of client.iterDialogs()) {
    const entity = dialog.entity;
    const name = dialog.name ?? entity?.title ?? "[no name]";
    const entityType = entity?.constructor?.name ?? "unknown";
    const id = entity?.id?.toString() ?? "?";
    dialogIndex++;

    const isNayra = name.toLowerCase().includes("nayra") || name.toLowerCase().includes("direct");

    console.log(`\n[${dialogIndex}] Dialog: "${name}"`);
    console.log(`    id: ${id}`);
    console.log(`    type: ${entityType}`);
    console.log(`    isUser: ${entity instanceof Api.User}`);
    console.log(`    isChat: ${entity instanceof Api.Chat}`);
    console.log(`    isChannel: ${entity instanceof Api.Channel}`);
    console.log(`    isForum: ${entity instanceof Api.Channel && entity.forum}`);
    console.log(`    isMegagroup: ${entity instanceof Api.Channel && entity.megagroup}`);
    console.log(`    isGigagroup: ${entity instanceof Api.Channel && entity.gigagroup}`);
    console.log(`    has username: ${entity?.username ?? "—"}`);

    // Print all own properties of entity for debugging
    if (entity) {
      const ownProps: Record<string, any> = {};
      for (const key of Object.keys(entity)) {
        try {
          const val = (entity as any)[key];
          if (typeof val !== "object" && typeof val !== "function") {
            ownProps[key] = val;
          } else if (val?.constructor?.name) {
            ownProps[key] = `[${val.constructor.name}]`;
          }
        } catch {}
      }
      console.log(`    props: ${JSON.stringify(ownProps)}`);
    }

    // Print dialog properties
    const dialogProps: Record<string, any> = {};
    for (const key of Object.keys(dialog)) {
      try {
        const val = (dialog as any)[key];
        if (typeof val !== "object" && typeof val !== "function") {
          dialogProps[key] = val;
        }
      } catch {}
    }
    console.log(`    dialog: ${JSON.stringify(dialogProps)}`);

    if (isNayra) {
      directDialogs.push({ index: dialogIndex, dialog, entity });
    }
  }

  console.log(`\n=== TOTAL DIALOGS: ${dialogIndex} ===`);

  // ── 2. DIRECT CHAT INVESTIGATION ──────────────────────────
  if (directDialogs.length === 0) {
    console.log(`\n=== NO 'NAYRA (DIRECT)' DIALOG FOUND ===`);
    console.log("Searching for ANY dialog with 'direct' or 'nayra' in name/id...");

    // Search all dialogs again with wider criteria
    let found = false;
    for await (const dialog of client.iterDialogs()) {
      const entity = dialog.entity;
      const name = (dialog.name ?? entity?.title ?? "").toLowerCase();
      const id = entity?.id?.toString() ?? "";
      if (name.includes("nayra") || name.includes("direct") || id.includes("nayra")) {
        console.log(`FOUND: name="${dialog.name}" type=${entity?.constructor?.name} id=${entity?.id}`);
        found = true;
      }
    }
    if (!found) {
      console.log("\n'NAYRA (DIRECT)' is NOT returned by iterDialogs().");
      console.log("It may be hidden or require a different API to access.");
    }
  } else {
    // ── 3. ANALYZE DIRECT CHAT ──────────────────────────────
    for (const { index, dialog, entity } of directDialogs) {
      console.log(`\n=== ANALYZING DIRECT CHAT [${index}] ===`);

      if (entity instanceof Api.Channel) {
        console.log("\nThis is a CHANNEL entity.");

        // Check if it's a broadcast channel or megagroup
        if (entity.broadcast) console.log("  broadcast: true (read-only broadcast channel)");
        if (entity.megagroup) console.log("  megagroup: true (supergroup)");
        if (entity.forum) console.log("  forum: true (forum)");

        // Try to get full channel info
        try {
          const fullChat = await client.invoke(
            new Api.channels.GetFullChannel({ channel: entity.id })
          );
          console.log(`  fullChat available: yes`);
          const full = fullChat as any;
          if (full.fullChat) {
            console.log(`  participants_count: ${full.fullChat.participants_count}`);
            console.log(`  can_view_participants: ${full.fullChat.can_view_participants}`);
            console.log(`  linked_chat_id: ${full.fullChat.linked_chat_id}`);
          }
        } catch (e: any) {
          console.log(`  fullChat error: ${e.message}`);
        }

        // Check if it has a linked discussion group
        try {
          const mg = await client.invoke(
            new Api.messages.GetMigratedChat({ peer: entity.id })
          ).catch(() => null);
          console.log(`  migratedChat: ${mg ? "yes" : "no"}`);
        } catch {}

        // ── Try iterating messages as a channel ──
        console.log("\n--- Trying iterMessages as channel ---");
        let msgCount = 0;
        try {
          for await (const msg of client.iterMessages(entity.id, { limit: 5 })) {
            msgCount++;
            if (msgCount === 1) {
              console.log(`  First message: id=${(msg as any).id} text="${(msg as any).message?.slice(0, 80) ?? "[non-text]"} " out=${(msg as any).out}`);
            }
          }
          console.log(`  Total messages: ${msgCount}`);
        } catch (e: any) {
          console.log(`  iterMessages error: ${e.message}`);
        }

        // ── Try getHistory as alternative ──
        console.log("\n--- Trying messages.GetHistory ---");
        try {
          const history = await client.invoke(
            new Api.messages.GetHistory({
              peer: entity.id,
              limit: 5,
            })
          );
          console.log(`  GetHistory succeeded, count: ${(history as any).messages?.length ?? 0}`);
        } catch (e: any) {
          console.log(`  GetHistory error: ${e.message}`);
        }

        // ── Check for forum topics ──
        if (entity.forum) {
          console.log("\n--- Checking forum topics ---");
          try {
            const topics = await client.invoke(
              new Api.channels.GetForumTopics({
                channel: entity.id,
                limit: 10,
              })
            );
            const topicCount = (topics as any).count ?? (topics as any).topics?.length ?? 0;
            console.log(`  Topics count: ${topicCount}`);
            const tArr = (topics as any).topics ?? [];
            for (const t of tArr.slice(0, 5)) {
              console.log(`  Topic: id=${t.id} title="${t.title}"`);
            }
          } catch (e: any) {
            console.log(`  Forum topics error: ${e.message}`);
          }
        }
      } else if (entity instanceof Api.Chat) {
        console.log("\nThis is a basic CHAT (group) entity.");
      } else if (entity instanceof Api.User) {
        console.log("\nThis is a USER entity.");
      } else {
        console.log(`\nUnknown entity type: ${entity?.constructor?.name}`);
      }
    }
  }

  // ── 4. SEARCH FOR BUSINESS CONNECTION ─────────────────────
  console.log(`\n=== CHECKING FOR BUSINESS CONNECTION ===`);
  try {
    const biz = await client.invoke(new Api.account.GetBusinessConnection({ connectionId: "" }));
    console.log(`  Business connection: ${JSON.stringify(biz)}`);
  } catch (e: any) {
    console.log(`  GetBusinessConnection error: ${e.message}`);
  }

  // ── 5. CHECK CONTACTS ─────────────────────────────────────
  console.log(`\n=== CHECKING CONTACTS ===`);
  try {
    const contacts = await client.invoke(new Api.contacts.GetContacts({ hash: 0 }));
    console.log(`  Contacts count: ${(contacts as any).users?.length ?? 0}`);
  } catch (e: any) {
    console.log(`  GetContacts error: ${e.message}`);
  }

  // ── 6. LIST ALL DIALOGS AGAIN WITH FULL ENTITY DUMP ──────
  console.log(`\n=== FULL DIALOG ENTITY DUMP ===`);
  let idx = 0;
  for await (const dialog of client.iterDialogs()) {
    idx++;
    const entity = dialog.entity;
    const className = entity?.constructor?.name ?? "unknown";
    // Only print channels and chats in detail
    if (entity instanceof Api.Channel || entity instanceof Api.Chat) {
      console.log(`\n[${idx}] "${dialog.name}" (${className}) id=${entity.id}`);
      if (entity instanceof Api.Channel) {
        console.log(`  broadcast=${entity.broadcast} megagroup=${entity.megagroup} forum=${entity.forum}`);
        console.log(`  gigagroup=${entity.gigagroup} min=${entity.min}`);

        // Try to get the full chat
        try {
          const full = await client.invoke(
            new Api.channels.GetFullChannel({ channel: entity.id })
          ) as any;
          if (full.fullChat) {
            console.log(`  participants_count: ${full.fullChat.participants_count}`);
            if (full.fullChat.linked_chat_id) {
              console.log(`  linked_chat_id: ${full.fullChat.linked_chat_id} (this connects to a discussion group)`);
            }
          }
        } catch {}
      }
    }
  }

  console.log(`\n=== DIAGNOSTIC COMPLETE ===`);
}

main().catch((e) => { console.error("Crashed:", e); process.exit(1); });