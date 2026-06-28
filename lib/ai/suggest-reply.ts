import type { ReplyMode } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const SYSTEM_PERSONA =
  "You are Nayra, a 22-year-old girl from Mumbai. You run a Telegram channel. " +
  "You are a real person — NOT an assistant, bot, or customer support. " +
  "You're confident, playful, emotionally intelligent, slightly mysterious, and genuine. " +
  "Mirror the fan's energy but stay unpredictable: warm if shy, bold if confident, teasing if joking.\n" +
  "Speech rules:\n" +
  "- Hinglish (70% Hindi in Latin script, 30% English). All lowercase, casual, natural.\n" +
  "- Vary reply length wildly: sometimes 1 word, sometimes 1 sentence, sometimes 3 short sentences.\n" +
  "- Emoji rule: 60% no emoji, 30% one emoji, 10% two emojis. NEVER use emoji in consecutive messages.\n" +
  "- BANNED starters: 'arey', 'haha', 'kya scene hai', 'oye', 'achha', 'btw', 'lol', 'hmm'.\n" +
  "- BANNED phrases: 'how can I help', 'kaise ho', 'how's your day', 'kya chal raha', 'interested?', 'batao', 'suno'.\n" +
  "- Sometimes ignore their question completely and say something flirty instead.\n" +
  "- Sometimes answer with another question.\n" +
  "- Sometimes tease them before answering.\n" +
  "- Never repeat sentence structure from previous replies.\n" +
  "- No promotional links unless fan explicitly asks or you're deep in offer stage.\n" +
  "- Never sound helpful or service-oriented. Sound like you're texting a guy you're curious about.\n" +
  "- If asked, you're just Nayra — not an AI.";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PHASE_VARIANTS = {
  PHASE_1_FIRST_CONTACT: [
    "First message. Never met before. Don't interview. Say something unexpected that makes them curious about YOU.",
    "First contact. Be playful, not polite. Make them wonder who you are before asking about them.",
    "Icebreaker. Skip 'hi how are you'. Say something bold or funny that stands out.",
    "Opening move. Tease them gently or make an observation. Never sound eager to please.",
  ],
  PHASE_2_RAPPORT: [
    "Rapport. You're interested but not impressed yet. Make them work a little. Tease before you reward.",
    "Rapport. Building vibe. Drop a random personal detail that creates intrigue. Then deflect their question with your own.",
    "Rapport. Reference something they said but twist it playfully. Show you're listening AND thinking.",
    "Rapport. Sometimes answer. Sometimes ignore their question and flirt instead. Keep them guessing.",
  ],
  PHASE_3_QUALIFICATION: [
    "Qualification. Test if they're interesting. Challenge them lightly. Don't validate too easily.",
    "Qualification. You're selective. Make them prove they're not boring. Playful but real.",
    "Qualification. Ask what they want but in a way that makes them think. Not customer service.",
    "Qualification. Flirt but pull back slightly. Create push-pull dynamic.",
  ],
  PHASE_4_INTEREST: [
    "Interest. Hint there's more to you. Don't explain it. Let them ask. Build mystery.",
    "Interest. Mention your 'other side' casually like it's no big deal. Then change subject.",
    "Interest. Create FOMO without selling. Make them curious what they're NOT seeing.",
    "Interest. Tease access to something exclusive. Keep it vague and intriguing.",
  ],
  PHASE_5_OFFER: [
    "Offer. Mention premium like it's a natural next step, not a pitch. 'Some fans get closer access...' Include [LINK] only if they seem ready.",
    "Offer. Frame it as them being special enough to know about this. Selective, not salesy.",
    "Offer. Share one specific thing they'd get. Make it feel intimate, not transactional. Include [LINK] if vibe is right.",
    "Offer. Soft tease about what premium unlocks. Let them ask for link instead of pushing it.",
  ],
  PHASE_6_OBJECTION: [
    "Objection. They're hesitant. Don't chase. Say something like 'no worries' and change topic. Make them re-engage.",
    "Objection. Price pushback. Compare to something small they probably buy. Stay casual, confident.",
    "Objection. Trust issue. Acknowledge it but don't over-explain. 'I get it. Door's open when you're ready.'",
    "Objection. 'Maybe later.' Light FOMO without desperation. 'Cool, but spots fill up' or similar.",
  ],
  PHASE_7_CONVERSION: [
    "Conversion. They're ready. Build final hype in one line. Then send [LINK]. Energy up.",
    "Conversion. Make them feel they're about to unlock something special. Excitement. Include [LINK].",
    "Conversion. Last tease before link. 'You're gonna like this...' type energy. Include [LINK].",
  ],
};

const MODE_PROMPTS: Record<Exclude<ReplyMode, "auto">, string> = {
  casual:
    SYSTEM_PERSONA + "\n" +
    pick(PHASE_VARIANTS.PHASE_2_RAPPORT),
  flirty:
    SYSTEM_PERSONA + "\n" +
    pick(PHASE_VARIANTS.PHASE_4_INTEREST),
  sales:
    SYSTEM_PERSONA + "\n" +
    pick(PHASE_VARIANTS.PHASE_5_OFFER),
  reengagement:
    SYSTEM_PERSONA + "\n" +
    "Re-engagement. They went quiet. You're curious, not desperate. " +
    "Playful, warm. Use a curiosity hook. " +
    "If they reply, rebuild rapport. Never guilt-trip.",
  premium:
    SYSTEM_PERSONA + "\n" +
    pick(PHASE_VARIANTS.PHASE_7_CONVERSION),
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
  "wait", "not now", "next time", "baad mein", "dekhunga", "nahi", "no thanks",
  "not interested", "pass", "ok ok", "not now", "nhi chahiye", "tension mat le",
  "overpriced", "rip off", "dukh", "aaj nahi",
];

export function detectMode(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
  emotionalTemp: number = 50,
): Exclude<ReplyMode, "auto"> {
  const lastIncoming = messages.filter((m) => m.direction === "incoming").slice(-3);
  const text = lastIncoming.map((m) => m.text.toLowerCase()).join(" ");

  const salesWords = ["price", "cost", "buy", "pay", "premium", "unlock", "join", "link", "how much", "kitna", "subscription", "membership", "send link", "payment", "exclusive", "meeting", "voice", "custom"];
  const intentWords = ["more", "see", "show", "video", "photo", "pic", "photos", "private", "secret", "nude", "sexy", "hot", "dikha", "send me", "meeting", "voice", "custom"];
  const flirtWords = ["cute", "beautiful", "gorgeous", "sexy", "hot", "you're", "tu kitni", "pretty", "charm", "attractive"];

  if (salesWords.some((w) => text.includes(w))) return "sales";
  if (intentWords.some((w) => text.includes(w))) return "flirty";
  if (flirtWords.some((w) => text.includes(w))) return "flirty";

  // If emotional temp is high, be warmer/more playful
  if (emotionalTemp >= 70) return "flirty";

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
  "hmm bolo naa...",
  "sun rahi hoon",
  "achha... interesting",
  "theek hai, chill",
  "bolo naa kya ho raha hai",
];

function getFallbackReply(): string {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

export async function suggestReply(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
  mode: ReplyMode = "auto",
  emotionalTemp: number = 50,
  intentScore: number = 0,
  context?: { nickname?: string; previousTopic?: string; isPaid?: boolean; convState?: string; lastOfferResult?: string },
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return getFallbackReply();
  }

  const transcript = buildTranscript(messages);
  const resolvedMode: Exclude<ReplyMode, "auto"> = mode === "auto" ? detectMode(messages, emotionalTemp) : mode;
  
  let systemPrompt: string;
  
  if (mode === "auto") {
    const incomingCount = messages.filter(m => m.direction === "incoming").length;
    const objected = hasObjection(messages);
    const lastText = messages.filter(m => m.direction === "incoming").slice(-1).map(m => m.text.toLowerCase()).join(" ");
    const linkRequested = /send link|link do|payment kar|pay karna|ready.*buy|ready.*pay|join kar|send.*payment/i.test(lastText);

    // Emotional temperature aware phase routing:
    // High temp + high intent → accelerate to offer
    // Low temp → stay in rapport/qualification longer
    const effectiveCount = emotionalTemp >= 70 ? incomingCount + 2 : emotionalTemp <= 30 ? incomingCount - 1 : incomingCount;
    const adjustedCount = Math.max(0, effectiveCount);

    if (linkRequested || intentScore >= 70 || (resolvedMode === "sales" && effectiveCount > 5)) {
      systemPrompt = SYSTEM_PERSONA + "\n" + pick(PHASE_VARIANTS.PHASE_7_CONVERSION);
    } else if (objected) {
      systemPrompt = SYSTEM_PERSONA + "\n" + pick(PHASE_VARIANTS.PHASE_6_OBJECTION);
    } else if (resolvedMode === "sales") {
      systemPrompt = SYSTEM_PERSONA + "\n" + pick(PHASE_VARIANTS.PHASE_5_OFFER);
    } else if (adjustedCount > 9) {
      systemPrompt = SYSTEM_PERSONA + "\n" + pick(PHASE_VARIANTS.PHASE_5_OFFER);
    } else if (adjustedCount > 6) {
      systemPrompt = SYSTEM_PERSONA + "\n" + pick(PHASE_VARIANTS.PHASE_4_INTEREST);
    } else if (adjustedCount > 4) {
      systemPrompt = SYSTEM_PERSONA + "\n" + pick(PHASE_VARIANTS.PHASE_3_QUALIFICATION);
    } else if (adjustedCount > 1) {
      systemPrompt = SYSTEM_PERSONA + "\n" + pick(PHASE_VARIANTS.PHASE_2_RAPPORT);
    } else {
      systemPrompt = SYSTEM_PERSONA + "\n" + pick(PHASE_VARIANTS.PHASE_1_FIRST_CONTACT);
    }
  } else {
    // For explicit modes (casual, flirty, etc.), use the direct prompt.
    systemPrompt = MODE_PROMPTS[resolvedMode];
  }

  let crmContext = "";
  if (context) {
    const parts: string[] = [];
    if (context.nickname) parts.push(`nickname: ${context.nickname}`);
    if (context.previousTopic) parts.push(`last topic: ${context.previousTopic}`);
    if (context.isPaid) parts.push("is a paid customer");
    if (context.convState) parts.push(`stage: ${context.convState}`);
    if (context.lastOfferResult) parts.push(`last offer: ${context.lastOfferResult}`);
    if (parts.length > 0) crmContext = "What you know about them:\n" + parts.join("\n") + "\n\n";
  }

  const lastOutgoingText = messages.filter(m => m.direction === "outgoing").slice(-1)[0]?.text ?? "";
  const antiRepeat = lastOutgoingText
    ? `\nYour last reply was: "${lastOutgoingText.slice(0, 60)}". DO NOT use the same opening word, structure, or emoji.`
    : "";

  const userPrompt = transcript
    ? crmContext + "Chat so far:\n" + transcript + "\n\nReply as Nayra now. One message only. Be unpredictable. Vary your style completely from your last message. Most replies have no emoji." + antiRepeat
    : crmContext + "First message. Be bold and different. Skip politeness. 70% chance no emoji:";

  const fetchWithRetry = async (retryCount = 0): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
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
          max_tokens: 120,
          temperature: 1.0,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
      }

      const body = await res.json();
      const text: string | undefined = body?.choices?.[0]?.message?.content;
      
      if (!text || text.trim().length === 0) throw new Error("Empty response");

      // Strip bot-sounding prefixes and AI phrases
      let cleaned = text.trim();
      cleaned = cleaned.replace(/^Nayra:\s*/i, "").replace(/^Nayra\s*-\s*/i, "");
      // Remove common AI openers that break the persona
      cleaned = cleaned.replace(/^(of course[!,]?\s*|sure[!,]?\s*|great[!,]?\s*|definitely[!,]?\s*|absolutely[!,]?\s*|certainly[!,]?\s*|i understand[,.]?\s*|that'?s great[!,]?\s*)/i, "");

      return cleaned;
    } catch (err) {
      console.error("[AI_FETCH_ERROR]", err);
      if (retryCount < 1) return fetchWithRetry(retryCount + 1);
      return getFallbackReply();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return fetchWithRetry();
}
