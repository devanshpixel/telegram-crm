import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import { pickRandom, WHALE_FOLLOWUP } from "@/src/lib/telegram/messageVariants";

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
    const cutoff60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const whales = (await db
      .prepare(
        `SELECT c.id, c.name
         FROM contacts c
         WHERE c.spend_segment = 'whale'
           AND c.is_bot = 0
           AND (c.last_purchase_date IS NULL OR c.last_purchase_date < ?)
           AND c.conv_state = 'PAID'
         ORDER BY c.last_purchase_date ASC NULLS LAST
         LIMIT 5`
      )
      .all(cutoff60d)) as { id: number; name: string }[];

    const results: { contactId: number; sent: boolean; error?: string }[] = [];

    for (const contact of whales) {
      try {
        const lockKey = `whale_followup:${contact.id}`;
        const alreadySent = await db
          .prepare("SELECT key FROM settings WHERE key = ?")
          .get(lockKey) as { key: string } | undefined;
        if (alreadySent) continue;

        const msg = pickRandom(WHALE_FOLLOWUP);
        await sendTelegramMessage(contact.id, msg);

        await db
          .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, '1', ?)")
          .run(lockKey, new Date().toISOString());

        results.push({ contactId: contact.id, sent: true });
      } catch (e) {
        results.push({
          contactId: contact.id,
          sent: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ checked: whales.length, sent: results.filter((r) => r.sent).length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Whale follow-up failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
