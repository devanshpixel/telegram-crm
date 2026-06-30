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
}

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

  for (const t of incoming) {
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

  return { facts: Array.from(found.values()), nickname };
}

/** Natural-language label for the fan's recent mood, derived from emotional temp. */
export function moodLabel(emotionalTemp: number): string {
  if (emotionalTemp >= 75) return "really into you right now, flirty";
  if (emotionalTemp >= 60) return "warm and engaged";
  if (emotionalTemp >= 40) return "casual / neutral";
  if (emotionalTemp >= 25) return "a little distant lately";
  return "cold and disengaged";
}
