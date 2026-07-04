import { getDb } from "@/lib/db";
import { recordUpsell } from "@/lib/db/service";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import { pickRandom, PAYMENT_SUCCESS, FIRST_UPSELL } from "@/src/lib/telegram/messageVariants";

const UPSELL_BASE_PRICE = 499;
const UPSELL_DISCOUNT = 0.6;
const UPSELL_SPEND_THRESHOLD = 1000;

/**
 * Idempotency marker stored in the settings table. Keyed on the Razorpay payment
 * id so a retry (webhook redelivery, reconcile cron, or retry-queue recovery)
 * never re-sends a step that already reached the customer.
 */
async function markStep(key: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, '1', ?)")
    .run(key, new Date().toISOString());
}

async function stepDone(key: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.prepare("SELECT key FROM settings WHERE key = ?").get(key) as { key: string } | undefined;
  return !!row;
}

/**
 * Deliver the unlock confirmation (and, for first-time buyers, the upsell) to the
 * customer. Idempotent per `deliveryId`: each customer-facing step is marked in the
 * settings table only AFTER it successfully sends, so a retry resumes exactly where
 * a prior attempt failed — no double confirmation, no double upsell link.
 *
 * Throws if the confirmation (the customer's actual unlock) could not be sent, so
 * the caller can enqueue a retry. The upsell is best-effort: an upsell failure is
 * logged but never fails delivery, because the customer already got what they paid
 * for and re-running would risk a duplicate confirmation.
 */
export async function deliverUnlock(
  contactId: number,
  mediaId?: string | null,
  deliveryId?: string | null,
): Promise<void> {
  const db = await getDb();
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  // Fall back to a per-contact key when no payment id is available (legacy callers).
  const id = deliveryId || `contact:${contactId}`;
  const confirmKey = `unlock_delivered:${id}`;
  const upsellKey = `unlock_upsell_sent:${id}`;

  if (!(await stepDone(confirmKey))) {
    const mediaLink = mediaId
      ? `\n\nView it here: ${appUrl}/api/media/${mediaId}/file?contactId=${contactId}`
      : "";
    await sendTelegramMessage(contactId, pickRandom(PAYMENT_SUCCESS) + mediaLink);
    // TODO: send original (unblurred) image via sendTelegramPhoto(contactId, mediaId) here
    await markStep(confirmKey);
  }

  // Upsell only for first-time buyers below the spend threshold, and only once.
  if (await stepDone(upsellKey)) return;

  const contact = await db
    .prepare("SELECT upsell_count, total_spent FROM contacts WHERE id = ?")
    .get(contactId) as { upsell_count: number; total_spent: number } | undefined;

  const upsellCount = contact?.upsell_count ?? 0;
  const totalSpent = contact?.total_spent ?? 0;

  if (upsellCount !== 0 || totalSpent >= UPSELL_SPEND_THRESHOLD) {
    await markStep(upsellKey); // not eligible — mark so we never re-evaluate on retry
    return;
  }

  try {
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
      await markStep(upsellKey);
    }
  } catch (e) {
    // Upsell is secondary revenue, not the unlock itself. Never fail delivery on it.
    console.error(`[deliverUnlock] Upsell failed for contact ${contactId} (unlock already delivered):`, e);
  }
}

/**
 * Backward-compatible wrapper. Prefer deliverUnlock with a payment id for full
 * idempotency across retries.
 */
export async function handlePostPayment(
  contactId: number,
  mediaId?: string | null,
  deliveryId?: string | null,
): Promise<void> {
  await deliverUnlock(contactId, mediaId, deliveryId);
}
