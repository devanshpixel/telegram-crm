import { getDashboardStats } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET() {
  try {
    return apiOk(getDashboardStats());
  } catch (e) {
    console.error(e);
    return apiError("Failed to load stats", 500);
  }
}
