import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { WEBHOOK_SECRET } from "@/lib/razorpay";
import { getDb } from "@/lib/db";
import { createPurchase, recalculateLeadScore, recalculateSpendSegment, recordPaid, recordUpsell } from "@/lib/db/service";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import { pickRandom, PAYMENT_SUCCESS, FIRST_UPSELL } from "@/src/lib/telegram/messageVariants";

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
        
        // Verify contact exists
        const contact = await db.prepare("SELECT id FROM contacts WHERE id = ?").get(contactId);
        if (!contact) {
          console.error(`[Razorpay Webhook] Contact ${contactId} not found`);
          return NextResponse.json({ error: "Contact not found" }, { status: 404 });
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
            const appUrl = process.env.APP_URL || `http://localhost:3000`;
            const mediaLink = mediaId
              ? `\n\nView it here: ${appUrl}/api/media/${mediaId}/file?contactId=${contactId}`
              : "";

            const contact = await db.prepare("SELECT upsell_count, total_spent FROM contacts WHERE id = ?").get(contactId) as { upsell_count: number; total_spent: number } | undefined;
            const upsellCount = contact?.upsell_count ?? 0;
            const totalSpent = contact?.total_spent ?? 0;

            const successMsg = pickRandom(PAYMENT_SUCCESS);
            await sendTelegramMessage(contactId, successMsg + mediaLink);

            // For first purchase, also send immediate upsell if total spent < 1000
            if (upsellCount === 0 && totalSpent < 1000) {
              const upsellPrice = Math.round(499 * 0.6);
              const appUrl2 = process.env.APP_URL || `http://localhost:3000`;
              const razorpay = (await import("@/lib/razorpay")).razorpay;
              if (razorpay) {
                const upsellLink = await razorpay.paymentLink.create({
                  amount: Math.round(upsellPrice * 100),
                  currency: "INR",
                  description: "VIP Bundle Upgrade",
                  customer: { name: "Fan" },
                  notes: { contactId: String(contactId) },
                  callback_url: `${appUrl2}/api/checkout/success`,
                  callback_method: "get",
                  options: { checkout: { name: "Nayra Premium" } },
                } as Parameters<typeof razorpay.paymentLink.create>[0]);
                const upsellUrl = (upsellLink as { short_url: string }).short_url;
                const upsellMsg = pickRandom(FIRST_UPSELL).replace('{price}', `₹${upsellPrice}`);
                await sendTelegramMessage(contactId, `${upsellMsg}\n\n👉 ${upsellUrl}`);
                await recordUpsell(contactId);
              }
            }
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
