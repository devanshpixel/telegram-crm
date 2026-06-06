import {
  getFollowUpAudienceCount,
} from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";
import { BROADCAST_TRIGGER_KEYS } from "@/lib/broadcast-filters";
import type { ReengagementAudiences } from "@/types";

export async function GET() {
  try {
    const counts = {} as ReengagementAudiences;
    for (const key of BROADCAST_TRIGGER_KEYS) {
      counts[key] = getFollowUpAudienceCount(key);
    }
    return apiOk({ counts });
  } catch (e) {
    console.error(e);
    return apiError("Failed to load re-engagement audiences", 500);
  }
}
