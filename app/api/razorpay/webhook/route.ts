import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { WEBHOOK_SECRET } from "@/lib/razorpay";
import { getDb } from "@/lib/db";
import { createPurchase, recalculateLeadScore, recalculateSpendSegment, recordPaid, enqueueFailedAction } from "@/lib/db/service";
import { deliverUnlock } from "@/lib/payment/post-payment";

export async function POST(request: Request) {
  try {
    if (!WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Razorpay webhook not configured" }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    }

    const isValid = Razorpay.validateWebhookSignature(body, signature, WEBHOOK_SECRET);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event === "payment_link.paid") {
      const paymentLink = event.payload.payment_link?.entity;
      const payment = event.payload.payment?.entity;
      const notes = paymentLink?.notes || {};
      const contactId = Number(notes.contactId);
      const mediaId = notes.mediaId;
      const amountPaid = paymentLink?.amount_paid;
      const paymentId = payment?.id;

      if (contactId && amountPaid && paymentId) {
        const db = await getDb();
        
        // Verify contact exists. Return 200 (not 404) so Razorpay stops retrying —
        // a missing contact is a permanent condition, not a transient failure.
        const contact = await db.prepare("SELECT id FROM contacts WHERE id = ?").get(contactId);
        if (!contact) {
          console.error(`[Razorpay Webhook] Contact ${contactId} not found`);
          return NextResponse.json({ received: true, skipped: "contact_not_found" });
        }

        const note = mediaId
          ? `media_unlock:${mediaId}:razorpay_payment:${paymentId}`
          : `razorpay_payment:${paymentId}`;

        await handlePayment(contactId, amountPaid / 100, note, mediaId, paymentId);
      }
    }

    // Handle direct payments (card/UPI/netbanking) that may not go through payment
    // links. The payment.captured event fires when a payment is successfully
    // captured. The notes on the payment entity carry contactId and mediaId.
    if (event.event === "payment.captured") {
      const payment = event.payload.payment?.entity;
      if (!payment) {
        console.warn("[Razorpay Webhook] payment.captured event missing payment entity");
        return NextResponse.json({ received: true, skipped: "no_payment_entity" });
      }
      const notes = payment.notes || {};
      const contactId = Number(notes.contactId);
      const mediaId = notes.mediaId;
      const amountPaid = payment.amount;
      const paymentId = payment.id;

      // If this payment is associated with a payment link, the payment_link.paid
      // handler already processes it. Dedup on paymentId via createPurchase.
      if (contactId && amountPaid && paymentId) {
        // Re-check contact existence — Razorpay may send payment.captured for a
        // payment whose contact was deleted between link creation and payment.
        const db = await getDb();
        const contact = await db.prepare("SELECT id FROM contacts WHERE id = ?").get(contactId);
        if (!contact) {
          console.error(`[Razorpay Webhook] payment.captured: Contact ${contactId} not found`);
          return NextResponse.json({ received: true, skipped: "contact_not_found" });
        }

        const note = mediaId
          ? `media_unlock:${mediaId}:razorpay_payment:${paymentId}`
          : `razorpay_payment:${paymentId}`;

        await handlePayment(contactId, amountPaid / 100, note, mediaId, paymentId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Razorpay webhook error:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handlePayment(
  contactId: number,
  amount: number,
  note: string,
  mediaId: string | number | undefined,
  paymentId: string,
): Promise<void> {
  const db = await getDb();
  const mid = mediaId != null ? String(mediaId) : null;

  // Atomic check-and-insert via createPurchase's UNIQUE constraint on payment_id.
  // On duplicate (created=false), we still MUST ensure the unlock was delivered
  // — Razorpay may have retried after the purchase was committed but before
  // deliverUnlock completed. Without this safety net, the old pre-check (which
  // returned 200 immediately on duplicate) permanently lost the unlock.
  try {
    await createPurchase({
      contactId,
      amount,
      purchaseDate: new Date().toISOString().split("T")[0],
      kind: "ppv",
      note,
      markPaid: true,
      paymentId,
    });

    // Side-effects run for BOTH new AND duplicate payments. For new purchases
    // the stats are updated; for duplicates createPurchase skips the UPDATE and
    // the recalculations below are idempotent anyway (total_spent unchanged).
    // This is critical: on a Razorpay retry where the original delivery failed
    // after the purchase INSERT, we MUST attempt unlock again.
    await recalculateLeadScore(contactId);
    await recalculateSpendSegment(contactId);
    await recordPaid(contactId);

    // Deliver the unlock (idempotent via deliverUnlock's settings key). If
    // delivery fails, enqueue a retry keyed on payment id. Never fail the
    // webhook — Razorpay must get its 2xx.
    try {
      await deliverUnlock(contactId, mid, paymentId);
    } catch (e) {
      console.error(`[Razorpay Webhook] Unlock delivery failed for ${contactId}, enqueuing retry:`, e);
      try {
        await enqueueFailedAction(
          "deliver_unlock",
          contactId,
          e instanceof Error ? e.message : String(e),
          JSON.stringify({ contactId, mediaId: mid, paymentId }),
          5,
          `deliver_unlock:${paymentId}`,
        );
      } catch (enqErr) {
        console.error(`[Razorpay Webhook] Failed to enqueue unlock retry for ${contactId}:`, enqErr);
      }
    }
  } catch (error) {
    console.error("[Razorpay Webhook] Payment record failed:", error);
    throw error;
  }
}
