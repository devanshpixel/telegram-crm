import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendLockedResponse } from "@/src/lib/telegram/pollMessages";

export async function POST() {
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
