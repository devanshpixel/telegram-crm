/**
 * Poll pipeline diagnostic.
 * Traces each stage and reports PASS / FAIL / SKIPPED.
 * Run: npx tsx scripts/diagnose-poll.ts
 */

import "dotenv/config";
import { getDb, nowIso } from "../lib/db";
import { getTelegramClient } from "../src/lib/telegram/client";
import { createMessage, getMessagesByContactId, getSetting } from "../lib/db/service";
import { sendTelegramMessage } from "../src/lib/telegram/sendMessage";
import { Api } from "telegram";

async function listContactConversations() {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT c.id, c.telegram_id, c.telegram_access_hash, c.conv_state, c.offer_sent_at,
              conv.id AS conversation_id, conv.last_synced_message_id,
              (SELECT COUNT(*) FROM purchases WHERE contact_id = c.id) AS paid
       FROM contacts c
       INNER JOIN conversations conv ON conv.contact_id = c.id
       WHERE c.telegram_id IS NOT NULL AND c.telegram_access_hash IS NOT NULL`,
    )
    .all() as any[];
  return rows;
}

let failures = 0;
let passed = 0;

function pass(label: string) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label: string, detail: string) {
  console.log(`  FAIL  ${label}: ${detail}`);
  failures++;
}

function skip(label: string, reason: string) {
  console.log(`  SKIP  ${label} (${reason})`);
}

async function tryClearStaleSession() {
  // AUTH_KEY_DUPLICATED means the session is still alive on Telegram's side.
  // The DB session takes priority over the env var. If it's stale, delete it
  // so the env var (potentially different session) can be used.
  console.log("\n--- Attempting stale session cleanup ---");
  const _db = await getDb();
  const row = await _db.prepare("SELECT session_string FROM telegram_sessions LIMIT 1").get() as { session_string: string } | undefined;
  if (row) {
    console.log("  DB session found. Deleting it.");
    await _db.prepare("DELETE FROM telegram_sessions").run();
    console.log("  Deleted. The env var TELEGRAM_SESSION will be used on next attempt.");
  } else {
    console.log("  No DB session to clean.");
  }
}

async function main() {
  console.log("\n=== POLL PIPELINE DIAGNOSTIC ===\n");

  // ── Check session sources ──────────────────────────────────────────
  console.log("0. Session sources");
  const db = await getDb();
  const dbSession = await db.prepare("SELECT COUNT(*) AS c FROM telegram_sessions").get() as { c: number };
  const envSession = (process.env.TELEGRAM_SESSION ?? "").trim();
  console.log(`  DB telegram_sessions: ${dbSession.c > 0 ? "present" : "empty"}`);
  console.log(`  TELEGRAM_SESSION env: ${envSession.length > 0 ? "present (" + envSession.substring(0, 20) + "..." + envSession.substring(envSession.length - 10) + ")" : "empty"}`);
  if (dbSession.c > 0) {
    // DB session takes priority — if stale, it blocks reconnection
    const row = await db.prepare("SELECT session_string FROM telegram_sessions LIMIT 1").get() as { session_string: string } | undefined;
    if (row) {
      const sess = row.session_string;
      console.log(`  DB session starts with: ${sess.substring(0, 20)}...`);
      if (sess === envSession) {
        console.log("  DB session MATCHES env var session.");
      } else {
        console.log("  DB session DIFFERS from env var session!");
      }
    }
  }

  // ── Stage A/B/C: getTelegramClient (includes connect) ──────────────
  console.log("\nA/B/C. getTelegramClient() + connect()");
  let client: Awaited<ReturnType<typeof getTelegramClient>>;
  let gotClient = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      client = await getTelegramClient();
      gotClient = true;
      break;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("AUTH_KEY_DUPLICATED") && attempt === 1) {
        console.log("  AUTH_KEY_DUPLICATED — stale DB session. Clearing and retrying with env var...");
        await tryClearStaleSession();
      } else {
        fail("getTelegramClient", `exception: ${msg}`);
        console.log("\nCannot continue without Telegram client.\n");
        process.exit(1);
      }
    }
  }
  if (gotClient && client!.connected) {
    pass("client.connected === true");
  } else if (gotClient) {
    fail("getTelegramClient", "client not connected after getTelegramClient()");
    process.exit(1);
  }

  // ── Session validation with getMe ──────────────────────────────────
  console.log("\nD. client.getMe() (session validation)");
  try {
    const me = await client.getMe();
    if (me && (me as Api.User).firstName) {
      pass(`getMe returned ${(me as Api.User).firstName} @${(me as Api.User).username ?? "no-username"}`);
    } else if (me) {
      pass("getMe returned an entity (no name)");
    } else {
      fail("getMe", "returned null/undefined");
    }
  } catch (e: unknown) {
    fail("getMe", `exception: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── iterDialogs ─────────────────────────────────────────────────────
  console.log("\nE. client.iterDialogs()");
  let userDialogs = 0;
  let totalDialogs = 0;
  const skippedTypes = new Map<string, number>();
  try {
    for await (const dialog of client.iterDialogs()) {
      totalDialogs++;
      const entity = dialog.entity;
      if (entity instanceof Api.User) {
        if (entity.bot) { skippedTypes.set("bot", (skippedTypes.get("bot") ?? 0) + 1); continue; }
        if (entity.deleted) { skippedTypes.set("deleted", (skippedTypes.get("deleted") ?? 0) + 1); continue; }
        if (entity.self) { skippedTypes.set("self", (skippedTypes.get("self") ?? 0) + 1); continue; }
        userDialogs++;
      } else if (entity instanceof Api.Chat) {
        skippedTypes.set("chat (group)", (skippedTypes.get("chat (group)") ?? 0) + 1);
      } else if (entity instanceof Api.Channel) {
        skippedTypes.set("channel", (skippedTypes.get("channel") ?? 0) + 1);
      } else {
        skippedTypes.set(entity.constructor.name ?? "unknown", (skippedTypes.get(entity.constructor.name ?? "unknown") ?? 0) + 1);
      }
    }
    pass(`iterDialogs: ${totalDialogs} total, ${userDialogs} user (non-bot, non-deleted, non-self)`);
    if (skippedTypes.size > 0) {
      for (const [type, count] of skippedTypes) {
        console.log(`       skipped ${count} ${type}`);
      }
    }
  } catch (e: unknown) {
    fail("iterDialogs", `exception: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Compare with DB contacts ────────────────────────────────────────
  console.log("\nF. DB contact comparison");
  try {
    const db = await getDb();
    const totalContacts = (await db.prepare("SELECT COUNT(*) AS c FROM contacts").get() as { c: number }).c;
    const contactsWithTg = (await db.prepare("SELECT COUNT(*) AS c FROM contacts WHERE telegram_id IS NOT NULL").get() as { c: number }).c;
    pass(`DB: ${totalContacts} total contacts, ${contactsWithTg} with telegram_id`);
    if (userDialogs > 0) {
      console.log(`       Expected: ~${userDialogs} contacts from dialogs`);
      if (contactsWithTg < userDialogs) {
        console.log(`       MISMATCH: ${userDialogs - contactsWithTg} dialogs not in DB`);
      }
    }
  } catch (e: unknown) {
    fail("db contact count", `exception: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── listContactConversations (the actual SQL used by the poll) ──────
  console.log("\nG. listContactConversations() (poll's contact query)");
  try {
    const contacts = await listContactConversations();
    pass(`returns ${contacts.length} contacts`);
    if (contacts.length > 0) {
      console.log(`       first: id=${contacts[0].id} tg=${contacts[0].telegram_id} conv_state=${contacts[0].conv_state} paid=${contacts[0].paid}`);
    }
  } catch (e: unknown) {
    fail("listContactConversations", `exception: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── iterMessages on first contact ────────────────────────────────────
  console.log("\nH. client.iterMessages() on first contact");
  const contacts2 = await listContactConversations();
  if (contacts2.length > 0) {
    const first = contacts2[0];
    try {
      const peer = new Api.InputPeerUser({
        userId: BigInt(first.telegram_id),
        accessHash: BigInt(first.telegram_access_hash),
      });
      let msgCount = 0;
      for await (const message of client.iterMessages(peer, { limit: 10 })) {
        if (msgCount === 0) pass("iterMessages returned at least one message");
        msgCount++;
        if (msgCount >= 10) break;
      }
      console.log(`       ${msgCount} messages fetched for contact ${first.id}`);
      if (msgCount === 0) fail("iterMessages", "no messages returned (may be OK if new contact)");
    } catch (e: unknown) {
      fail("iterMessages", `exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    skip("iterMessages", "no contacts with telegram_id in DB");
  }

  // ── createMessage test ──────────────────────────────────────────────
  console.log("\nI. createMessage()");
  if (contacts2.length > 0) {
    const first = contacts2[0];
    try {
      const msg = await createMessage(first.id, "[diagnostic] poll pipeline test", "incoming", null);
      if (msg) {
        pass("createMessage succeeded");
      } else {
        fail("createMessage", "returned null (no conversation?)");
      }
    } catch (e: unknown) {
      fail("createMessage", `exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    skip("createMessage", "no contacts");
  }

  // ── getMessagesByContactId ──────────────────────────────────────────
  console.log("\nJ. getMessagesByContactId()");
  if (contacts2.length > 0) {
    const first = contacts2[0];
    try {
      const msgs = await getMessagesByContactId(first.id);
      if (msgs.length > 0) {
        pass(`getMessagesByContactId returned ${msgs.length} messages`);
      } else {
        fail("getMessagesByContactId", "returned 0 messages");
      }
    } catch (e: unknown) {
      fail("getMessagesByContactId", `exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    skip("getMessagesByContactId", "no contacts");
  }

  // ── suggestReply test ───────────────────────────────────────────────
  console.log("\nK. suggestReply() (AI generation)");
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const { suggestReply } = await import("../lib/ai/suggest-reply");
      const fakeMessages = [
        { text: "hey! how are you?", direction: "incoming" as const },
      ];
      const reply = await suggestReply(fakeMessages, "casual", 50, 0);
      if (reply && reply.length > 0) {
        pass(`suggestReply returned: "${reply.substring(0, 60)}..."`);
      } else {
        fail("suggestReply", "returned empty string");
      }
    } catch (e: unknown) {
      fail("suggestReply", `exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    skip("suggestReply", "OPENROUTER_API_KEY not set");
  }

  // ── sendTelegramMessage test ────────────────────────────────────────
  console.log("\nL. sendTelegramMessage()");
  if (contacts2.length > 0) {
    const first = contacts2[0];
    try {
      const sent = await sendTelegramMessage(first.id, "[diagnostic] this is a test message — ignore");
      if (sent && sent.id) {
        pass(`sendTelegramMessage succeeded, message id=${sent.id}`);
      } else {
        fail("sendTelegramMessage", "returned but no id");
      }
    } catch (e: unknown) {
      fail("sendTelegramMessage", `exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    skip("sendTelegramMessage", "no contacts");
  }

  // ── Update sync cursor test ─────────────────────────────────────────
  console.log("\nM. updateSyncCursor()");
  if (contacts2.length > 0) {
    const first = contacts2[0];
    try {
      const db = await getDb();
      const ts = new Date().toISOString();
      await db
        .prepare("UPDATE conversations SET last_synced_message_id = ?, updated_at = ? WHERE id = ?")
        .run(999999, ts, first.conversation_id);
      pass("updateSyncCursor (UPDATE) succeeded");
      // Reset so we don't break anything
      await db
        .prepare("UPDATE conversations SET last_synced_message_id = ?, updated_at = ? WHERE id = ?")
        .run(first.last_synced_message_id, ts, first.conversation_id);
    } catch (e: unknown) {
      fail("updateSyncCursor", `exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    skip("updateSyncCursor", "no contacts");
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failures}`);
  console.log("========================================\n");

  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Diagnostic crashed:", e);
  process.exit(1);
});
