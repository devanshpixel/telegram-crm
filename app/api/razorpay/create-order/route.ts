import { NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import { getMediaById, getSetting } from "@/lib/db/service";
import { getAppUrl } from "@/lib/app-url";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactId = Number(body.contactId);
    const mediaId = body.mediaId ? Number(body.mediaId) : undefined;

    if (!Number.isInteger(contactId) || contactId <= 0) {
      return NextResponse.json({ error: "Valid contactId is required" }, { status: 400 });
    }
    if (mediaId !== undefined && (!Number.isInteger(mediaId) || mediaId <= 0)) {
      return NextResponse.json({ error: "Valid mediaId is required" }, { status: 400 });
    }
    if (!razorpay) {
      return NextResponse.json({ error: "Razorpay is not configured" }, { status: 500 });
    }

    let resolvedAmount: number;
    if (mediaId !== undefined) {
      const media = await getMediaById(mediaId);
      if (!media) {
        return NextResponse.json({ error: "Media not found" }, { status: 404 });
      }
      resolvedAmount = media.price;
    } else {
      resolvedAmount = await getSetting("offerPrice", 1);
    }
    if (typeof resolvedAmount !== "number" || resolvedAmount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    }

    const notes: Record<string, string> = { contactId: String(contactId) };
    if (mediaId) notes.mediaId = String(mediaId);

    const appUrl = getAppUrl();
    const paymentLink = await razorpay.paymentLink.create({
      amount: Math.round(resolvedAmount * 100),
      currency: "INR",
      description: "Nayra Premium Unlock",
      customer: {
        name: "Fan",
      },
      notes,
      callback_url: `${appUrl}/api/checkout/success`,
      callback_method: "get",
      // Per-link checkout brand override (no Razorpay approval needed) so the
      // fan sees "Nayra Premium" instead of the registered account name.
      options: { checkout: { name: "Nayra Premium" } },
    } as Parameters<typeof razorpay.paymentLink.create>[0]);

    return NextResponse.json({
      paymentLinkUrl: (paymentLink as { short_url: string }).short_url,
      paymentLinkId: (paymentLink as { id: string }).id,
    });
  } catch (e) {
    console.error("Razorpay create-order error:", e);
    return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
  }
}
