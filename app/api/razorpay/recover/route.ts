import { NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import { getDb } from "@/lib/db";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import { pickRandom, PAYMENT_RECOVERY } from "@/src/lib/telegram/messageVariants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface UnpaidLink {
  id: string;
  status: string;
  created_at: number;
  notes: Record<string, string | number | undefined> | null;
  short_url: string;
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-cron-secret");
    if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!razorpay) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
  }

  try {
    const db = await getDb();
    const lookbackHours = 72;
    const from = Math.floor((Date.now() - lookbackHours * 3600_000) / 1000);
    const to = Math.floor(Date.now() / 1000);

    const unpaidCandidates: UnpaidLink[] = [];
    let skip = 0;
    const PAGE_SIZE = 100;

    for (let page = 0; page < 5; page++) {
      const result = await razorpay.paymentLink.all({ from, to, count: PAGE_SIZE, skip });
      const links = (result.payment_links || []) as unknown as UnpaidLink[];
      unpaidCandidates.push(...links.filter((l) => l.status === "created"));
      if (links.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }

    console.log(`[Recover] Found ${unpaidCandidates.length} unpaid links in last ${lookbackHours}h`);

    const reminded: { linkId: string; contactId: number; sent: boolean }[] = [];

    for (const link of unpaidCandidates) {
      try {
        const notes = link.notes || {};
        const contactId = Number(notes.contactId);
        if (!contactId) continue;

        // Only remind if link is > 30 minutes old
        const linkAgeMinutes = (Date.now() / 1000 - link.created_at) / 60;
        if (linkAgeMinutes < 30) continue;

        // Only remind once per link — check tracking table
        // Use settings table to track reminded links (simple KV store)
        const alreadySent = await db
          .prepare("SELECT key FROM settings WHERE key = ?")
          .get(`recover_sent:${link.id}`) as { key: string } | undefined;
        if (alreadySent) continue;

        const contact = await db
          .prepare("SELECT id, name FROM contacts WHERE id = ?")
          .get(contactId) as { id: number; name: string } | undefined;
        if (!contact) continue;

        await db
          .prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, '1', ?)")
          .run(`recover_sent:${link.id}`, new Date().toISOString());

        const reminderText = pickRandom(PAYMENT_RECOVERY);
        await sendTelegramMessage(contactId, reminderText);

        reminded.push({ linkId: link.id, contactId, sent: true });
      } catch (e) {
        console.error(`[Recover] Error processing link ${link.id}:`, e);
        reminded.push({ linkId: link.id, contactId: Number(link.notes?.contactId || 0), sent: false });
      }
    }

    return NextResponse.json({ checked: unpaidCandidates.length, reminded: reminded.length, details: reminded });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Recovery failed";
    console.error("[Recover] Fatal error:", message);
    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
