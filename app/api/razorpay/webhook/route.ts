import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { WEBHOOK_SECRET } from "@/lib/razorpay";
import { getDb } from "@/lib/db";
import { createPurchase, recalculateLeadScore, recalculateSpendSegment, recordPaid } from "@/lib/db/service";
import { handlePostPayment } from "@/lib/payment/post-payment";

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

        // Idempotency: Razorpay redelivers webhooks on any timeout/non-2xx. If this
        // payment was already recorded, acknowledge without re-running side-effects —
        // otherwise handlePostPayment re-sends the unlock confirmation. Mirrors the
        // reconcile cron's guard so both payment paths dedup identically.
        const escapedPaymentId = String(paymentId).replace(/[%_]/g, "\\$&");
        const already = await db
          .prepare("SELECT id FROM purchases WHERE note LIKE ? ESCAPE '\\'")
          .get(`%razorpay_payment:${escapedPaymentId}%`);
        if (already) {
          return NextResponse.json({ received: true, duplicate: true });
        }

        const note = mediaId
          ? `media_unlock:${mediaId}:razorpay_payment:${paymentId}`
          : `razorpay_payment:${paymentId}`;

        // Atomic check-and-insert inside the transaction (see createPurchase paymentId param)
        try {
          await createPurchase({
            contactId,
            amount: amountPaid / 100,
            purchaseDate: new Date().toISOString().split("T")[0],
            kind: "ppv",
            note,
            markPaid: true,
            paymentId,
          });

          // Lead score + segment update
          await recalculateLeadScore(contactId);
          await recalculateSpendSegment(contactId);
          await recordPaid(contactId);

          // Send Telegram confirmation (best-effort, never fails the webhook)
          try {
            await handlePostPayment(contactId, mediaId);
          } catch (e) {
            console.error(`[Razorpay Webhook] Failed to send Telegram confirmation to ${contactId}:`, e);
          }
        } catch (error) {
          console.error("[Razorpay Webhook] Payment record failed:", error);
          throw error;
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Razorpay webhook error:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
