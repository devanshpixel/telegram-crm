import { getBroadcastAudienceCount } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";
import { normalizeFilters } from "@/lib/broadcast-filters";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const filters = normalizeFilters(body.filters);
    if (typeof filters === "string") return apiError(filters);

    return apiOk({ count: getBroadcastAudienceCount(filters) });
  } catch (e) {
    console.error(e);
    return apiError("Failed to preview broadcast audience", 500);
  }
}
