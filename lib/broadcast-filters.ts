import type { BroadcastFilters, BroadcastTrigger } from "@/types";

export const BROADCAST_TRIGGER_KEYS: readonly BroadcastTrigger[] = [
  "no_message_7d",
  "no_purchase_30d",
  "vip_inactive_14d",
  "high_spender_inactive",
  "no_ppv_30d",
  "never_purchased",
];

export const BROADCAST_TRIGGERS: Set<BroadcastTrigger> = new Set(
  BROADCAST_TRIGGER_KEYS,
);

const VIP_LEVELS = new Set([
  "",
  "none",
  "bronze",
  "silver",
  "gold",
  "platinum",
]);

const FAN_STATUSES = new Set([
  "",
  "active",
  "inactive",
  "churned",
  "new",
]);

export function normalizeFilters(input: unknown): BroadcastFilters | string {
  const raw = (input ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  const vipLevel = raw.vipLevel === undefined ? "" : String(raw.vipLevel);
  const fanStatus = raw.fanStatus === undefined ? "" : String(raw.fanStatus);
  const minTotalSpent =
    raw.minTotalSpent === undefined || raw.minTotalSpent === ""
      ? undefined
      : Number(raw.minTotalSpent);
  const minFanScore =
    raw.minFanScore === undefined || raw.minFanScore === ""
      ? undefined
      : Number(raw.minFanScore);

  if (!VIP_LEVELS.has(vipLevel)) return "Invalid VIP level";
  if (!FAN_STATUSES.has(fanStatus)) return "Invalid fan status";
  if (
    minTotalSpent !== undefined &&
    (!Number.isFinite(minTotalSpent) || minTotalSpent < 0)
  ) {
    return "Invalid minimum total spent";
  }
  if (
    minFanScore !== undefined &&
    (!Number.isFinite(minFanScore) || minFanScore < 0)
  ) {
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
