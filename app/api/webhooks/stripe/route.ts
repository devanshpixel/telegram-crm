import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createPurchase } from "@/lib/db/service";

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || !stripe) {
      return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { metadata?: Record<string, string>; amount_total?: number };
      const contactId = session.metadata?.contactId;
      const amountTotal = session.amount_total;

      if (contactId && amountTotal) {
        createPurchase({
          contactId: Number(contactId),
          amount: amountTotal / 100,
          purchaseDate: new Date().toISOString().split("T")[0],
          kind: "ppv",
          note: "stripe_checkout",
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
