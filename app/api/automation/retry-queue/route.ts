import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMessagesByContactId, getFailedActionStats } from "@/lib/db/service";
import { suggestReply } from "@/lib/ai/suggest-reply";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import { sendLockedResponse } from "@/src/lib/telegram/pollMessages";

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

    const rows = await db
      .prepare(
        `SELECT id, action_type, contact_id, payload, error, retry_count
         FROM failed_actions
         WHERE resolved_at IS NULL AND retry_count < max_retries
         ORDER BY created_at ASC LIMIT 20`
      )
      .all() as {
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
            const text = action.payload || "hey! sorry i missed your message earlier 😘 what's up?";
            await sendTelegramMessage(action.contact_id, text);
            break;
          }
          case "send_locked_response": {
            await sendLockedResponse(action.contact_id);
            break;
          }
          case "reengage": {
            const msgs = await getMessagesByContactId(action.contact_id);
            if (msgs.length > 0) {
              const reply = await suggestReply(msgs, "reengagement");
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
          .prepare("UPDATE failed_actions SET resolved_at = ?, last_retry_at = ?, retry_count = retry_count + 1 WHERE id = ?")
          .run(new Date().toISOString(), new Date().toISOString(), action.id);

        results.push({ id: action.id, actionType: action.action_type, contactId: action.contact_id, success: true });
      } catch (e) {
        await db
          .prepare("UPDATE failed_actions SET retry_count = retry_count + 1, last_retry_at = ? WHERE id = ?")
          .run(new Date().toISOString(), action.id);

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
