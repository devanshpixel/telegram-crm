import { addNote, getContactProfile } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactId = Number(body.contactId);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return apiError("Invalid contact id");
    }
    if (!body.content?.trim()) {
      return apiError("Note content is required");
    }

    addNote(contactId, body.content);
    const profile = getContactProfile(contactId);
    if (!profile) return apiError("Contact not found", 404);
    return apiOk(profile, 201);
  } catch (e) {
    console.error(e);
    return apiError("Failed to add note", 500);
  }
}
