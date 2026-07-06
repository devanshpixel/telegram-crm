import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMessagesByContactId, getSetting } from "@/lib/db/service";
import { suggestReply } from "@/lib/ai/suggest-reply";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-cron-secret");
    if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    if (!await getSetting<boolean>("automatedReplies", false)) {
      return NextResponse.json({ skipped: "automatedReplies disabled", checked: 0, sent: 0, results: [] });
    }
    const db = await getDb();
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const stale = (await db
      .prepare(
        `SELECT c.id, c.name
         FROM contacts c
         INNER JOIN conversations conv ON conv.contact_id = c.id
         WHERE c.conv_state = 'FREE_CHAT'
           AND c.total_spent = 0
           AND c.is_bot = 0
           AND conv.last_message_time < ?
         ORDER BY conv.last_message_time ASC
         LIMIT 20`
      )
      .all(cutoff7d)) as { id: number; name: string }[];

    const results: { contactId: number; sent: boolean; error?: string }[] = [];

    for (const contact of stale) {
      try {
        const lockKey = `stale_sent:${contact.id}`;
        const alreadySent = await db
          .prepare("SELECT key FROM settings WHERE key = ?")
          .get(lockKey) as { key: string } | undefined;
        if (alreadySent) continue;

        const messages = await getMessagesByContactId(contact.id);
        if (messages.length === 0) continue;

        const reply = await suggestReply(messages, "reengagement");
        await sendTelegramMessage(contact.id, reply);

        const ts = new Date().toISOString();
        await db
          .prepare("UPDATE contacts SET updated_at = ? WHERE id = ?")
          .run(ts, contact.id);
        await db
          .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, '1', ?)")
          .run(lockKey, ts);

        results.push({ contactId: contact.id, sent: true });
      } catch (e) {
        results.push({
          contactId: contact.id,
          sent: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ checked: stale.length, sent: results.filter((r) => r.sent).length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stale lead detection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
