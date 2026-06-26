import { getMessagesByContactId, markConversationRead } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contactId = Number(id);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return apiError("Invalid contact id");
    }
    const messages = await getMessagesByContactId(contactId);
    await markConversationRead(contactId);
    return apiOk(messages);
  } catch (e) {
    console.error(e);
    return apiError("Failed to load messages", 500);
  }
}
