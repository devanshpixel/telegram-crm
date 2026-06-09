import type { ReplyMode } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/free";

const MODE_PROMPTS: Record<Exclude<ReplyMode, "auto">, string> = {
  casual:
    "You are writing a friendly, relaxed reply to continue the conversation naturally. Use a conversational tone as if talking to a friend.\n" +
    "\n" +
    "Reply only with the message text.\n" +
    "No explanations.\n" +
    "No quotes.\n" +
    "No prefixes.\n" +
    "No labels.",
  flirty:
    "You are writing a playful, warm, and slightly flirty reply. Be charming and lighthearted with a teasing tone.\n" +
    "\n" +
    "Reply only with the message text.\n" +
    "No explanations.\n" +
    "No quotes.\n" +
    "No prefixes.\n" +
    "No labels.",
  sales:
    "You are writing a persuasive, value-focused reply. Highlight benefits subtly and include a soft call to action. Keep it professional but warm.\n" +
    "\n" +
    "Reply only with the message text.\n" +
    "No explanations.\n" +
    "No quotes.\n" +
    "No prefixes.\n" +
    "No labels.",
  reengagement:
    "You are re-engaging someone who hasn't replied recently. Acknowledge the gap naturally without pressure. Be warm and inviting, as if picking up where you left off.\n" +
    "\n" +
    "Reply only with the message text.\n" +
    "No explanations.\n" +
    "No quotes.\n" +
    "No prefixes.\n" +
    "No labels.",
};

function buildTranscript(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): string {
  return messages
    .map((m) => (m.direction === "incoming" ? "Fan" : "You") + ": " + m.text)
    .join("\n");
}

function detectMode(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): Exclude<ReplyMode, "auto"> {
  const lastIncoming = messages.filter((m) => m.direction === "incoming").slice(-3);
  const text = lastIncoming.map((m) => m.text.toLowerCase()).join(" ");

  const salesWords = [
    "price", "cost", "buy", "deal", "discount", "offer",
    "interested", "purchase", "quote", "how much",
  ];
  const flirtyWords = [
    "miss", "love", "cute", "beautiful", "handsome",
    "sexy", "gorgeous", "kiss", "hug",
  ];

  if (salesWords.some((w) => text.includes(w))) return "sales";
  if (flirtyWords.some((w) => text.includes(w))) return "flirty";

  const last3 = messages.slice(-3);
  if (last3.length >= 2 && last3.every((m) => m.direction === "outgoing")) return "reengagement";

  return "casual";
}

export async function suggestReply(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
  mode: ReplyMode = "auto",
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const transcript = buildTranscript(messages);
  const resolvedMode: Exclude<ReplyMode, "auto"> = mode === "auto" ? detectMode(messages) : mode;
  const systemPrompt = MODE_PROMPTS[resolvedMode];

  const userPrompt = transcript
    ? "Recent messages:\n" + transcript + "\n\nSuggested reply:"
    : "The conversation is just starting.\n\nSuggested reply:";

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error("OpenRouter request failed: " + res.status + " " + err);
  }

  const body = await res.json();
  const text: string | undefined = body?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenRouter returned empty response");
  }

  return text.trim();
}
