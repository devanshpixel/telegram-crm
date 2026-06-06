import { getRevenueData } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get("months");
    const limitParam = searchParams.get("limit");

    const months = monthsParam ? Number(monthsParam) : 12;
    const limit = limitParam ? Number(limitParam) : 10;

    if (!Number.isInteger(months) || months <= 0) {
      return apiError("Invalid months parameter");
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      return apiError("Invalid limit parameter");
    }

    return apiOk(getRevenueData(months, limit));
  } catch (e) {
    console.error(e);
    return apiError("Failed to load revenue", 500);
  }
}
