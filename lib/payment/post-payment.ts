import { getDb } from "@/lib/db";
import { recordUpsell } from "@/lib/db/service";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import { pickRandom, PAYMENT_SUCCESS, FIRST_UPSELL } from "@/src/lib/telegram/messageVariants";

const UPSELL_BASE_PRICE = 499;
const UPSELL_DISCOUNT = 0.6;
const UPSELL_SPEND_THRESHOLD = 1000;

export async function handlePostPayment(
  contactId: number,
  mediaId?: string | null,
): Promise<void> {
  const db = await getDb();
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const mediaLink = mediaId
    ? `\n\nView it here: ${appUrl}/api/media/${mediaId}/file?contactId=${contactId}`
    : "";

  await sendTelegramMessage(contactId, pickRandom(PAYMENT_SUCCESS) + mediaLink);

  const contact = await db
    .prepare("SELECT upsell_count, total_spent FROM contacts WHERE id = ?")
    .get(contactId) as { upsell_count: number; total_spent: number } | undefined;

  const upsellCount = contact?.upsell_count ?? 0;
  const totalSpent = contact?.total_spent ?? 0;

  if (upsellCount === 0 && totalSpent < UPSELL_SPEND_THRESHOLD) {
    const upsellPrice = Math.round(UPSELL_BASE_PRICE * UPSELL_DISCOUNT);
    const { razorpay } = await import("@/lib/razorpay");
    if (razorpay) {
      const upsellLink = await razorpay.paymentLink.create({
        amount: Math.round(upsellPrice * 100),
        currency: "INR",
        description: "VIP Bundle Upgrade",
        customer: { name: "Fan" },
        notes: { contactId: String(contactId) },
        callback_url: `${appUrl}/api/checkout/success`,
        callback_method: "get",
        options: { checkout: { name: "Nayra Premium" } },
      } as Parameters<typeof razorpay.paymentLink.create>[0]);
      const upsellUrl = (upsellLink as { short_url: string }).short_url;
      const upsellMsg = pickRandom(FIRST_UPSELL).replace("{price}", `₹${upsellPrice}`);
      await sendTelegramMessage(contactId, `${upsellMsg}\n\n👉 ${upsellUrl}`);
      await recordUpsell(contactId);
    }
  }
}
