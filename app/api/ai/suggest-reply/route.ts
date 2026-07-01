import type { ReplyMode } from "@/types";
import { getDb } from "@/lib/db";
import { getMessagesByContactId } from "@/lib/db/service";
import { extractMemory, moodLabel } from "@/lib/ai/memory";
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

    const validModes: ReplyMode[] = ["casual", "flirty", "sales", "reengagement", "premium", "auto"];
    const mode: ReplyMode = validModes.includes(body.mode) ? body.mode : "auto";

    const messages = await getMessagesByContactId(contactId, 500);
    if (messages.length === 0) {
      return apiError("No messages found for this contact", 404);
    }

    const db = await getDb();
    const meta = await db
      .prepare("SELECT total_spent, favorite_content_type, offer_declined_count, emotional_temp FROM contacts WHERE id = ?")
      .get(contactId) as { total_spent: number; favorite_content_type: string | null; offer_declined_count: number; emotional_temp: number } | undefined;

    const memory = extractMemory(messages);
    const emotionalTemp = meta?.emotional_temp ?? 50;
    const recent = messages.slice(-20);
    const suggestion = await suggestReply(recent, mode, emotionalTemp, 0, {
      isPaid: (meta?.total_spent ?? 0) > 0,
      favoriteContent: meta?.favorite_content_type || undefined,
      facts: memory.facts,
      nickname: memory.nickname,
      answered: memory.answered,
      mood: moodLabel(emotionalTemp),
      lastOfferResult: (meta?.offer_declined_count ?? 0) > 0 ? "declined" : undefined,
    });
    return apiOk({ suggestion }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI reply generation failed";
    return apiError(message, 500);
  }
}
