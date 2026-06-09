import { getContactMedia } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactIdParam = searchParams.get("contactId");
    if (!contactIdParam) return apiError("contactId query parameter is required");

    const contactId = Number(contactIdParam);
    if (!Number.isInteger(contactId) || contactId <= 0) return apiError("Valid contactId is required");

    return apiOk(getContactMedia(contactId));
  } catch (e) {
    console.error("List media error:", e);
    return apiError("Failed to list media", 500);
  }
}
