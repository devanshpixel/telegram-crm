import { getMessagesByContactId } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";
import { suggestReply } from "@/lib/ai/suggest-reply";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactId = Number(body.contactId);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return apiError("Invalid contact id");
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return apiError("OPENROUTER_API_KEY is not configured", 500);
    }

    const messages = getMessagesByContactId(contactId);
    if (messages.length === 0) {
      return apiError("No messages found for this contact", 404);
    }

    const suggestion = await suggestReply(messages);
    return apiOk({ suggestion }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI reply generation failed";
    return apiError(message, 500);
  }
}
