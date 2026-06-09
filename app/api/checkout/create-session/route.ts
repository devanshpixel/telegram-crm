import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactId = Number(body.contactId);
    const amount = Number(body.amount);

    if (!Number.isInteger(contactId) || contactId <= 0) {
      return NextResponse.json({ error: "Valid contactId is required" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    }
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "CRM PPV Unlock" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { contactId: String(contactId) },
      success_url: `${request.headers.get("origin") || "http://localhost:3000"}?checkout=success`,
      cancel_url: `${request.headers.get("origin") || "http://localhost:3000"}?checkout=cancelled`,
    });

    return NextResponse.json({ sessionUrl: session.url, sessionId: session.id });
  } catch (e) {
    console.error("Checkout error:", e);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
