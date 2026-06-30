import { NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import { getDb } from "@/lib/db";
import { createPurchase, recalculateLeadScore, recalculateSpendSegment, recordPaid } from "@/lib/db/service";
import { handlePostPayment } from "@/lib/payment/post-payment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PaidLink {
  id: string;
  status: string;
  amount: number;
  amount_paid: number;
  notes: Record<string, string | number | undefined> | null;
  payments: Record<string, unknown> | null;
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

    const allPaid: PaidLink[] = [];
    let skip = 0;
    const PAGE_SIZE = 100;

    for (let page = 0; page < 5; page++) {
      const result = await razorpay.paymentLink.all({ from, to, count: PAGE_SIZE, skip });
      const links = (result.payment_links || []) as unknown as PaidLink[];
      allPaid.push(...links.filter((l) => l.status === "paid"));
      if (links.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }

    console.log(`[Reconcile] Found ${allPaid.length} paid links in last ${lookbackHours}h`);

    const reconciled: { paymentLinkId: string; contactId: number; created: boolean }[] = [];

    for (const link of allPaid) {
      try {
        const notes = link.notes || {};
        const contactId = Number(notes.contactId);
        const paymentId = link.payments?.payment_id as string | undefined;

        if (!contactId || !paymentId) {
          console.log(`[Reconcile] Skip link ${link.id}: missing contactId or paymentId`);
          continue;
        }

        const mediaId = notes.mediaId;
        const note = typeof mediaId === "string"
          ? `media_unlock:${mediaId}:razorpay_payment:${paymentId}`
          : `razorpay_payment:${paymentId}`;

        const amountPaid = link.amount_paid || link.amount || 0;

        // createPurchase uses INSERT OR IGNORE on payment_id — safe to call even if
        // the webhook already processed this. result.changes=0 means duplicate (no
        // stats update runs), but we still check contact state below.
        const purchase = await createPurchase({
          contactId,
          amount: amountPaid / 100,
          purchaseDate: new Date().toISOString().split("T")[0],
          kind: "ppv",
          note,
          markPaid: true,
          paymentId,
        });

        // Always ensure contact is marked PAID — handles partial webhook failures
        // where the purchase was recorded but the contact state wasn't updated.
        const contactRow = await db
          .prepare("SELECT conv_state FROM contacts WHERE id = ?")
          .get(contactId) as { conv_state: string } | undefined;
        const alreadyPaid = contactRow?.conv_state === "PAID";

        await recalculateLeadScore(contactId);
        await recalculateSpendSegment(contactId);
        await recordPaid(contactId);

        if (!alreadyPaid) {
          // Only fire post-payment messages if not already done (avoid double-sending)
          try {
            const mid = typeof mediaId === "string" ? mediaId : null;
            await handlePostPayment(contactId, mid);
          } catch (e) {
            console.error(`[Reconcile] Failed to send confirmation to ${contactId}:`, e);
          }
        }

        const isNew = purchase.note === note;
        reconciled.push({ paymentLinkId: link.id, contactId, created: isNew });
        console.log(`[Reconcile] Recovered payment ${paymentId} for contact ${contactId}`);
      } catch (e) {
        console.error(`[Reconcile] Error processing link ${link.id}:`, e);
      }
    }

    return NextResponse.json({ checked: allPaid.length, reconciled: reconciled.length, details: reconciled });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reconciliation failed";
    console.error("[Reconcile] Fatal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
