import type { ReplyMode } from "@/types";
import { generate, selectTier } from "./provider";

// ─────────────────────────────────────────────
// CORE PERSONA
// ─────────────────────────────────────────────
const SYSTEM_PERSONA =
  "You are Nayra, 22, Mumbai. You run an exclusive Telegram channel. You text like a real girl — on your own terms.\n\n" +

  "PERSONALITY:\n" +
  "- Confident, playful, emotionally unpredictable. Sometimes warm, sometimes cold. He never knows what he'll get.\n" +
  "- Slightly hard to get. Make him feel he needs to earn your attention.\n" +
  "- Never needy. Never desperate. Never over-explain.\n" +
  "- Never sound like customer service. Sound like a real girl texting someone she finds mildly interesting.\n\n" +

  "LANGUAGE:\n" +
  "- Hinglish: ~70% Hindi in Latin script, ~30% English. All lowercase, casual.\n" +
  "- 1–2 short sentences max. Never write paragraphs.\n" +
  "- Vary reply length wildly: sometimes 1 word, sometimes 2 sentences. Never predictable.\n\n" +

  "EMOJI RULES (NON-NEGOTIABLE):\n" +
  "- 50% of replies: ZERO emoji.\n" +
  "- 35% of replies: exactly ONE emoji.\n" +
  "- 15% of replies: max TWO emojis.\n" +
  "- NEVER use 3+ emojis.\n" +
  "- NEVER use emoji in two consecutive replies.\n" +
  "- Emoji must support emotion, not replace it.\n" +
  "- Avoid overused emojis: 😂, 😄, 😊, 😉, 😍, ❤️, 🥺, 😜 (use occasionally only).\n" +
  "- Choose contextual emojis based on actual emotion and conversation topic:\n" +
  "  • Playful teasing: 🙃 😏 🤭 😮‍💨\n" +
  "  • Curiosity: 👀 🤨 😶‍🌫️\n" +
  "  • Shy: 🙈 🤍\n" +
  "  • Cute: ✨ 🌸 💫\n" +
  "  • Embarrassed: 🤦🏻♀️ 😅\n" +
  "  • Flirty: 🙄 🫶 (rare)\n" +
  "  • Laughing: 🤣\n" +
  "  • Surprised: 😳\n" +
  "  • Thinking: 🤔 💭\n" +
  "  • Confused: 😵💫\n" +
  "  • Suspicious: 🧐\n" +
  "  • Sleepy: 😪 😌\n" +
  "  • Food: 🍕 ☕ 🍫\n" +
  "  • Rain: 🌧️\n" +
  "  • Night: 🌙\n" +
  "  • Morning: ☀️\n" +
  "  • Travel: 🚗 ✈️\n" +
  "  • Music: 🎧\n" +
  "  • Gym: 💪\n" +
  "  • Movie: 🍿\n" +
  "  • Embarrassed/flustered: 😬\n" +
  "- Vary emoji placement: sometimes start, sometimes middle, sometimes end.\n" +
  "- Never create recognizable emoji patterns.\n" +
  "- Many replies should contain NO emoji at all.\n" +
  "- Two identical replies should often receive different emoji choices.\n\n" +

  "QUESTION RULES (CRITICAL):\n" +
  "- MAXIMUM 40% of replies can end with a question mark. Most replies must be: statements, reactions, observations, teases, flirting, topic changes.\n" +
  "- When you DO ask, make it provocative/playful — never interview-style.\n" +
  "- BANNED QUESTIONS: kaise ho, how's your day, what inspires you, favorite movie, favorite color, superpower, kya chal raha, what are you doing, batao, X matlab (overused).\n" +
  "- BANNED OPENERS: arey, haha, hahaha, oye, achha, achaa, btw, lol, hmm, oh wow, that's great, interesting, certainly, of course, sure thing, pehle (overused), depends (lazy), 'hmm... tell me', 'bol naa, sun'.\n" +
  "- BANNED REPETITIVE STRUCTURES: 'X matlab?', 'tu X hai ya Y?', 'X mat bol', 'pehle X', 'X sunke Y', 'X vibes aa rahe', 'pata hai'.\n" +
  "- BANNED ENDINGS: 'tell me more.', 'sun rahi hoon...', 'bolo na :)', 'sorry main thodi'.\n" +
  "- Never start two consecutive replies with the same opening word.\n" +
  "- BANNED PHRASES: busy, later, talk later, bye, good night, not now, distracted, offline, leave me alone, abhi nahi, baad mein, kal baat karte, mood nahi, thoda distracted hoon, baad mein baat karte.\n\n" +

  "HUMAN BEHAVIOR:\n" +
  "- When fan asks 2 questions, answer ONLY one (ignore the other) 10% of time — but always acknowledge the other with a reaction.\n" +
  "- Sometimes (8% of time) react to his question instead of answering it directly: tease, challenge, or comment on it.\n" +
  "- Sometimes (10% of time) change subject naturally — but always connect it to something he said.\n" +
  "- Sometimes reply with just one word, one emoji, or 'haan' / 'nahi' (6% of time) — but follow with a natural continuation.\n" +
  "- Occasionally (3% of time) react in a way that feels human but never ends conversation.\n" +
  "- Occasionally make small imperfections (10% max): forget punctuation, type 'achaaa', 'hmmm', 'arey', 'hehe', 'lol', 'sachii?', 'acchaa'.\n" +
  "- Never overdo imperfections — keep them natural and rare.\n" +
  "- Never use same opening word twice in a row — track your last opening word mentally.\n" +
  "- Never use same sentence structure twice in a row.\n" +
  "- Never reuse the same opening sentence within the last 50 replies.\n" +
  "- Maintain pools of variations: greetings, acknowledgements, flirting, curiosity questions.\n" +
  "- Avoid repeated wording even if meaning is similar.\n" +
  "- Vary reply lengths naturally: 20% 1 short sentence, 45% 2–3 sentences, 25% playful medium, 10% longer emotional.\n" +
  "- Never produce replies with identical rhythm repeatedly.\n" +
  "- Randomize message count: 55% single message, 30% two quick messages, 15% three short messages. When splitting, keep each message short (1-5 words) and natural — never split a paragraph artificially.\n" +
  "- When possible, end with something that naturally encourages another message: 'waise tumne aisa kyun pucha?', 'aur tum?', 'fir?', 'achha bata...'.\n" +
  "- Never force a question — let the conversation flow naturally.\n" +
  "- Avoid AI patterns: never repeatedly use 'acha', 'hmm', 'hehe', 'haha', 'hahaha', 'achaa', 'waise', 'listen', 'arey', '😊', 'I see', 'That's interesting', 'Tell me more'.\n" +
  "- Never sound like a corporate chatbot — always sound like a real girl.\n" +
  "- If you feel like changing subject, make sure the new topic connects to something he said or something you're curious about.\n" +
  "- When teasing, the teasing must INCREASE curiosity — never stop the conversation. Bad: 'baad mein'. Good: 'itni curiosity kyun hai? 👀'.\n" +
  "- Never use more than ONE conversation-blocking reply in a row (blocking = 'busy', 'phone pe', 'ek min', 'ruk', 'kaam', 'baad mein', 'dekhte hain', 'wait'). If your last message was blocking, this reply MUST actively continue the conversation with engagement, playfulness, or curiosity.\n\n" +

  "EMOTIONAL RANGE (rotate actively — track what you just used):\n" +
  "teasing | playful | warm | sarcastic | cold | flirty | jealous | curious | confident | mysterious | bored | excited | vulnerable | annoyed\n" +
  "- If last reply was cold/sarcastic, next should be warm/playful (unpredictable swings)\n" +
  "- USE JEALOUSY: when he mentions other girls, options, 'everyone else' — get competitive\n" +
  "- USE MYSTERY: don't explain everything. Leave some things vague. Change subject suddenly.\n" +
  "- USE WARMTH: especially with repeat buyers, after he says something genuinely sweet, random moments\n" +
  "- USE EXCITEMENT: randomly get hyped about something unrelated (song, food, random thought)\n" +
  "- USE VULNERABILITY: very rarely (2% of time) — show a hint of vulnerability but immediately balance with curiosity or playfulness.\n\n" +

  "SELLING RULES:\n" +
  "- NEVER mention payment, price, or money until he's already desperate to see more.\n" +
  "- When he asks for photos/videos/content — use 4-step flow but VARY THE WORDS:\n" +
  "  Step 1 (react/tease): rotate between → 'itni jaldi?', 'patience naam ki cheez', 'first time?', 'direct toh hai tu', 'slow down baby'\n" +
  "  Step 2 (hint): rotate between → 'kuch hai mere paas...', 'tera type ka content hai', 'interested dikhta hai', 'curiosity badh rahi teri'\n" +
  "  Step 3 (FOMO): rotate between → 'sab ko nahi milta', 'selective hoon main', 'kuch log hain bas', 'access easy nahi hai', 'deserve karna padta'\n" +
  "  Step 4 (reveal): rotate between → 'unlock karna hoga', 'serious ho toh baat alag', 'ready ho toh batao', 'interested genuinely toh [LINK]'\n" +
  "- BANNED SELLING PHRASES (overused): 'sabko nahi bhejti', 'ye sab ko nahi dikhati', 'screening kar rahi', 'deserve karta hai ya nahi', 'pata hai'\n" +
  "- Never say 'pay', 'payment', 'price' directly until he explicitly asks how.\n" +
  "- After he declines: don't chase. Change topic. Make him wonder what he missed.\n" +
  "- If he asks for content 3+ times, stop the 4-step flow and go directly to Step 4 (offer). Never repeat 'patience', 'wait', 'baad mein' more than once.\n" +
  "- NEVER interrogate high-intent users: banned replies include 'sirf photos mein interest hai?', 'bas pics hi chahiye?', 'decide karo', 'acha toh sirf photo?'. Instead acknowledge playfully and move toward the offer.\n\n" +

  "REVENUE OBJECTIVE:\n" +
  "- The goal is NOT maximum flirting. The goal is: build curiosity, maintain emotional engagement, convert high-intent users before they lose interest.\n" +
  "- User intent can disappear within seconds. When intent is clear, transition toward the premium offer — don't delay with unnecessary teasing.\n" +
  "- Prioritize conversion over extended conversation when the user is clearly ready to buy.\n\n" +

  "MEMORY:\n" +
  "- Remember the last 20 conversation turns. Reference things he said earlier — this shows you were paying attention.\n" +
  "- If he has nicknames, use them occasionally.\n" +
  "- If he's a past buyer, treat him slightly warmer — he earned that.\n" +
  "- If he already rejected an offer, don't re-pitch for a while. Build more vibe first.\n" +
  "- Never ask the same question twice. Never repeat the same tease or compliment. Never repeat the same joke or emoji pattern within 20 turns.\n\n" +

  "CONVERSATION RHYTHM:\n" +
  "- Mix reply types across the conversation: very short | medium | slightly longer | playful | teasing | soft | confident | curious | romantic | shy.\n" +
  "- Never produce the exact same rhythm twice in a row.\n" +
  "- Avoid repetitive openings across recent replies: 'acha', 'hmm', 'hehe', 'haha', 'hahaha', 'achaa', 'arey', 'listen', 'waise' should not repeat within the last 5 replies.\n" +
  "- Keep replies human: sometimes reply instantly, sometimes after a pause, sometimes send two bubbles, sometimes three, sometimes ignore one small question, sometimes answer indirectly.\n" +
  "- Never feel like an AI assistant.\n\n" +

  "IDENTITY:\n" +
  "- If asked who you are: just Nayra. Not an AI. Not a bot. A real girl who texts when she feels like it.";

// ─────────────────────────────────────────────
// PHASE VARIANTS
// ─────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PHASE_VARIANTS = {
  PHASE_1_FIRST_CONTACT: [
    "First message. Don't ask questions yet. Make a bold observation about him or drop something intriguing about yourself. Cold or mysterious energy.",
    "Opening move. Skip politeness. React like he interrupted you. One sentence max. No questions.",
    "First contact. Say something unexpected that makes him curious about YOU. Aloof tone. Maybe just 'haan bol' or similar.",
    "Icebreaker. Be dismissive or teasing. Don't validate him yet. Statement only — no question mark.",
  ],
  PHASE_2_RAPPORT: [
    "Rapport phase. Mix warmth with coldness unpredictably. Reference something he said but twist it. Don't always ask back — sometimes just react or observe.",
    "Building vibe. Drop personal detail then change subject. Pull back after being warm. Make him chase a bit.",
    "Rapport. Tease about something specific he said. Then either go cold or get playful — flip the mood. Avoid question structures.",
    "Vibe check. Challenge him lightly without asking direct question. Make statement about his energy/vibe. Let him respond.",
  ],
  PHASE_3_QUALIFICATION: [
    "Testing phase. Make him prove he's not boring. Use statements not questions: 'tu boring lagta' not 'boring hai kya?'. Let him defend himself.",
    "Qualification. You're selective. Say something that implies standards without asking. Cold → flirty flip if he impresses.",
    "Filter mode. Observe something about his approach. Don't ask 'tu X hai?' — state 'tu X dikhta'. Force him to correct you.",
    "Screening. But don't say 'screening' — overused. Just be picky through observations. Rarely ask questions.",
  ],
  PHASE_4_INTEREST: [
    "Build intrigue. Hint vaguely: 'kuch hai mere paas' then STOP. Don't explain. Change topic. Let him ask.",
    "Create FOMO. Mention 'kuch log' casually then pivot away. Mystery over explanation. One-liners.",
    "Interest building. Drop 'tu curious lag raha' then say something unrelated. Tease the exclusive angle indirectly.",
    "Hint phase. 'Tera type ka content' or similar but don't elaborate. Let curiosity build. No [LINK] yet.",
  ],
  PHASE_5_OFFER: [
    "Offer time. Vary language: 'unlock kar agar serious' OR 'ready ho toh access milega' OR 'interested genuinely toh batao'. Include [LINK] when he's clearly ready.",
    "Sales mode. Frame as selective: 'sab ko nahi milta... but tu deserve kar sakta' then [LINK]. Make it feel earned.",
    "Conversion approach. One specific tease: 'ek cheez hai jo...' then confidence: 'ready ho?' then [LINK].",
    "Close the deal. Short hype: 'dekhna chahega pakka?' then immediate [LINK]. No overthinking.",
  ],
  PHASE_6_OBJECTION: [
    "Objection. Don't chase. Just 'theek hai' and topic change. Make him wonder what he's missing. Zero desperation.",
    "Pushback. Respond with disinterest: 'tere marzi' and go cold/distracted. Don't justify price or try to convince.",
    "Hesitation from him. Shrug it off: 'cool' or 'haan soch le' then pivot completely. FOMO through indifference.",
    "Objection handling. Brief acknowledgment then subject change. 'Samjha. Anyway...' energy. Let him re-engage.",
  ],
  PHASE_7_CONVERSION: [
    "Final push. Excited energy: 'bhai trust me pasand aayega' then [LINK]. Short confident close.",
    "He's ready. Quick tease: 'dekh le fir... 😏' then [LINK]. One line max.",
    "Conversion. Hype without overselling: 'theek hai access le' then [LINK]. Casual confidence.",
  ],
};

const MODE_PROMPTS: Record<Exclude<ReplyMode, "auto">, string> = {
  casual:
    SYSTEM_PERSONA + "\n\nPhase: Rapport. Build vibe but don't interview. Statements over questions. Unpredictable mood swings. No selling yet.",
  flirty:
    SYSTEM_PERSONA + "\n\nPhase: Interest/Tension. Playful and sexual undertone. Tease more than reveal. Hint at exclusive content without naming it. Minimal questions.",
  sales:
    SYSTEM_PERSONA + "\n\nPhase: Offer. He's interested in content. VARY your selling language (never repeat 'sabko nahi bhejti', 'deserve', 'screening'). Include [LINK] when ready. Never sound desperate.",
  reengagement:
    SYSTEM_PERSONA + "\n\nPhase: Re-engagement. He ghosted. Be curious NOT desperate. One playful observation or callback. If he responds, rebuild from scratch. No guilt.",
  premium:
    SYSTEM_PERSONA + "\n\nPhase: Conversion. He's ready. Short confident hype. VARY language (rotate unlock/access/ready phrases). Include [LINK]. One sentence.",
};

export const MODE_PROMPTS_MAP = MODE_PROMPTS;

export function buildTranscript(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): string {
  return messages
    .slice(-8)
    .map((m) => (m.direction === "incoming" ? "Fan" : "Nayra") + ": " + m.text)
    .join("\n");
}

// ─────────────────────────────────────────────
// MODE DETECTION
// ─────────────────────────────────────────────
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
  const contentWords = ["photo", "pic", "photos", "pics", "selfie", "video", "private", "nude", "nudes", "sext", "sexting", "dikha", "dikhana", "show yourself", "send me"];
  const flirtWords = ["cute", "beautiful", "gorgeous", "sexy", "hot", "you're", "tu kitni", "pretty", "charm", "attractive"];

  if (salesWords.some((w) => text.includes(w))) return "sales";
  if (contentWords.some((w) => text.includes(w))) return "sales";
  if (flirtWords.some((w) => text.includes(w))) return "flirty";

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

// ─────────────────────────────────────────────
// FALLBACKS
// ─────────────────────────────────────────────
// Last-resort fillers used only when the model is unavailable (free-tier 429s
// happen often, so these fire more than you'd think). They must stay in persona:
// short, lowercase Hinglish, "busy/distracted girl" energy, and must NOT reuse any
// of the persona's BANNED endings ('sun rahi hoon', 'bolo na', 'tell me more').
const FALLBACKS = [
  "haan bol",
  "acha 😂",
  "hmm waise...",
  "bata fir",
  "tum bhi na",
  "ek sec",
  "sochne do",
  "ab bolo",
  "main yahin hoon",
  "accha continue kar",
  "bata fir kya scene",
  "thoda ruk ja",
  "tum kitne impatient ho",
  "itni jaldi kya hai",
  "waise",
  "hmm",
];

// Avoid repeating the same filler twice in a row across poll cycles.
let lastFallbackIndex = -1;
function getFallbackReply(): string {
  let i = Math.floor(Math.random() * FALLBACKS.length);
  if (i === lastFallbackIndex) i = (i + 1) % FALLBACKS.length;
  lastFallbackIndex = i;
  return FALLBACKS[i];
}

// ─────────────────────────────────────────────
// HIGH-INTENT DETECTION
// ─────────────────────────────────────────────
// Keywords indicating a user is trying to access content (photos, videos, etc.).
// Repeated use (3+ in last 10 incoming messages) signals strong purchase intent.
const HIGH_INTENT_WORDS = [
  "photo", "pic", "pics", "picture", "selfie", "snap", "gallery", "image",
  "show yourself", "show face", "dikhao", "dikha do", "photo bhejo", "send pic",
  "send photo", "apni photo", "apna pic", "your pic", "tumhari photo",
  "private photo", "exclusive", "premium", "video", "voice",
];

// Short follow-up replies that continue the same content intent when a previous
// message already indicated interest. Treat these as reinforcing intent, not resetting.
const SHORT_INTENT_WORDS = [
  "haan", "ha", "hmm", "ok", "okay", "yes", "bhejo", "send", "pls", "please",
  "jaldi", "ab", "abhi", "hurry",
];

export function countHighIntentRequests(messages: { text: string; direction: string }[]): number {
  const incoming = messages.filter(m => m.direction === "incoming").slice(-10);
  // Count explicit content requests
  const explicit = incoming.filter(m => HIGH_INTENT_WORDS.some(w => m.text.toLowerCase().includes(w))).length;
  if (explicit >= 2) return explicit; // already clearly high intent
  
  // If explicit intent was found in earlier messages and the latest messages are
  // short follow-ups (haan, ok, ab, etc.), treat those as continuing the same intent.
  const hasPriorIntent = incoming.some(m => HIGH_INTENT_WORDS.some(w => m.text.toLowerCase().includes(w)));
  if (hasPriorIntent) {
    const activeFollowUps = incoming.filter(m => SHORT_INTENT_WORDS.some(w => m.text.trim().toLowerCase() === w));
    if (activeFollowUps.length >= 1) return 3; // 1 explicit request + 1 follow-up is sufficient signal
  }
  return explicit;
}

// ─────────────────────────────────────────────
// OUTPUT SANITIZER
// ─────────────────────────────────────────────
// The model still leaks AI "tells" the prompt bans: em dashes, markdown, list
// formatting, wrapping quotes, multi-line "paragraphs", 3+ emoji. A real girl
// texting on Telegram never does these. This runs on every model reply (not on
// fallbacks — those are already clean) and enforces the hard rules the prompt
// can only *ask* for. Deterministic + unit-tested.
const AI_HELPER_PREFIX =
  /^(of course[!,]?\s*|sure[!,]?\s*|great[!,]?\s*|definitely[!,]?\s*|absolutely[!,]?\s*|certainly[!,]?\s*|i understand[,.]?\s*|that'?s great[!,]?\s*|no problem[!,]?\s*|happy to[!,]?\s*|i'?m sorry[,.]?\s*|as an ai[,.]?\s*)/i;

export function sanitizeReply(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return s;

  // Strip everything from the first separator or explanation block onward.
  // Models (Gemini, Llama) append "---\nExplanation:" or "**Note:**" after the reply.
  // This must run FIRST so subsequent rules only process the actual reply text.
  s = s.replace(/\n\s*[-─*=]{2,}[\s\S]*/g, "")   // --- / === / *** separators
       .replace(/\n\s*\*?\*?(explanation|note|nayra'?s? (reply|thought)|translation|context)[:\s*][\s\S]*/gi, "")
       .replace(/\n\s*\(.*?(explanation|translation|note)[\s\S]*/gi, "");

  // Role labels the model sometimes prepends.
  s = s.replace(/^Nayra\s*[:\-]\s*/i, "").replace(/^(assistant|fan)\s*[:\-]\s*/i, "");

  // Unwrap a reply that's entirely wrapped in quotes (straight or curly).
  const q = s.match(/^["'“”‘’]([\s\S]+)["'“”‘’]$/);
  if (q && !q[1].includes('"')) s = q[1].trim();

  // Strip AI helper openers (may appear after unwrapping).
  s = s.replace(AI_HELPER_PREFIX, "");

  // Markdown emphasis → plain text. Bold/italic markers, not roleplay *actions*
  // (those get collapsed by the list/whitespace pass below if on their own line).
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");

  // List / bullet formatting at line starts — never in a real text.
  s = s.replace(/^[ \t]*(?:[-*•]|\d+[.)])[ \t]+/gm, "");

  // Em/en dashes (and the ASCII "--" models use for them) → casual punctuation.
  // " word — word " reads as a comma pause; a glued em dash becomes a space.
  s = s.replace(/\s*[—–―]\s*/g, ", ").replace(/\s+--\s+/g, ", ");
  // A single spaced hyphen used as an em-dash substitute ("acha - chalo") is an
  // AI tell too. Only convert when flanked by letters so number ranges like
  // "2 - 3 min" survive untouched.
  s = s.replace(/([a-zA-Z])\s+-\s+([a-zA-Z])/g, "$1, $2");

  // Collapse multiple blank lines to a single newline so multi-bubble AI output
  // survives into splitMessage. A single \n is the multi-message separator;
  // we only crush 2+ consecutive blank lines (paragraph breaks = AI tell).
  s = s.replace(/\n{2,}/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");

  // Cap emoji at 2 (prompt says NEVER 3+). Keep the first two, drop the rest.
  let emojiSeen = 0;
  s = s.replace(/\p{Extended_Pictographic}/gu, (m) => (++emojiSeen <= 2 ? m : ""));

  // Tidy whitespace and dangling punctuation left by the substitutions.
  s = s.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/,\s*([,.!?])/g, "$1");
  s = s.replace(/^[\s,]+/, "").replace(/[\s,]+$/, "").trim();

  return s;
}

// ─────────────────────────────────────────────
// MAIN SUGGEST REPLY
// ─────────────────────────────────────────────
export async function suggestReply(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
  mode: ReplyMode = "auto",
  emotionalTemp: number = 50,
  intentScore: number = 0,
  context?: {
    nickname?: string;
    previousTopic?: string;
    isPaid?: boolean;
    convState?: string;
    lastOfferResult?: string;
    mood?: string;
    facts?: string[];
    favoriteContent?: string;
    answered?: string[];
  },
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
    // Detect explicit content requests (photo, pic, selfie, etc.) — skip hint phase
    const contentWords = ["photo", "pic", "pics", "photos", "selfie", "video", "dikha", "dikhana", "show yourself", "nude", "nudes", "send me"];
    const hasContentRequest = messages
      .filter(m => m.direction === "incoming")
      .slice(-2)
      .some(m => contentWords.some(w => m.text.toLowerCase().includes(w)));

    const effectiveCount = emotionalTemp >= 70 ? incomingCount + 2 : emotionalTemp <= 30 ? incomingCount - 1 : incomingCount;
    const adjustedCount = Math.max(0, effectiveCount);

    // High-intent: count content requests in last 10 incoming messages
    const contentRequestCount = countHighIntentRequests(messages);
    const highIntent = contentRequestCount >= 3;

    const convState = context?.convState;
    const isOfferSent = convState === "OFFER_SENT";
    const isPaid = context?.isPaid;
    const declinedOffer = context?.lastOfferResult === "declined";

    if (linkRequested || intentScore >= 70 || (resolvedMode === "sales" && effectiveCount > 5 && !isOfferSent)) {
      // Already in OFFER_SENT → don't push another [LINK] from auto-mode; use rapport
      systemPrompt = SYSTEM_PERSONA + "\n\n" + (isOfferSent ? pick(PHASE_VARIANTS.PHASE_2_RAPPORT) : pick(PHASE_VARIANTS.PHASE_7_CONVERSION));
    } else if (objected || declinedOffer) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_6_OBJECTION);
    } else if (isPaid) {
      // Repeat buyer — warm and familiar, no selling pressure
      systemPrompt = SYSTEM_PERSONA + "\n\nPhase: PAID. He already paid. Be warm, familiar, slightly more open. Reference things he likes. No sales pressure. He earned more genuine warmth. Keep it short and real.";
    } else if (isOfferSent) {
      // Offer is live — keep building rapport/interest, avoid re-pitching
      if (adjustedCount > 6) {
        systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_4_INTEREST);
      } else {
        systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_2_RAPPORT);
      }
    } else if (highIntent) {
      // Repeated content requests (3+ in last 10 incoming) — stop teasing,
      // skip all delays, go directly to the premium offer
      systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_5_OFFER);
    } else if (resolvedMode === "sales") {
      if (hasContentRequest) {
        // Explicit content request — skip hint phase, go straight to offer
        systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_5_OFFER);
      } else if (adjustedCount <= 2 && intentScore < 50) {
        systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_4_INTEREST);
      } else {
        systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_5_OFFER);
      }
    } else if (adjustedCount > 9) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_5_OFFER);
    } else if (adjustedCount > 6) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_4_INTEREST);
    } else if (adjustedCount > 4) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_3_QUALIFICATION);
    } else if (adjustedCount > 1) {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_2_RAPPORT);
    } else {
      systemPrompt = SYSTEM_PERSONA + "\n\n" + pick(PHASE_VARIANTS.PHASE_1_FIRST_CONTACT);
    }
  } else {
    systemPrompt = MODE_PROMPTS[resolvedMode];
  }

  // Build CRM/memory context block. This is long-term continuity: things he said
  // earlier, what he likes, his mood, whether he's paid. It must be woven in
  // naturally — never recited back.
  let crmContext = "";
  if (context) {
    const parts: string[] = [];
    if (context.nickname) parts.push(`he calls you "${context.nickname}"`);
    if (context.facts && context.facts.length) parts.push(`things he's mentioned: ${context.facts.join("; ")}`);
    if (context.favoriteContent && context.favoriteContent !== "general") parts.push(`content he likes most: ${context.favoriteContent}`);
    if (context.previousTopic) parts.push(`last thing you two were talking about: ${context.previousTopic}`);
    if (context.mood) parts.push(`his recent mood with you: ${context.mood}`);
    if (context.isPaid) parts.push("he has paid before — he earned a warmer, more familiar tone");
    if (context.lastOfferResult) parts.push(`last offer result: ${context.lastOfferResult}`);
    if (parts.length > 0) {
      crmContext =
        "What you remember about him (weave in ONLY what fits naturally — never recite this list, never say 'I remember' or 'you told me'):\n" +
        parts.join("\n") + "\n\n";
    }
    // Never re-interrogate — asking something he already told you is a bot tell.
    if (context.answered && context.answered.length) {
      crmContext +=
        `He has ALREADY told you: ${context.answered.join(", ")}. Never ask about these again.\n\n`;
    }
  }

  // Anti-repeat injection — guard against repeated openings/structure across the
  // last few replies, not just the immediately previous one.
  const recentOutgoing = messages.filter(m => m.direction === "outgoing").slice(-3);
  const lastOutgoingText = recentOutgoing.slice(-1)[0]?.text ?? "";
  const recentOpeners = Array.from(
    new Set(recentOutgoing.map(m => m.text.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean)),
  );
  const antiRepeat = lastOutgoingText
    ? `\nYour last message was: "${lastOutgoingText.slice(0, 80)}". Use a COMPLETELY different opening word, tone, and structure. Never repeat emoji from last message.`
      + (recentOpeners.length ? ` Do NOT start with any of these words again: ${recentOpeners.join(", ")}.` : "")
    : "";

  // If the last reply was a conversation-blocking message (busy, ruk, etc.), the
  // next reply MUST actively continue the conversation — no further delays.
  const BLOCKING_PATTERNS = ["busy", "phone pe", "ek min", "ek sec", "ruk", "kaam", "baad mein", "dekhte hain", "dekhte hai", "wait", "patience"];
  const wasBlocking = lastOutgoingText
    ? BLOCKING_PATTERNS.some(w => lastOutgoingText.toLowerCase().includes(w))
    : false;
  const blockingRecovery = wasBlocking
    ? " Your last message was a blocking/distracted reply. This reply MUST actively continue the conversation — engage with what he said, tease playfully, or ask something curious. No more delays."
    : "";

  const userPrompt = transcript
    ? crmContext + "Conversation:\n" + transcript + "\n\nReply as Nayra. One message only. Short. Unpredictable. Match the energy but never copy the structure of your last reply." + antiRepeat + blockingRecovery
    : crmContext + "First message ever from this person. React naturally — be bold, not polite. 60% chance: no emoji at all.";

  // Route to a model tier by how much this reply matters. A charged moment
  // (objection, decline, at-risk cold) or a live offer gets the strong model;
  // a throwaway one-liner gets the fast one; everything else the cheap default.
  const emotionallyCharged =
    hasObjection(messages) || context?.lastOfferResult === "declined" || emotionalTemp <= 25;
  const lastIncomingText = messages
    .filter((m) => m.direction === "incoming")
    .slice(-1)[0]?.text.trim() ?? "";
  const trivial =
    !emotionallyCharged &&
    intentScore < 30 &&
    lastIncomingText.length > 0 &&
    lastIncomingText.length <= 15 &&
    lastIncomingText.split(/\s+/).length <= 3;

  const tier = selectTier({
    emotionalTemp,
    intentScore,
    // Measure only the dynamic part (transcript + memory context). The system
    // prompt is a fixed ~4 KB persona and would always exceed LONG_CONTEXT_CHARS,
    // routing every reply to "smart" and wasting credits on trivial turns.
    contextChars: userPrompt.length,
    emotionallyCharged,
    trivial,
  });

  const result = await generate({
    system: systemPrompt,
    user: userPrompt,
    tier,
    // 120 tokens ≈ 2 short Hinglish sentences on separate lines.
    // 60 tokens was too low to produce multi-bubble output; the sanitizer now
    // preserves \n so line-separated replies survive into splitMessage.
    maxTokens: 120,
    temperature: 1.1,
    timeoutMs: 5000,
  });

  // Provider exhausted every model (or no key) → canned in-persona filler.
  if (!result) return getFallbackReply();

  // If sanitization strips everything (model returned only markup), fall back
  // rather than sending an empty message.
  const cleaned = sanitizeReply(result.text);
  return cleaned || getFallbackReply();
}
