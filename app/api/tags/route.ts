import { addTag, getContactProfile } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactId = Number(body.contactId);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return apiError("Invalid contact id");
    }
    if (!body.name?.trim()) {
      return apiError("Tag name is required");
    }

    try {
      addTag(contactId, body.name);
    } catch (e) {
      return apiError(e instanceof Error ? e.message : "Failed to add tag");
    }

    const profile = getContactProfile(contactId);
    if (!profile) return apiError("Contact not found", 404);
    return apiOk(profile, 201);
  } catch (e) {
    console.error(e);
    return apiError("Failed to add tag", 500);
  }
}
