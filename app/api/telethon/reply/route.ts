import { getDb } from "@/lib/db";
import { createContact, createMessage, getContactByTelegramId, getMessagesByContactId, getIntentScore } from "@/lib/db/service";
import { extractMemory, moodLabel } from "@/lib/ai/memory";
import { apiError, apiOk } from "@/lib/api-error";
import { suggestReply } from "@/lib/ai/suggest-reply";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const telegramId = String(body.telegramId ?? "").trim();
    const accessHash = body.accessHash ? String(body.accessHash) : undefined;
    const name = String(body.name ?? "").trim();
    const username = body.username ? String(body.username).trim() : undefined;
    const message = String(body.message ?? "").trim();
    const telegramMessageId = body.telegramMessageId ? Number(body.telegramMessageId) : undefined;

    if (!telegramId) {
      return apiError("telegramId is required");
    }
    if (!name) {
      return apiError("name is required");
    }
    if (!message) {
      return apiError("message is required");
    }

    let contact = await getContactByTelegramId(telegramId);
    if (!contact) {
      await createContact({
        name,
        username: username ?? `user_${telegramId}`,
        telegramId,
        telegramAccessHash: accessHash ?? "",
      });
      contact = await getContactByTelegramId(telegramId);
      if (!contact) {
        return apiError("Failed to create contact", 500);
      }
    }

    const contactId = contact.id;

    await createMessage(contactId, message, "incoming", telegramMessageId);

    const allMessages = await getMessagesByContactId(contactId, 500);
    if (allMessages.length === 0) {
      return apiError("No messages found after insert", 500);
    }

    const db = await getDb();
    const meta = await db
      .prepare("SELECT total_spent, favorite_content_type, offer_declined_count, emotional_temp, conv_state FROM contacts WHERE id = ?")
      .get(contactId) as { total_spent: number; favorite_content_type: string | null; offer_declined_count: number; emotional_temp: number; conv_state: string } | undefined;

    const incomingMessages = allMessages.filter((m) => m.direction === "incoming");
    const [memory, intentScore] = await Promise.all([
      Promise.resolve(extractMemory(allMessages)),
      getIntentScore(incomingMessages.slice(-10)),
    ]);

    const emotionalTemp = meta?.emotional_temp ?? 50;
    const recent = allMessages.slice(-20);

    const lastOutgoing = [...recent].reverse().find(m => m.direction === "outgoing");
    const previousTopic = lastOutgoing
      ? lastOutgoing.text.replace(/\[link\].*/i, "").replace(/https?:\/\/\S+/g, "").trim().slice(0, 80) || undefined
      : undefined;

    const reply = await suggestReply(recent, "auto", emotionalTemp, intentScore, {
      isPaid: (meta?.total_spent ?? 0) > 0,
      favoriteContent: meta?.favorite_content_type || undefined,
      convState: meta?.conv_state,
      previousTopic,
      facts: memory.facts,
      nickname: memory.nickname,
      answered: memory.answered,
      mood: moodLabel(emotionalTemp),
      lastOfferResult: (meta?.offer_declined_count ?? 0) > 0 ? "declined" : undefined,
    });

    await createMessage(contactId, reply, "outgoing");

    return apiOk({ reply }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Telethon reply failed";
    return apiError(message, 500);
  }
}
