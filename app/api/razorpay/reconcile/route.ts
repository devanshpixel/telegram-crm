import { NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import { getDb } from "@/lib/db";
import { createPurchase, recalculateLeadScore, recalculateSpendSegment, recordPaid, recordUpsell } from "@/lib/db/service";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";

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

        const existing = await db
          .prepare("SELECT id FROM purchases WHERE note LIKE ?")
          .get(`%razorpay_payment:${paymentId}%`);

        if (existing) continue;

        const mediaId = notes.mediaId;
        const note = typeof mediaId === "string"
          ? `media_unlock:${mediaId}:razorpay_payment:${paymentId}`
          : `razorpay_payment:${paymentId}`;

        const amountPaid = link.amount_paid || link.amount || 0;

        await createPurchase({
          contactId,
          amount: amountPaid / 100,
          purchaseDate: new Date().toISOString().split("T")[0],
          kind: "ppv",
          note,
          markPaid: true,
          paymentId,
        });

        await recalculateLeadScore(contactId);
        await recalculateSpendSegment(contactId);
        await recordPaid(contactId);

        try {
          const appUrl = process.env.APP_URL || `http://localhost:3000`;
          const mediaLink = typeof notes.mediaId === "string"
            ? `\n\nView it here: ${appUrl}/api/media/${notes.mediaId}/file?contactId=${contactId}`
            : "";

          const contact2 = await db.prepare("SELECT upsell_count, total_spent FROM contacts WHERE id = ?").get(contactId) as { upsell_count: number; total_spent: number } | undefined;
          const upsellCount = contact2?.upsell_count ?? 0;
          const totalSpent = contact2?.total_spent ?? 0;

          await sendTelegramMessage(
            contactId,
            `✅ Payment successful! Your premium access has been unlocked${mediaLink}. Thank you for your support! ❤️\n\nps... i've got something even more special for my favs. ask me about it 😉`
          );

          if (upsellCount === 0 && totalSpent < 1000) {
            const upsellPrice = Math.round(499 * 0.6);
            const appUrl2 = process.env.APP_URL || `http://localhost:3000`;
            const razorpayLocal = (await import("@/lib/razorpay")).razorpay;
            if (razorpayLocal) {
              const upsellLink = await razorpayLocal.paymentLink.create({
                amount: Math.round(upsellPrice * 100),
                currency: "INR",
                description: "VIP Bundle Upgrade",
                customer: { name: "Fan" },
                notes: { contactId: String(contactId) },
                callback_url: `${appUrl2}/api/checkout/success`,
                callback_method: "get",
                options: { checkout: { name: "Nayra Premium" } },
              } as Parameters<typeof razorpayLocal.paymentLink.create>[0]);
              const upsellUrl = (upsellLink as { short_url: string }).short_url;
              await sendTelegramMessage(
                contactId,
                `🔥 special offer for our newest VIP: get the full bundle at just ₹${upsellPrice} — this is a one-time offer just for you!\n\n👉 ${upsellUrl}`
              );
              await recordUpsell(contactId, upsellPrice);
            }
          }
        } catch (e) {
          console.error(`[Reconcile] Failed to send confirmation to ${contactId}:`, e);
        }

        reconciled.push({ paymentLinkId: link.id, contactId, created: true });
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
