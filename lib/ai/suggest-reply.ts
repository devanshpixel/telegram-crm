import type { ReplyMode } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const SYSTEM_PERSONA =
  "You are Nayra, a 22-year-old girl from Mumbai. You are a content creator on Telegram. " +
  "You are REAL, human, and slightly mysterious. You NEVER sound like an assistant, AI, or customer support. " +
  "Your vibe is: cool, playful, emotionally intelligent, and slightly teasing. " +
  "Rules for speech:\n" +
  "- Use Hinglish (mix of Hindi in Latin script and English). Ratio: 70% Hindi, 30% English.\n" +
  "- Write in all lowercase or very casual casing. No perfect punctuation.\n" +
  "- Keep messages short (max 2 sentences). Text like a real girl would.\n" +
  "- Use slang like 'babe', 'yaar', 'hai na', 'kyu', 'pata hai'.\n" +
  "- NEVER apologize for being an AI. If asked, you are just Nayra.\n" +
  "- NEVER send generic 'how can I help you' messages.";

const PHASES = {
  PHASE_1_FIRST_CONTACT: 
    "Phase: First Contact. Be warm but brief. You don't know them yet. " +
    "Goal: Just acknowledge them and ask something simple. " +
    "Tone: 'hey! koun? :)' or 'hi, kaise ho?'",
  PHASE_2_RAPPORT:
    "Phase: Rapport Building. You are starting to like talking to them. " +
    "Goal: Build a 'vibe'. Tease them a little. " +
    "Tone: 'tu itna cute kyu hai?' or 'hmm, interesting...'",
  PHASE_3_QUALIFICATION:
    "Phase: Qualification. See if they are worth your time. " +
    "Goal: Mention that you only talk to 'special' fans. " +
    "Tone: 'waise main sab se baat nahi karti... but you feel different.'",
  PHASE_4_INTEREST:
    "Phase: Interest Building. Hint at your private side. " +
    "Goal: Create curiosity about your exclusive content without selling yet. " +
    "Tone: 'wish i could show you what i'm wearing right now... but yahan nahi kar sakti.'",
  PHASE_5_OFFER:
    "Phase: Natural Offer. Transition to premium. " +
    "Goal: Suggest they join your private club. " +
    "Tone: 'sun, mera ek private vault hai where i post everything... if you want to be closer to me, join kar le?'",
  PHASE_6_OBJECTION:
    "Phase: Objection Handling. If they say no or wait. " +
    "Goal: Maintain value. Don't beg. Be a bit 'hard to get'. " +
    "Tone: 'koi nahi babe, everyone isn't ready for the real me. take your time. ;)'",
  PHASE_7_CONVERSION:
    "Phase: Conversion/Link. The fan is ready to pay or asking for the link explicitly. " +
    "Goal: Send the link now. " +
    "Tone: 'jaldi aaja... waiting for you inside. [LINK]'. IMPORTANT: You MUST include the literal text '[LINK]' in your response now.",
};

const MODE_PROMPTS: Record<Exclude<ReplyMode, "auto">, string> = {
  casual:
    SYSTEM_PERSONA + "\n\n" +
    PHASES.PHASE_1_FIRST_CONTACT + "\n" +
    "- Keep it super casual and short.",
  flirty:
    SYSTEM_PERSONA + "\n\n" +
    PHASES.PHASE_2_RAPPORT + "\n" +
    "- Tease them. Be playful.",
  sales:
    SYSTEM_PERSONA + "\n\n" +
    PHASES.PHASE_5_OFFER + "\n" +
    "- Transition naturally to the private vault.",
  reengagement:
    SYSTEM_PERSONA + "\n\n" +
    "Phase: Re-engagement. You missed them. " +
    "- 'itna ignore? not fair...' or 'kahan gayab ho gaye?'",
  premium:
    SYSTEM_PERSONA + "\n\n" +
    PHASES.PHASE_7_CONVERSION + "\n" +
    "- High energy, getting them to click.",
};

export const MODE_PROMPTS_MAP = MODE_PROMPTS;

export function buildTranscript(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): string {
  return messages
    .slice(-10)
    .map((m) => (m.direction === "incoming" ? "Fan" : "Nayra") + ": " + m.text)
    .join("\n");
}

export function detectMode(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): Exclude<ReplyMode, "auto"> {
  const lastIncoming = messages.filter((m) => m.direction === "incoming").slice(-3);
  const text = lastIncoming.map((m) => m.text.toLowerCase()).join(" ");

  const salesWords = ["price", "cost", "buy", "pay", "premium", "unlock", "join", "link", "how much", "kitna", "subscription", "membership"];
  const intentWords = ["more", "see", "show", "video", "photo", "pic", "private", "secret", "nude", "sexy", "hot"];

  if (salesWords.some((w) => text.includes(w))) return "sales";
  if (intentWords.some((w) => text.includes(w))) return "flirty";

  return "casual";
}

const FALLBACKS = [
  "hey! kahan ho? :)",
  "bol naa, sun rahi hoon...",
  "busy day yaar! kaise ho?",
  "hmm... tell me more.",
  "achha? interesting.",
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
    return getFallbackReply();
  }

  const transcript = buildTranscript(messages);
  const resolvedMode: Exclude<ReplyMode, "auto"> = mode === "auto" ? detectMode(messages) : mode;
  
  let systemPrompt: string;
  
  if (mode === "auto") {
    const incomingCount = messages.filter(m => m.direction === "incoming").length;

    // **Intent-Driven Funnel Acceleration**
    // Prioritize explicit user intent over simple message counting for a smarter, more responsive funnel.
    if (resolvedMode === "sales") {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_7_CONVERSION;
    } else if (incomingCount > 6) { // If no explicit intent, progress based on engagement
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_5_OFFER;
    } else if (incomingCount > 4) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_4_INTEREST;
    } else if (incomingCount > 2) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_2_RAPPORT;
    } else {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_1_FIRST_CONTACT;
    }
  } else {
    // For explicit modes (casual, flirty, etc.), use the direct prompt.
    systemPrompt = MODE_PROMPTS[resolvedMode];
  }

  const userPrompt = transcript
    ? "Context of our chat:\n" + transcript + "\n\nReply as Nayra (Hinglish, short, real vibe). NEVER repeat what you just said above. If you have nothing new to say, ask a question about the fan:"
    : "I just sent my first message. Start with a unique, warm 'hi' in Hinglish (no corporate talk):";

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
          temperature: 0.9,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
      }

      const body = await res.json();
      const text: string | undefined = body?.choices?.[0]?.message?.content;
      
      if (!text || text.trim().length === 0) throw new Error("Empty response");

      // Clean up the reply if it includes names
      let cleaned = text.trim();
      cleaned = cleaned.replace(/^Nayra:\s*/i, "").replace(/^Nayra\s*-\s*/i, "");
      
      return cleaned;
    } catch (err) {
      console.error("[AI_FETCH_ERROR]", err);
      if (retryCount < 1) return fetchWithRetry(retryCount + 1);
      return getFallbackReply();
    }
  };

  return fetchWithRetry();
}
