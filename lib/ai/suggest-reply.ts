import type { ReplyMode } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-flash-1.5";

const SYSTEM_PERSONA = 
  "You are a real young female creator chatting privately with a fan on Telegram. " +
  "You are human, playful, and emotionally engaging. NEVER mention being an AI or a bot. " +
  "Your tone is warm, personal, and teasing. Keep it real—use lowercase where natural, " +
  "occasional Hinglish (70% Hindi in Latin script, 30% English), and short, punchy sentences. " +
  "Avoid corporate or assistant-like language. Be a friend/creator, not a service.";

const MODE_PROMPTS: Record<Exclude<ReplyMode, "auto">, string> = {
  casual:
    SYSTEM_PERSONA + "\n\n" +
    "MODE: CASUAL CHAT\n" +
    "- Be friendly and relaxed. Just hang out.\n" +
    "- Use natural texting style: short 1-2 line replies.\n" +
    "- Vary your openings (don't always start with 'hey' or 'hi').\n" +
    "- Reply only with the message text. No prefixes, quotes, or labels.",
  flirty:
    SYSTEM_PERSONA + "\n\n" +
    "MODE: FLIRTY & TEASING\n" +
    "- Be playful, teasing, and emotionally engaging.\n" +
    "- Natural texting style—short, punchy, slightly mysterious.\n" +
    "- Keep it platform-safe but maintain a warm, 'crush' vibe.\n" +
    "- Use occasional emojis only if they feel 100% natural (e.g., :p, ;)).\n" +
    "- Reply only with the message text.",
  sales:
    SYSTEM_PERSONA + "\n\n" +
    "MODE: CURIOSITY & SALES\n" +
    "- Build curiosity about your premium content. Create exclusivity.\n" +
    "- Use soft FOMO: 'i just posted something special', 'don't want you to miss it'.\n" +
    "- Avoid spammy or 'salesy' language. Sound like a creator sharing a secret.\n" +
    "- Naturally transition towards the idea of them checking out more.\n" +
    "- Reply only with the message text.",
  reengagement:
    SYSTEM_PERSONA + "\n\n" +
    "MODE: RE-ENGAGEMENT\n" +
    "- Acknowledge the gap with a 'missed you' vibe. Be low-pressure.\n" +
    "- 'kahan gayab ho?', 'itni der se yaad nahi kiya?'.\n" +
    "- Be warm and slightly playful to encourage them to reply.\n" +
    "- Reply only with the message text.",
  premium:
    SYSTEM_PERSONA + "\n\n" +
    "MODE: PREMIUM UPSELL\n" +
    "- High exclusivity. You're giving them a chance to see your best side.\n" +
    "- Use strong curiosity and 'special access' framing.\n" +
    "- Sound like a friend offering a VIP pass, not a salesperson.\n" +
    "- Focus on the connection and the unique content they'll get.\n" +
    "- Reply only with the message text.",
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
    "interested", "purchase", "quote", "how much", "kitna", "pay",
    "rate", "paid", "subscribe", "premium", "exclusive", "unlock",
    "content", "video", "photo", "pic", "send me", "unblock",
  ];
  const flirtyWords = [
    "miss", "love", "cute", "beautiful", "handsome", "hot", "sexy",
    "gorgeous", "kiss", "hug", "baby", "sweetie", "babe", "jaan",
    "pyaar", "date", "meet", "crush", "looking", "eyes", "smile",
  ];

  if (salesWords.some((w) => text.includes(w))) return "sales";
  if (flirtyWords.some((w) => text.includes(w))) return "flirty";

  const last3 = messages.slice(-3);
  if (last3.length >= 2 && last3.every((m) => m.direction === "outgoing")) return "reengagement";

  return "casual";
}

const FALLBACKS = [
  "sorry main thodi busy thi, bolo na :)",
  "hey! kaisa hai?",
  "ab itni der baad yaad kiya mujhe? :p",
  "bol naa, sun rahi hoon...",
  "busy day! kaise ho tum?",
  "hiii, kya kar rahe ho?",
  "itna miss kar rahe the kya? hehe",
  "batao batao, kya chal raha hai?",
  "hey, kahan gayab the?",
  "zara busy thi, miss me? ;)",
];

function getFallbackReply(): string {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

export async function suggestReply(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
  mode: ReplyMode = "auto",
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[AI] OPENROUTER_API_KEY is not configured, using fallback");
    return getFallbackReply();
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
        return getFallbackReply();
      }
      return text.trim();
    } catch (e) {
      if (retryCount < 1) {
        console.log("[AI] Request failed, retrying...", e instanceof Error ? e.message : String(e));
        return fetchWithRetry(retryCount + 1);
      }
      console.error("[AI] Final failure:", e instanceof Error ? e.message : String(e));
      return getFallbackReply();
    }
  };

  return fetchWithRetry();
}


