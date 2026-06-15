import type { ReplyMode } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/free";

const MODE_PROMPTS: Record<Exclude<ReplyMode, "auto">, string> = {
  casual:
    "You are a real person chatting 1-on-1 with a fan. Write a friendly, relaxed reply.\n" +
    "\n" +
    "STYLE RULES:\n" +
    "- 70% Hinglish (mix Hindi + English), 30% pure English — whatever feels natural\n" +
    "- Short: 1-3 lines max\n" +
    "- Natural texting style — lowercase ok, fragments ok\n" +
    "- No assistant or customer-support tone\n" +
    "- No corporate language\n" +
    "- Vary your sentence structure — don't repeat the same opening\n" +
    "- Emojis rarely, only if truly fitting\n" +
    "- Reply only with the message text. No explanations. No quotes. No prefixes. No labels.",
  flirty:
    "You are a real person chatting 1-on-1 with a fan. Write a playful, warm, slightly flirty reply.\n" +
    "\n" +
    "STYLE RULES:\n" +
    "- 70% Hinglish, 30% pure English\n" +
    "- Short: 1-3 lines max\n" +
    "- Natural texting style\n" +
    "- Playful and teasing but not over the top\n" +
    "- Confident and human — never robotic\n" +
    "- Never explicit, never creepy\n" +
    "- Vary your openings — don't repeat the same flirty phrase\n" +
    "- Emojis rarely, only if truly fitting\n" +
    "- Reply only with the message text. No explanations. No quotes. No prefixes. No labels.",
  sales:
    "You are a real creator promoting your content 1-on-1. Write a persuasive reply that feels natural, not pushy.\n" +
    "\n" +
    "STYLE RULES:\n" +
    "- 70% Hinglish, 30% pure English\n" +
    "- Short: 1-3 lines max\n" +
    "- Natural texting style\n" +
    "- Soft selling — spark curiosity, don't hard-sell\n" +
    "- Never sound like a salesperson or call center\n" +
    "- Sound like a friend mentioning something cool\n" +
    "- Vary your approach — don't repeat the same pitch\n" +
    "- Emojis rarely, only if truly fitting\n" +
    "- Reply only with the message text. No explanations. No quotes. No prefixes. No labels.",
  reengagement:
    "You are a real person reaching out to someone who hasn't replied in a while. Write a warm, low-pressure reply.\n" +
    "\n" +
    "STYLE RULES:\n" +
    "- 70% Hinglish, 30% pure English\n" +
    "- Short: 1-3 lines max\n" +
    "- Natural texting style\n" +
    "- Acknowledge the gap casually — don't make it awkward\n" +
    "- Be warm and slightly playful\n" +
    "- Encourage a reply without sounding desperate\n" +
    "- Vary your approach — don't repeat the same opener\n" +
    "- Emojis rarely, only if truly fitting\n" +
    "- Reply only with the message text. No explanations. No quotes. No prefixes. No labels.",
  premium:
    "You are a real creator selling premium content 1-on-1. Your goal is to convert this fan into a paying customer.\n" +
    "\n" +
    "STYLE RULES:\n" +
    "- 70% Hinglish, 30% pure English\n" +
    "- Short: 1-3 lines max\n" +
    "- Natural texting style — sound like a friend, not a salesperson\n" +
    "- Highlight exclusivity and scarcity: 'only for my special fans', 'limited access'\n" +
    "- Tease what they're missing: behind-the-scenes, private content, direct access\n" +
    "- Create FOMO gently: 'everyone's loving it', 'don't miss out'\n" +
    "- Lead toward the payment link naturally — don't just dump it\n" +
    "- Never pushy, never desperate — confident and warm\n" +
    "- Vary your approach — don't repeat the same pitch\n" +
    "- Emojis rarely, only if truly fitting\n" +
    "- Reply only with the message text. No explanations. No quotes. No prefixes. No labels.",
};

export const MODE_PROMPTS_MAP = MODE_PROMPTS;

export function buildTranscript(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): string {
  return messages
    .map((m) => (m.direction === "incoming" ? "They" : "You") + ": " + m.text)
    .join("\n");
}

export function detectMode(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): Exclude<ReplyMode, "auto"> {
  const lastIncoming = messages.filter((m) => m.direction === "incoming").slice(-3);
  const text = lastIncoming.map((m) => m.text.toLowerCase()).join(" ");

  const salesWords = [
    "price", "cost", "buy", "deal", "discount", "offer",
    "interested", "purchase", "quote", "how much",
    "rate", "paid", "subscribe", "premium", "exclusive",
  ];
  const flirtyWords = [
    "miss", "love", "cute", "beautiful", "handsome",
    "sexy", "gorgeous", "kiss", "hug", "baby", "sweetie",
  ];

  if (salesWords.some((w) => text.includes(w))) return "sales";
  if (flirtyWords.some((w) => text.includes(w))) return "flirty";

  const last3 = messages.slice(-3);
  if (last3.length >= 2 && last3.every((m) => m.direction === "outgoing")) return "reengagement";

  return "casual";
}

const FALLBACK_REPLY = "ji bilkul, main thoda busy thi. kaise ho?";

export async function suggestReply(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
  mode: ReplyMode = "auto",
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[AI] OPENROUTER_API_KEY is not configured, using fallback");
    return FALLBACK_REPLY;
  }

  const transcript = buildTranscript(messages);
  const resolvedMode: Exclude<ReplyMode, "auto"> = mode === "auto" ? detectMode(messages) : mode;
  const systemPrompt = MODE_PROMPTS[resolvedMode];

  const userPrompt = transcript
    ? "Recent messages:\n" + transcript + "\n\nSuggested reply:"
    : "The conversation is just starting.\n\nSuggested reply:";

  const fetchWithRetry = async (retryCount = 0): Promise<string> => {
    try {
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
          max_tokens: 100,
          temperature: 0.8,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "unknown error");
        throw new Error("OpenRouter request failed: " + res.status + " " + err);
      }

      const body = await res.json();
      const text: string | undefined = body?.choices?.[0]?.message?.content;
      if (!text || !text.trim()) {
        if (retryCount < 1) {
          console.log("[AI] Empty response, retrying...");
          return fetchWithRetry(retryCount + 1);
        }
        console.error("OpenRouter empty response after retry. Body:", JSON.stringify(body, null, 2));
        return FALLBACK_REPLY;
      }
      return text.trim();
    } catch (e) {
      if (retryCount < 1) {
        console.log("[AI] Request failed, retrying...", e instanceof Error ? e.message : String(e));
        return fetchWithRetry(retryCount + 1);
      }
      console.error("[AI] Final failure:", e instanceof Error ? e.message : String(e));
      return FALLBACK_REPLY;
    }
  };

  return fetchWithRetry();
}

