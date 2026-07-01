// ─────────────────────────────────────────────
// CONVERSATION MEMORY
// ─────────────────────────────────────────────
// Long-term continuity for Nayra. The transcript only carries the last ~12
// messages, so facts a fan mentioned early ("I'm from Delhi", "gym jata hoon",
// he calls her "jaan") would otherwise be forgotten. This module extracts a few
// HIGH-PRECISION stable facts from the full history so they can be woven into
// replies naturally. Precision is deliberately favoured over recall — feeding a
// wrong "memory" makes Nayra say something off, which is worse than remembering
// nothing. No storage/migration: extraction runs on the already-fetched history.

export interface ContactMemory {
  /** Short natural facts, e.g. "from Delhi", "into the gym". Max ~5. */
  facts: string[];
  /** What he calls her, e.g. "jaan" — only if he's used it more than once. */
  nickname?: string;
  /**
   * Human labels for topics he has ALREADY answered, e.g. "his name",
   * "where he's from". Fed to the reply engine so Nayra never re-asks a
   * question he's already answered (a common bot tell). Precision-first: only
   * populated for the same high-confidence facts above.
   */
  answered: string[];
}

// Question-topics we can detect with high confidence → readable label used to
// tell the model "don't ask about this again". Keyed by the internal fact key.
const ANSWERED_LABELS: Record<string, string> = {
  name: "his name",
  city: "where he's from",
  work: "what he does for work/study",
  interest: "his main hobby",
};

type Msg = { text: string; direction: "incoming" | "outgoing" };

const CITIES = [
  "mumbai", "bombay", "delhi", "noida", "gurgaon", "gurugram", "bangalore",
  "bengaluru", "hyderabad", "chennai", "kolkata", "pune", "jaipur", "ahmedabad",
  "lucknow", "indore", "nagpur", "bhopal", "patna", "chandigarh", "goa", "kanpur",
  "surat", "kochi", "ranchi", "guwahati", "dehradun", "vizag", "coimbatore",
];

const ENDEARMENTS = [
  "jaan", "jaanu", "jaaneman", "baby", "babe", "babu", "sweetheart", "cutie",
  "darling", "sweetu", "shona", "gudiya", "jaana",
];

// [pattern, fact] — first match per category wins. Patterns are intentionally
// narrow so a passing mention doesn't get logged as a hard fact.
const WORK_STUDY: [RegExp, string][] = [
  [/\b(engineer|engineering)\b/, "into engineering"],
  [/\b(doctor|mbbs|medical student)\b/, "in medicine"],
  [/\b(mba|chartered|\bca\b)\b/, "doing MBA/CA"],
  [/\b(army|fauji|navy|air ?force)\b/, "in the forces"],
  [/\b(developer|software|coder|coding|programmer)\b/, "in software/IT"],
  [/\b(businessman|business|dukaan|shop owner)\b/, "runs a business"],
  [/\b(college|university|hostel|padhai|padhta|student)\b/, "a student"],
];

const INTERESTS: [RegExp, string][] = [
  [/\bgym\b|workout|fitness|protein|lifting/, "into the gym"],
  [/cricket|\bipl\b/, "loves cricket"],
  [/football|soccer/, "into football"],
  [/gaming|pubg|bgmi|valorant|gamer/, "a gamer"],
  [/guitar|singing|gaana gaata/, "into music"],
  [/\bbike\b|royal enfield|bullet|riding/, "a bike guy"],
  [/movies|netflix|web series/, "into movies/series"],
];

const FROM_CONTEXT = /(se hoon|se hu|se belong|from|rehta|rehti|rehte|live in|living in|mein rehta|me rehta|stay in)/;

// Name self-introduction — deliberately narrow phrasings so a passing word
// isn't mistaken for a name. Capture group 1 is the candidate name.
const NAME_PATTERNS: RegExp[] = [
  /\bmera naam ([a-z]{2,15})\b/,
  /\bmy name is ([a-z]{2,15})\b/,
  /\bmyself ([a-z]{2,15})\b/,
  /\bnaam ([a-z]{2,15}) hai\b/,
  /\bi am ([a-z]{2,15})(?:\s+here)?\b(?!\s)/,
  /\bthis is ([a-z]{2,15})\s+(?:here|btw)\b/,
];
// Words that fit the name slot grammatically but are never names.
const NAME_STOPWORDS = new Set([
  "busy", "here", "good", "fine", "from", "not", "the", "sorry", "back",
  "still", "just", "really", "your", "single", "waiting", "bored", "free",
  "ready", "sure", "okay", "happy", "sad", "tired", "new", "old", "big",
]);

// Fan repeatedly asking to see visual content — a memory signal that also tells
// the offer flow he's warmed up (see suggest-reply selling rules).
const CONTENT_REQUEST = /\b(photo|photos|pic|pics|pic|selfie|video|videos|nude|nudes|dikha|dikhao|bhej|bhejo|send.*(pic|photo|video)|show.*(pic|photo|video))\b/;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Extract stable, high-confidence facts about the fan from the full message
 * history. Returns at most one fact per category to keep the memory block tight.
 */
export function extractMemory(messages: Msg[]): ContactMemory {
  const incoming = messages.filter((m) => m.direction === "incoming").map((m) => m.text.toLowerCase());
  const found = new Map<string, string>();
  const endearmentCounts = new Map<string, number>();
  let contentRequests = 0;

  for (const t of incoming) {
    // His name — first confident self-introduction wins.
    if (!found.has("name")) {
      for (const re of NAME_PATTERNS) {
        const m = t.match(re);
        if (m && m[1] && !NAME_STOPWORDS.has(m[1])) {
          found.set("name", `his name is ${capitalize(m[1])}`);
          break;
        }
      }
    }
    // Count how often he's asked to see content.
    if (CONTENT_REQUEST.test(t)) contentRequests++;

    // City — require a "from/live/rehta" cue near a known city to avoid false hits.
    if (!found.has("city") && FROM_CONTEXT.test(t)) {
      const city = CITIES.find((c) => new RegExp(`\\b${c}\\b`).test(t));
      if (city) found.set("city", `from ${capitalize(city === "bombay" ? "mumbai" : city)}`);
    }
    // Work / study
    if (!found.has("work")) {
      for (const [re, fact] of WORK_STUDY) {
        if (re.test(t)) { found.set("work", fact); break; }
      }
    }
    // Interest / hobby
    if (!found.has("interest")) {
      for (const [re, fact] of INTERESTS) {
        if (re.test(t)) { found.set("interest", fact); break; }
      }
    }
    // What he calls her — count endearments (require >1 use to treat as a nickname).
    for (const e of ENDEARMENTS) {
      if (new RegExp(`\\b${e}\\b`).test(t)) {
        endearmentCounts.set(e, (endearmentCounts.get(e) ?? 0) + 1);
      }
    }
  }

  let nickname: string | undefined;
  let best = 1; // strictly more than one use
  for (const [e, n] of endearmentCounts) {
    if (n > best) { best = n; nickname = e; }
  }

  // Topics he's already answered — so Nayra never re-interrogates him. Built
  // BEFORE the content_want signal (which isn't a question topic) is added.
  const answered = Object.keys(ANSWERED_LABELS)
    .filter((k) => found.has(k))
    .map((k) => ANSWERED_LABELS[k]);

  // Repeated content requests (>=2) are a strong warmed-up signal worth recalling.
  if (contentRequests >= 2) {
    found.set("content_want", "he keeps asking to see your pics/videos");
  }

  return { facts: Array.from(found.values()), nickname, answered };
}

/** Natural-language label for the fan's recent mood, derived from emotional temp. */
export function moodLabel(emotionalTemp: number): string {
  if (emotionalTemp >= 75) return "really into you right now, flirty";
  if (emotionalTemp >= 60) return "warm and engaged";
  if (emotionalTemp >= 40) return "casual / neutral";
  if (emotionalTemp >= 25) return "a little distant lately";
  return "cold and disengaged";
}
