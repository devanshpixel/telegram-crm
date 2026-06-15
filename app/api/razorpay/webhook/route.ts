import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { razorpay, WEBHOOK_SECRET } from "@/lib/razorpay";
import { getDb } from "@/lib/db";
import { createPurchase } from "@/lib/db/service";

export async function POST(request: Request) {
  try {
    if (!razorpay || !WEBHOOK_SECRET) {
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
      const contactId = notes.contactId;
      const mediaId = notes.mediaId;
      const amountPaid = paymentLink?.amount_paid;
      const paymentId = payment?.id;

      if (contactId && amountPaid && paymentId) {
        const note = mediaId
          ? `media_unlock:${mediaId}:razorpay_payment:${paymentId}`
          : `razorpay_payment:${paymentId}`;

        const db = await getDb();
        const existing = await db
          .prepare("SELECT id FROM purchases WHERE note LIKE ?")
          .get(`%razorpay_payment:${paymentId}%`);
        if (!existing) {
          await createPurchase({
            contactId: Number(contactId),
            amount: amountPaid / 100,
            purchaseDate: new Date().toISOString().split("T")[0],
            kind: "ppv",
            note,
          });
          const ts = new Date().toISOString();
          await db
            .prepare("UPDATE contacts SET conv_state = 'PAID', updated_at = ? WHERE id = ?")
            .run(ts, Number(contactId));
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Razorpay webhook error:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
