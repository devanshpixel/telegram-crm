import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { razorpay } from "@/lib/razorpay";
import { recordPaid, enqueueFailedAction } from "@/lib/db/service";

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

  if (!razorpay) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
  }

  try {
    const db = await getDb();

    const stuck = (await db
      .prepare(
        `SELECT c.id, c.name, c.total_spent
         FROM contacts c
         WHERE c.total_spent > 0
           AND c.conv_state != 'PAID'
         LIMIT 50`
      )
      .all()) as { id: number; name: string; total_spent: number }[];

    const results: { contactId: number; fixed: boolean; error?: string }[] = [];

    for (const contact of stuck) {
      try {
        const lockKey = `unlock_fix:${contact.id}`;
        const alreadyFixed = await db
          .prepare("SELECT key FROM settings WHERE key = ?")
          .get(lockKey) as { key: string } | undefined;
        if (alreadyFixed) continue;

        await recordPaid(contact.id);

        // Gap B safety net: a paid contact whose state lagged may also never have
        // received the unlock message (e.g. the process died before the webhook
        // could enqueue a retry). If their latest purchase's unlock was never
        // delivered, enqueue an idempotent deliver_unlock so the customer is made
        // whole. deliverUnlock dedups on the payment id, so this can't double-send.
        const lastPurchase = await db
          .prepare(
            `SELECT note, payment_id FROM purchases
             WHERE contact_id = ? ORDER BY created_at DESC LIMIT 1`
          )
          .get(contact.id) as { note: string | null; payment_id: string | null } | undefined;

        if (lastPurchase) {
          const note = lastPurchase.note || "";
          const paymentId =
            lastPurchase.payment_id ||
            note.match(/razorpay_payment:([^:\s]+)/)?.[1] ||
            `contact:${contact.id}`;
          const mediaId = note.match(/media_unlock:([^:\s]+)/)?.[1] ?? null;
          const delivered = await db
            .prepare("SELECT key FROM settings WHERE key = ?")
            .get(`unlock_delivered:${paymentId}`) as { key: string } | undefined;
          if (!delivered) {
            await enqueueFailedAction(
              "deliver_unlock",
              contact.id,
              "recovered_by_failed_unlock_cron",
              JSON.stringify({ contactId: contact.id, mediaId, paymentId }),
              5,
              `deliver_unlock:${paymentId}`,
            );
          }
        }

        await db
          .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, '1', ?)")
          .run(lockKey, new Date().toISOString());

        results.push({ contactId: contact.id, fixed: true });
      } catch (e) {
        results.push({
          contactId: contact.id,
          fixed: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ checked: stuck.length, fixed: results.filter((r) => r.fixed).length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed unlock recovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
