import { getPpvStats } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 10;

    if (!Number.isInteger(limit) || limit <= 0) {
      return apiError("Invalid limit parameter");
    }

    return apiOk(await getPpvStats(limit));
  } catch (e) {
    console.error("[PpvStats]", e);
    return apiError("Failed to load PPV stats", 500);
  }
}
