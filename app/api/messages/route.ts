import { createMessage } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";
import type { MessageDirection } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactId = Number(body.contactId);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return apiError("Invalid contact id");
    }
    if (!body.text?.trim()) {
      return apiError("Message text is required");
    }

    const direction = (body.direction ?? "outgoing") as MessageDirection;
    if (direction !== "incoming" && direction !== "outgoing") {
      return apiError("Invalid message direction");
    }

    const message = createMessage(contactId, body.text, direction);
    if (!message) return apiError("Conversation not found", 404);
    return apiOk(message, 201);
  } catch (e) {
    console.error(e);
    return apiError("Failed to create message", 500);
  }
}
