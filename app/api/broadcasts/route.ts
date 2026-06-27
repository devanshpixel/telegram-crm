import {
  createBroadcastHistory,
  getBroadcastRecipients,
  listBroadcasts,
} from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";
import { normalizeFilters } from "@/lib/broadcast-filters";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";

const THROTTLE_MS = 1000;
const inflightBroadcasts = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET() {
  try {
    return apiOk(await listBroadcasts(20));
  } catch (e) {
    console.error("[BroadcastsList]", e);
    return apiError("Failed to load broadcasts", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const message = String(body.message ?? "").trim();
    const filters = normalizeFilters(body.filters);

    if (!name) return apiError("Broadcast name is required");
    if (!message) return apiError("Broadcast message is required");
    if (typeof filters === "string") return apiError(filters);

    const lockKey = JSON.stringify(filters);
    if (inflightBroadcasts.has(lockKey)) {
      return apiError("Broadcast already in progress for this audience", 409);
    }
    inflightBroadcasts.add(lockKey);

    try {
      const recipients = await getBroadcastRecipients(filters);
      const recipientCount = recipients.length;
      let sentCount = 0;
      const errors: string[] = [];

      for (const recipient of recipients) {
        try {
          await sendTelegramMessage(recipient.id, message);
          sentCount += 1;
        } catch (e) {
          const details = e instanceof Error ? e.message : "Unknown error";
          errors.push(`${recipient.name}: ${details}`);
        }
        await sleep(THROTTLE_MS);
      }

      const broadcast = await createBroadcastHistory({
        name,
        message,
        recipientCount,
        sentCount,
      });

      return apiOk(
        {
          broadcast,
          sentCount,
          failedCount: recipientCount - sentCount,
          errors,
        },
        201,
      );
    } finally {
      inflightBroadcasts.delete(lockKey);
    }
  } catch (e) {
    console.error("[BroadcastsSend]", e);
    return apiError("Failed to send broadcast", 500);
  }
}
