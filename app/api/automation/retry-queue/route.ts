import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMessagesByContactId, getFailedActionStats } from "@/lib/db/service";
import { suggestReply } from "@/lib/ai/suggest-reply";
import { extractMemory, moodLabel } from "@/lib/ai/memory";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import { sendLockedResponse } from "@/src/lib/telegram/pollMessages";
import { deliverUnlock } from "@/lib/payment/post-payment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-cron-secret");
    if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const db = await getDb();
    const url = new URL(req.url);
    const summaryOnly = url.searchParams.get("summary") === "1";

    if (summaryOnly) {
      const stats = await getFailedActionStats();
      return NextResponse.json(stats);
    }

    // First, mark terminally-exhausted actions resolved so they don't accumulate
    await db
      .prepare("UPDATE failed_actions SET resolved_at = ? WHERE resolved_at IS NULL AND retry_count >= max_retries")
      .run(new Date().toISOString());

    const nowTs = new Date().toISOString();
    const rows = await db
      .prepare(
        `SELECT id, action_type, contact_id, payload, error, retry_count
         FROM failed_actions
         WHERE resolved_at IS NULL AND retry_count < max_retries
           AND (next_retry_at IS NULL OR next_retry_at <= ?)
         ORDER BY next_retry_at ASC, created_at ASC LIMIT 20`
      )
      .all(nowTs) as {
        id: number;
        action_type: string;
        contact_id: number;
        payload: string | null;
        error: string;
        retry_count: number;
      }[];

    const results: { id: number; actionType: string; contactId: number; success: boolean; error?: string }[] = [];

    for (const action of rows) {
      try {
        switch (action.action_type) {
          case "send_message": {
            const text = action.payload || "hey, was just thinking about you";
            await sendTelegramMessage(action.contact_id, text);
            break;
          }
          case "send_locked_response": {
            await sendLockedResponse(action.contact_id);
            break;
          }
          case "deliver_unlock": {
            // Gap B recovery: resend the post-payment unlock. deliverUnlock is
            // idempotent per payment id, so re-running never double-sends.
            let contactId = action.contact_id;
            let mediaId: string | null = null;
            let deliveryId: string | null = null;
            if (action.payload) {
              try {
                const p = JSON.parse(action.payload) as { contactId?: number; mediaId?: string | null; paymentId?: string };
                if (typeof p.contactId === "number") contactId = p.contactId;
                mediaId = p.mediaId ?? null;
                deliveryId = p.paymentId ?? null;
              } catch { /* payload not JSON — fall back to contact-only delivery */ }
            }
            await deliverUnlock(contactId, mediaId, deliveryId);
            break;
          }
          case "reengage": {
            const msgs = await getMessagesByContactId(action.contact_id, 500);
            if (msgs.length > 0) {
              const memory = extractMemory(msgs);
              const metaRow = await db
                .prepare("SELECT total_spent, favorite_content_type, offer_declined_count FROM contacts WHERE id = ?")
                .get(action.contact_id) as { total_spent: number; favorite_content_type: string | null; offer_declined_count: number } | undefined;
              const recent = msgs.slice(-20);
              const reply = await suggestReply(recent, "reengagement", 40, 0, {
                isPaid: (metaRow?.total_spent ?? 0) > 0,
                favoriteContent: metaRow?.favorite_content_type || undefined,
                facts: memory.facts,
                nickname: memory.nickname,
                mood: moodLabel(40),
                lastOfferResult: (metaRow?.offer_declined_count ?? 0) > 0 ? "declined" : undefined,
              });
              await sendTelegramMessage(action.contact_id, reply);
            }
            break;
          }
          default: {
            await db
              .prepare("UPDATE failed_actions SET retry_count = max_retries, last_retry_at = ? WHERE id = ?")
              .run(new Date().toISOString(), action.id);
            results.push({ id: action.id, actionType: action.action_type, contactId: action.contact_id, success: false, error: "Unknown action type" });
            continue;
          }
        }

        await db
          .prepare("UPDATE failed_actions SET resolved_at = ?, last_retry_at = ? WHERE id = ?")
          .run(new Date().toISOString(), new Date().toISOString(), action.id);

        results.push({ id: action.id, actionType: action.action_type, contactId: action.contact_id, success: true });
      } catch (e) {
        // Exponential backoff so a persistent failure isn't hammered each tick.
        const nextCount = action.retry_count + 1;
        const backoff = Math.min(3_600_000, 60_000 * Math.pow(2, nextCount));
        const nextRetryAt = new Date(Date.now() + backoff).toISOString();
        await db
          .prepare("UPDATE failed_actions SET retry_count = retry_count + 1, last_retry_at = ?, next_retry_at = ? WHERE id = ?")
          .run(new Date().toISOString(), nextRetryAt, action.id);

        results.push({
          id: action.id,
          actionType: action.action_type,
          contactId: action.contact_id,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Retry queue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
