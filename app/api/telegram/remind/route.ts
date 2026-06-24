import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendLockedResponse } from "@/src/lib/telegram/pollMessages";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  // Defense-in-depth auth (middleware also enforces this). Accept Vercel's
  // `Authorization: Bearer <CRON_SECRET>` (GET) or `x-cron-secret` (POST).
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
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const unpaid = (await db
      .prepare(
        "SELECT id FROM contacts WHERE conv_state = 'OFFER_SENT' AND (last_locked_response_at IS NULL OR last_locked_response_at < ?)",
      )
      .all(cutoff)) as { id: number }[];

    const results: { contactId: number; sent: boolean; error?: string }[] = [];

    for (const contact of unpaid) {
      try {
        await sendLockedResponse(contact.id);
        results.push({ contactId: contact.id, sent: true });
      } catch (e) {
        results.push({
          contactId: contact.id,
          sent: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ reminded: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reminder job failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
