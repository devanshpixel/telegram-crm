import { getAnalytics } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET() {
  try {
    return apiOk(await getAnalytics());
  } catch (e) {
    console.error(e);
    return apiError("Failed to load analytics", 500);
  }
}
