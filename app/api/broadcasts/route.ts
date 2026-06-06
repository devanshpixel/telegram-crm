import {
  createBroadcastHistory,
  getBroadcastRecipients,
  listBroadcasts,
} from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";
import type { BroadcastFilters } from "@/types";

const VIP_LEVELS = new Set(["", "none", "bronze", "silver", "gold", "platinum"]);
const FAN_STATUSES = new Set(["", "active", "inactive", "churned", "new"]);

function normalizeFilters(input: unknown): BroadcastFilters | string {
  const raw = (input ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  const vipLevel = raw.vipLevel === undefined ? "" : String(raw.vipLevel);
  const fanStatus = raw.fanStatus === undefined ? "" : String(raw.fanStatus);
  const minTotalSpent = raw.minTotalSpent === undefined || raw.minTotalSpent === ""
    ? undefined
    : Number(raw.minTotalSpent);
  const minFanScore = raw.minFanScore === undefined || raw.minFanScore === ""
    ? undefined
    : Number(raw.minFanScore);

  if (!VIP_LEVELS.has(vipLevel)) return "Invalid VIP level";
  if (!FAN_STATUSES.has(fanStatus)) return "Invalid fan status";
  if (minTotalSpent !== undefined && (!Number.isFinite(minTotalSpent) || minTotalSpent < 0)) {
    return "Invalid minimum total spent";
  }
  if (minFanScore !== undefined && (!Number.isFinite(minFanScore) || minFanScore < 0)) {
    return "Invalid minimum fan score";
  }

  return {
    tags,
    vipLevel: vipLevel as BroadcastFilters["vipLevel"],
    fanStatus: fanStatus as BroadcastFilters["fanStatus"],
    minTotalSpent,
    minFanScore,
  };
}

export async function GET() {
  try {
    return apiOk(listBroadcasts(20));
  } catch (e) {
    console.error(e);
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

    const recipients = getBroadcastRecipients(filters);
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
    }

    const broadcast = createBroadcastHistory({
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
  } catch (e) {
    console.error(e);
    return apiError("Failed to send broadcast", 500);
  }
}
