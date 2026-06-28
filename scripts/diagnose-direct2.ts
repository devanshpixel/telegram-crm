/**
 * SECOND PASS — locate the "Nayra (DIRECT)" private container.
 * iterDialogs only shows "Nayra" as a broadcast channel (id=3992005731).
 * The DIRECT inbox may be a linked megagroup, a different entity, or hidden.
 */
import "dotenv/config";
import { getTelegramClient } from "../src/lib/telegram/client";
import { Api } from "telegram";
import bigInt from "big-integer";

async function main() {
  const client = await getTelegramClient();
  const me = await client.getMe();
  console.log(`Auth: ${(me as Api.User).firstName} id=${me.id}\n`);

  // ── Dump full Nayra channel info ──────────────────────────
  const NAYRA_CHANNEL_ID = bigInt("3992005731");

  console.log("=== 1. FULL CHANNEL INFO (channels.GetFullChannel) ===");
  try {
    const full = await client.invoke(
      new Api.channels.GetFullChannel({ channel: NAYRA_CHANNEL_ID })
    ) as any;
    // Print ALL keys of fullChat
    const fc = full.fullChat;
    if (fc) {
      console.log("fullChat class:", fc.constructor.name);
      for (const key of Object.keys(fc)) {
        try {
          const val = (fc as any)[key];
          const str = typeof val === "object" ? `[${val?.constructor?.name ?? typeof val}]` : String(val);
          console.log(`  ${key}: ${str}`);
        } catch {}
      }
    }
    // Print chats/channels from full response
    if (full.chats) {
      console.log("\nchats from GetFullChannel:");
      for (const chat of full.chats) {
        const c = chat as any;
        console.log(`  id=${c.id} title="${c.title}" className=${c.constructor.name} megagroup=${c.megagroup} broadcast=${c.broadcast} forum=${c.forum}`);
      }
    }
  } catch (e: any) {
    console.log("GetFullChannel error:", e.message);
  }

  // ── Search for discussion group ────────────────────────────
  console.log("\n=== 2. SEARCH FOR MEGAGROUPS / FORUMS ===");
  for await (const dialog of client.iterDialogs()) {
    const entity = dialog.entity as any;
    if (entity instanceof Api.Channel) {
      if (entity.megagroup || entity.forum) {
        console.log(`FOUND: "${dialog.name}" id=${entity.id} megagroup=${entity.megagroup} forum=${entity.forum} broadcast=${entity.broadcast}`);
      }
    }
    if (entity instanceof Api.Chat) {
      console.log(`FOUND basic group: "${dialog.name}" id=${entity.id}`);
    }
  }

  // ── Try to resolve "Nayra (DIRECT)" by username or phone ──
  console.log("\n=== 3. TRY RESOLVING 'Nayra (DIRECT)' ===");
  // Check if "nayra" resolves as a username
  try {
    const resolved = await client.invoke(
      new Api.contacts.ResolveUsername({ username: "nayra" })
    ) as any;
    console.log("ResolveUsername('nayra'):", resolved?.constructor?.name);
    if (resolved) {
      for (const key of Object.keys(resolved)) {
        const val = (resolved as any)[key];
        if (Array.isArray(val)) {
          console.log(`  ${key}: [${val.map((v: any) => `${v.constructor?.name ?? v} id=${v.id}`).join(", ")}]`);
        }
      }
    }
  } catch (e: any) {
    console.log("ResolveUsername error:", e.message);
  }

  // ── Get all dialogs including archived in ALL folders ──────
  console.log("\n=== 4. DIALOGS WITH FOLDER INFO ===");
  let dIdx = 0;
  for await (const dialog of client.iterDialogs()) {
    dIdx++;
    const entity = dialog.entity as any;
    const folderId = (dialog as any).folderId ?? (dialog as any).folder_id ?? "—";
    const archived = (dialog as any).archived ?? false;
    const name = dialog.name ?? entity?.title ?? "?";
    const type = entity?.constructor?.name ?? "?";
    console.log(`[${dIdx}] "${name}" folder=${folderId} archived=${archived} type=${type} id=${entity?.id}`);
  }

  // ── Search via messages.searchGlobal ───────────────────────
  console.log("\n=== 5. SEARCH GLOBAL FOR 'Nayra' ===");
  try {
    const results = await client.invoke(
      new Api.messages.SearchGlobal({
        q: "Nayra",
        limit: 10,
      })
    ) as any;
    if (results.chats) {
      console.log("Chats found:");
      for (const chat of results.chats) {
        const c = chat as any;
        console.log(`  id=${c.id} title="${c.title}" type=${c.constructor.name} megagroup=${c.megagroup} broadcast=${c.broadcast}`);
      }
    }
  } catch (e: any) {
    console.log("SearchGlobal error:", e.message);
  }

  // ── Check if there are more dialogs via getDialogsCount ────
  console.log("\n=== 6. DIALOG COUNT ===");
  try {
    const dialogs = await client.invoke(
      new Api.messages.GetDialogUnreadMarks({})
    ) as any;
    console.log("GetDialogUnreadMarks returned:", dialogs?.length ?? 0);
  } catch (e: any) {
    console.log("GetDialogUnreadMarks error:", e.message);
  }

  // Try getting all dialogs with explicit folder -1 (all)
  console.log("\n=== 7. DIALOGS FROM FOLDER 0 and 1 ===");
  for (const folderId of [0, 1]) {
    try {
      const dialogsList = await client.invoke(
        new Api.messages.GetDialogs({
          offsetDate: 0,
          offsetId: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          limit: 100,
          hash: bigInt(0),
          folderId,
        })
      ) as any;
      console.log(`Folder ${folderId}: ${dialogsList.dialogs?.length ?? 0} dialogs`);
      if (dialogsList.chats) {
        for (const chat of dialogsList.chats) {
          const c = chat as any;
          console.log(`  id=${c.id} title="${c.title}" type=${c.constructor.name}`);
        }
      }
    } catch (e: any) {
      console.log(`Folder ${folderId} error:`, e.message);
    }
  }

  // ── Try getting participants of Nayra channel ──────────────
  console.log("\n=== 8. NAYRA CHANNEL PARTICIPANTS ===");
  try {
    const participants = await client.invoke(
      new Api.channels.GetParticipants({
        channel: NAYRA_CHANNEL_ID,
        filter: new Api.ChannelParticipantsRecent({}),
        offset: 0,
        limit: 10,
        hash: bigInt(0),
      })
    ) as any;
    console.log(`Participants count: ${participants.count ?? "?"}`);
    if (participants.users) {
      for (const u of participants.users) {
        const user = u as any;
        console.log(`  id=${user.id} name="${user.firstName} ${user.lastName ?? ""}"`);
      }
    }
  } catch (e: any) {
    console.log("GetParticipants error:", e.message);
  }

  console.log("\n=== DIAGNOSTIC COMPLETE ===");
}
main().catch((e) => { console.error("Crashed:", e); process.exit(1); });