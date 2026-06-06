import { getFollowUps } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 10;

    if (!Number.isInteger(limit) || limit <= 0) {
      return apiError("Invalid limit parameter");
    }

    return apiOk(getFollowUps(limit));
  } catch (e) {
    console.error(e);
    return apiError("Failed to load follow-up lists", 500);
  }
}
