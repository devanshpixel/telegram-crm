import { getTimeline } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contactId = Number(id);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return apiError("Invalid contact id");
    }
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 100;
    if (!Number.isInteger(limit) || limit <= 0 || limit > 500) {
      return apiError("Invalid limit parameter");
    }
    return apiOk(getTimeline(contactId, limit));
  } catch (e) {
    console.error(e);
    return apiError("Failed to load timeline", 500);
  }
}
