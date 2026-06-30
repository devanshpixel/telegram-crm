import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMessagesByContactId } from "@/lib/db/service";
import { suggestReply } from "@/lib/ai/suggest-reply";
import { extractMemory, moodLabel } from "@/lib/ai/memory";
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
    const db = await getDb();
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const candidates = (await db
      .prepare(
        `SELECT c.id, c.name
         FROM contacts c
         INNER JOIN conversations conv ON conv.contact_id = c.id
         WHERE c.conv_state = 'FREE_CHAT'
           AND conv.last_message_time < ?
           AND c.updated_at < ?
           AND c.revenue = 0
           AND c.is_bot = 0
         ORDER BY conv.last_message_time ASC
         LIMIT 20`,
      )
      .all(cutoff7d, cutoff7d)) as { id: number; name: string }[];

    const results: { contactId: number; sent: boolean; error?: string }[] = [];

    for (const contact of candidates) {
      try {
        const lockKey = `reengage_sent:${contact.id}`;
        const alreadySent = await db
          .prepare("SELECT key FROM settings WHERE key = ?")
          .get(lockKey) as { key: string } | undefined;
        if (alreadySent) continue;

        const messages = await getMessagesByContactId(contact.id, 500);
        if (messages.length === 0) continue;

        const memory = extractMemory(messages);
        const metaRow = await db
          .prepare("SELECT total_spent, favorite_content_type, offer_declined_count FROM contacts WHERE id = ?")
          .get(contact.id) as { total_spent: number; favorite_content_type: string | null; offer_declined_count: number } | undefined;

        const recent = messages.slice(-20);
        const reply = await suggestReply(recent, "reengagement", 40, 0, {
          isPaid: (metaRow?.total_spent ?? 0) > 0,
          favoriteContent: metaRow?.favorite_content_type || undefined,
          facts: memory.facts,
          nickname: memory.nickname,
          mood: moodLabel(40),
          lastOfferResult: (metaRow?.offer_declined_count ?? 0) > 0 ? "declined" : undefined,
        });
        await sendTelegramMessage(contact.id, reply);

        const ts = new Date().toISOString();
        await db
          .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, '1', ?)")
          .run(lockKey, ts);
        await db
          .prepare("UPDATE contacts SET updated_at = ? WHERE id = ?")
          .run(ts, contact.id);
        await db
          .prepare("UPDATE conversations SET last_message_time = ?, updated_at = ? WHERE contact_id = ?")
          .run(ts, ts, contact.id);

        results.push({ contactId: contact.id, sent: true });
      } catch (e) {
        results.push({
          contactId: contact.id,
          sent: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ checked: candidates.length, sent: results.filter((r) => r.sent).length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Re-engagement failed";
    console.error("[Re-engage] Fatal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
