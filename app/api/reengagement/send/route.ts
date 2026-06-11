import {
  createBroadcastHistory,
  getFollowUpAudience,
} from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";
import { BROADCAST_TRIGGERS } from "@/lib/broadcast-filters";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import type { BroadcastTrigger, ReengagementSendResult } from "@/types";

const TOKEN_PATTERN = /\{([^{}]+)\}/g;

const THROTTLE_MS = 1000;
const inflightReengagements = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function personalize(text: string, name: string): string {
  return text.replace(TOKEN_PATTERN, (match, token) => {
    if (token === "name") return name;
    return match;
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const message = String(body.message ?? "").trim();
    const segmentKey = String(body.segmentKey ?? "") as BroadcastTrigger;

    if (!name) return apiError("Campaign name is required");
    if (!message) return apiError("Message is required");
    if (!BROADCAST_TRIGGERS.has(segmentKey)) {
      return apiError("Invalid segment key");
    }

    const tokens = Array.from(message.matchAll(TOKEN_PATTERN)).map((m) => m[1]);
    const unsupported = tokens.filter((t) => t !== "name");
    if (unsupported.length > 0) {
      return apiError(
        `Unsupported personalization tokens: ${unsupported.join(", ")}. Only {name} is supported.`,
      );
    }

    if (inflightReengagements.has(segmentKey)) {
      return apiError("Campaign already in progress for this segment", 409);
    }
    inflightReengagements.add(segmentKey);

    try {
      const recipients = await getFollowUpAudience(segmentKey);
      const recipientCount = recipients.length;
      let sentCount = 0;
      const errors: string[] = [];

      for (const recipient of recipients) {
        try {
          const personalized = personalize(message, recipient.name);
          await sendTelegramMessage(recipient.id, personalized);
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
        trigger: segmentKey,
      });

      const result: ReengagementSendResult = {
        count: recipientCount,
        sentCount,
        failedCount: recipientCount - sentCount,
        errors,
        broadcast,
      };

      return apiOk(result, 201);
    } finally {
      inflightReengagements.delete(segmentKey);
    }
  } catch (e) {
    console.error(e);
    return apiError("Failed to send re-engagement campaign", 500);
  }
}
