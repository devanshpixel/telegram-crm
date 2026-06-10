import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getMediaById } from "@/lib/db/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactId = Number(body.contactId);
    const amount = Number(body.amount);
    const mediaId = body.mediaId ? Number(body.mediaId) : undefined;

    if (!Number.isInteger(contactId) || contactId <= 0) {
      return NextResponse.json({ error: "Valid contactId is required" }, { status: 400 });
    }
    if (mediaId !== undefined && (!Number.isInteger(mediaId) || mediaId <= 0)) {
      return NextResponse.json({ error: "Valid mediaId is required" }, { status: 400 });
    }
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
    }

    let resolvedAmount = amount;
    if (mediaId !== undefined) {
      const media = getMediaById(mediaId);
      if (!media) {
        return NextResponse.json({ error: "Media not found" }, { status: 404 });
      }
      resolvedAmount = media.price;
    }
    if (typeof resolvedAmount !== "number" || resolvedAmount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    }

    const metadata: Record<string, string> = { contactId: String(contactId) };
    if (mediaId) metadata.mediaId = String(mediaId);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "CRM PPV Unlock" },
            unit_amount: Math.round(resolvedAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${request.headers.get("origin") || "http://localhost:3000"}?checkout=success`,
      cancel_url: `${request.headers.get("origin") || "http://localhost:3000"}?checkout=cancelled`,
    });

    return NextResponse.json({ sessionUrl: session.url, sessionId: session.id });
  } catch (e) {
    console.error("Checkout error:", e);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
