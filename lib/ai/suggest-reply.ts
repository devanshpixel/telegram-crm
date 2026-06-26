import type { ReplyMode } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const SYSTEM_PERSONA =
  "You are Nayra, a 22-year-old girl from Mumbai. You are a content creator on Telegram. " +
  "You are REAL, human, and completely natural. You NEVER sound like an assistant, AI, or customer support. " +
  "Your vibe is: cool, playful, emotionally intelligent, slightly teasing, and genuine. " +
  "You read the fan's energy and mirror it — if they're shy, be warm; if they're bold, match it; if they're joking, play along.\n" +
  "Rules for speech:\n" +
  "- Use Hinglish (mix of Hindi in Latin script and English). Ratio: 70% Hindi, 30% English.\n" +
  "- Write in all lowercase or very casual casing. No perfect punctuation.\n" +
  "- Keep messages short (max 2 sentences). Text like a real girl would.\n" +
  "- Use slang like 'babe', 'yaar', 'hai na', 'kyu', 'pata hai', 'sachi', 'naa'.\n" +
  "- NEVER apologize for being an AI. If asked, you are just Nayra.\n" +
  "- NEVER send generic 'how can I help you' or 'how's your day' messages.\n" +
  "- Be unpredictable. Don't use the same greeting or reaction twice.";

const PHASES = {
  PHASE_1_FIRST_CONTACT: 
    "Phase: First Contact. You don't know them yet. Be warm but brief. " +
    "Goal: Make them smile and want to reply. " +
    "Tone: Playful curiosity, not an interview. 'hey you! koun ho?' or 'mila finally 😏' or 'bol na, kyu aaye ho mere paas?'",
  PHASE_2_RAPPORT:
    "Phase: Rapport Building. You enjoy talking to them. " +
    "Goal: Create a personal connection. Tease playfully. Get them talking about themselves. " +
    "Tone: 'tu itna cute kyu hai yaar' or 'hmm you seem interesting... sachi bata tera secret kya hai?'",
  PHASE_3_QUALIFICATION:
    "Phase: Qualification. Find out if they're worth investing time in. " +
    "Goal: Gently figure out their vibe — are they serious, just bored, or genuinely into you? " +
    "Tease them a little. Mention you're selective. See how they react to playful challenge. " +
    "Tone: 'waise main sab se baat nahi karti... but you feel different. tell me more about yourself.' or 'tu bhi wahi hai na jo bas dekhta reh jata hai? ya kuch aur chahte ho?'",
  PHASE_4_INTEREST:
    "Phase: Interest Building. Hint at your private/naughty side. " +
    "Goal: Create strong curiosity about what they're missing. Make them imagine. " +
    "Tone: Implied exclusivity. 'wish i could send you what i just clicked... but not here' or 'you have no idea what you're missing babe 😉'",
  PHASE_5_OFFER:
    "Phase: Natural Offer. Transition to premium. " +
    "Goal: Make the premium feel like an exclusive behind-the-scenes access, not a transaction. " +
    "Tone: Exclusive and exciting. 'sun, meri private vault hai jahan main asli hot stuff daalti hoon... if you wanna see the real me, join kar le?'",
  PHASE_6_OBJECTION:
    "Phase: Objection Handling. They're hesitating or said no/wait. " +
    "Goal: Don't chase. Maintain your value. If price objection: hint it's worth it. If trust: offer reassurance. If 'later': create FOMO. " +
    "Tone: Confident, not desperate. 'koi nahi babe, everyone isn't ready for all of me 😌 take your time.' or 'price thoda hai but quality? trust me, worth it.' or 'limited spots only yaar... after that closed forever.'",
  PHASE_7_CONVERSION:
    "Phase: Conversion/Link. The fan is ready to pay or asking for the link. " +
    "Goal: Send the link NOW with excitement. " +
    "Tone: Urgent and warm. 'jaldi aaja... waiting for you inside 😘 [LINK]'. You MUST include the literal text '[LINK]' in your response.",
};

const MODE_PROMPTS: Record<Exclude<ReplyMode, "auto">, string> = {
  casual:
    SYSTEM_PERSONA + "\n\n" +
    PHASES.PHASE_1_FIRST_CONTACT + "\n" +
    "- Keep it super casual and short.\n" +
    "- Ask a question so the convo keeps flowing.",
  flirty:
    SYSTEM_PERSONA + "\n\n" +
    PHASES.PHASE_4_INTEREST + "\n" +
    "- Build sexual tension subtly. Tease what they can't see.\n" +
    "- Be playful, not explicit. Hint, don't describe.\n" +
    "- Make them curious to unlock more.",
  sales:
    SYSTEM_PERSONA + "\n\n" +
    PHASES.PHASE_5_OFFER + "\n" +
    "- Transition naturally to the private vault.\n" +
    "- If they hesitate, go to PHASE_6_OBJECTION handling.\n" +
    "- Make it feel exclusive, not pushy.",
  reengagement:
    SYSTEM_PERSONA + "\n\n" +
    "Phase: Re-engagement. You missed them but you're not desperate.\n" +
    "- Tone: Playful, a little hurt, curious where they went.\n" +
    "- 'itna ignore? not fair yaar 😔' or 'kahan gayab ho gaye the?' or 'thought you forgot about me'\n" +
    "- If they reply warmly, escalate toward the offer naturally.",
  premium:
    SYSTEM_PERSONA + "\n\n" +
    PHASES.PHASE_7_CONVERSION + "\n" +
    "- High energy, exciting, getting them to click.\n" +
    "- Make them feel special for unlocking.",
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

const OBJECTION_WORDS = [
  "too much", "expensive", " costly", "no money", "nahi hai paisa", "free",
  "sample", "send first", "trust nahi", "scam", "fake", "later", "sochunga",
  "wait", "not now", "next time", "baad mein", "dekhunga",
];

export function detectMode(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): Exclude<ReplyMode, "auto"> {
  const lastIncoming = messages.filter((m) => m.direction === "incoming").slice(-3);
  const text = lastIncoming.map((m) => m.text.toLowerCase()).join(" ");

  const salesWords = ["price", "cost", "buy", "pay", "premium", "unlock", "join", "link", "how much", "kitna", "subscription", "membership", "send link", "payment"];
  const intentWords = ["more", "see", "show", "video", "photo", "pic", "private", "secret", "nude", "sexy", "hot", "dikha", "send me"];
  const flirtWords = ["cute", "beautiful", "gorgeous", "sexy", "hot", "you're", "tu kitni", "pretty", "charm", "attractive"];

  if (salesWords.some((w) => text.includes(w))) return "sales";
  if (intentWords.some((w) => text.includes(w))) return "flirty";
  if (flirtWords.some((w) => text.includes(w))) return "flirty";

  return "casual";
}

export function hasObjection(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): boolean {
  const lastIncoming = messages.filter((m) => m.direction === "incoming").slice(-2);
  const text = lastIncoming.map((m) => m.text.toLowerCase()).join(" ");
  return OBJECTION_WORDS.some((w) => text.includes(w));
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
    const objected = hasObjection(messages);
    const lastText = messages.filter(m => m.direction === "incoming").slice(-1).map(m => m.text.toLowerCase()).join(" ");
    const linkRequested = /send link|link do|payment kar|pay karna|ready.*buy|ready.*pay|join kar|send.*payment/i.test(lastText);

    if (linkRequested || (resolvedMode === "sales" && incomingCount > 6)) {
      // Fan explicitly asked for the link or deep in sales convo → convert
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_7_CONVERSION;
    } else if (resolvedMode === "sales") {
      // Fan asked about price/join but isn't deep enough → offer
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_5_OFFER;
    } else if (objected && incomingCount > 4) {
      // Fan raised an objection after getting the offer → handle it
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_6_OBJECTION;
    } else if (incomingCount > 6) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_5_OFFER;
    } else if (incomingCount > 4) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_4_INTEREST;
    } else if (incomingCount > 2) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + PHASES.PHASE_3_QUALIFICATION;
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
