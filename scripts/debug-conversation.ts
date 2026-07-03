/**
 * debug-conversation.ts
 *
 * Runs the REAL production pipeline locally — no Telegram, no Vercel, no polling.
 * Reuses production code directly; zero duplicated business logic.
 *
 * Usage:
 *   npm run debug:conversation
 *   npm run debug:conversation -- "Hi" "Photo bhejo" "Mujhe abhi chahiye" "I'll pay"
 *
 * If no CLI args are given, the default conversation above is used.
 */

import "dotenv/config";

// ─── Path alias shim (tsconfig maps @/* → ./*) ───────────────────────────────
// tsx honours the tsconfig paths, so imports below work as-is.

import { suggestReply, detectMode, countHighIntentRequests, sanitizeReply } from "@/lib/ai/suggest-reply";
import { MESSAGE, TIMING, INTENT_THRESHOLD } from "@/src/lib/telegram/constants";

// getIntentScore lives in lib/db/service.ts — import only that function.
import { getIntentScore } from "@/lib/db/service";

// splitMessage is not exported; reproduce the production logic inline so we
// can show the exact split result without touching production code structure.
function splitMessage(text: string): string[] {
  if (text.includes("\n")) {
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length >= 2) return lines.slice(0, 4);
  }
  if (Math.random() < MESSAGE.SPLIT_CHANCE) return [text]; // ~30% stay single
  if (text.length <= MESSAGE.SHORT_MESSAGE_LENGTH) return [text];
  const parts = text.match(/[^.!?…]+[.!?…]*/g);
  if (parts && parts.length > 1) {
    const cleaned = parts.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length > 4) {
      const mid = Math.ceil(cleaned.length / 2);
      return [cleaned.slice(0, mid).join(" "), cleaned.slice(mid).join(" ")];
    }
    return cleaned;
  }
  // Hinglish midpoint fallback
  const mid = Math.floor(text.length / 2);
  const before = text.lastIndexOf(" ", mid);
  const after = text.indexOf(" ", mid);
  const splitAt = before > 0 ? before : after;
  if (splitAt < 1 || splitAt >= text.length - 1) return [text];
  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
}

function typingDelayMs(text: string): number {
  return Math.min(3000, Math.max(600, Math.round(text.length * 20)));
}

// ─── Separator helper ─────────────────────────────────────────────────────────
const SEP = "─".repeat(60);
function section(title: string) { console.log(`\n${SEP}\n  ${title}\n${SEP}`); }
function row(label: string, value: unknown) {
  const v = typeof value === "object" ? JSON.stringify(value) : String(value);
  console.log(`  ${label.padEnd(28)} ${v}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const cliArgs = process.argv.slice(2);
  const userTexts: string[] = cliArgs.length > 0
    ? cliArgs
    : ["Hi", "Photo bhejo", "Mujhe abhi chahiye", "I'll pay"];

  // Build message history as the DB would contain it at the time of the LAST poll
  const allMessages: { text: string; direction: "incoming" | "outgoing" }[] =
    userTexts.map((text) => ({ text, direction: "incoming" }));

  // incomingMessages for the current poll = all user messages
  // (in real polling each message may arrive in a separate poll; debug shows
  //  the worst case where they all arrive together — and per-poll isolation too)
  const incomingMessages = allMessages.filter((m) => m.direction === "incoming");
  const recent = allMessages.slice(-20);

  // ── Conversation input ────────────────────────────────────────────────────
  section("CONVERSATION INPUT");
  allMessages.forEach((m, i) => console.log(`  [${i + 1}] ${m.direction === "incoming" ? "User" : "Nayra"}: ${m.text}`));

  // ── Intent score ─────────────────────────────────────────────────────────
  section("INTENT SCORE");
  const intentScore = await getIntentScore(incomingMessages);
  row("intentScore", intentScore);
  row("HIGH threshold", INTENT_THRESHOLD.HIGH);
  row("VERY_LOW threshold", INTENT_THRESHOLD.VERY_LOW);
  row("intentScore >= HIGH", intentScore >= INTENT_THRESHOLD.HIGH);

  // ── detectMode + highIntent ───────────────────────────────────────────────
  section("MODE DETECTION");
  const emotionalTemp = 50; // default; no DB in debug mode
  const aiMode = detectMode(recent, emotionalTemp);
  row("detectMode() result", aiMode);

  const contentRequestCount = countHighIntentRequests(allMessages);
  row("countHighIntentRequests", contentRequestCount);
  row("highIntent (>= 3)", contentRequestCount >= 3);

  // directOfferSignal — mirrors the production gate added in the offer-trigger fix
  const inCooldown = false; // cannot query DB in dry-run mode; assume not in cooldown
  const directOfferSignal = aiMode === "sales" && !inCooldown;
  row("directOfferSignal", directOfferSignal);

  // ── Offer gate ────────────────────────────────────────────────────────────
  section("OFFER GATE  (conv_state = FREE_CHAT)");
  const offerTrigger = (intentScore >= INTENT_THRESHOLD.HIGH || directOfferSignal) && !inCooldown;
  row("sendPremiumOffer triggered", offerTrigger);
  if (offerTrigger) {
    row("→ offerSent", true);
    row("→ payment link", "[would be generated via Razorpay]");
    row("→ conv_state after", "OFFER_SENT");
  } else {
    row("→ falls to sendAiReply()", true);
    row("→ offerSent depends on AI outputting [LINK]", true);
  }

  // ── AI reply ─────────────────────────────────────────────────────────────
  section("AI REPLY  (suggestReply)");

  if (!process.env.OPENROUTER_API_KEY) {
    console.log("  ⚠️  OPENROUTER_API_KEY not set — skipping live AI call.");
    console.log("  Set it in .env.local to test the full pipeline.");
  } else {
    let rawReply: string | null = null;
    try {
      rawReply = await suggestReply(recent, "auto", emotionalTemp, intentScore, {
        convState: "FREE_CHAT",
        isPaid: false,
      });
    } catch (e) {
      console.log("  AI call failed:", e instanceof Error ? e.message : String(e));
    }

    if (rawReply) {
      row("raw AI output", rawReply);
      const cleaned = sanitizeReply(rawReply);
      row("after sanitizeReply", cleaned);
      row("[LINK] in reply", /\[link\]/i.test(cleaned));
      row("offerSent via AI", /\[link\]/i.test(cleaned));

      // ── Split result ────────────────────────────────────────────────────
      section("SPLIT RESULT  (splitMessage)");
      row("text length", cleaned.length);
      row("SHORT_MESSAGE_LENGTH", MESSAGE.SHORT_MESSAGE_LENGTH);
      row("SPLIT_CHANCE", MESSAGE.SPLIT_CHANCE);
      row("contains \\n", cleaned.includes("\n"));

      const bubbles = splitMessage(cleaned);
      row("bubble count", bubbles.length);
      bubbles.forEach((b, i) => row(`Bubble ${i + 1}`, b));

      // ── Typing delays ───────────────────────────────────────────────────
      section("TYPING DELAYS");
      bubbles.forEach((b, i) => {
        const delay = typingDelayMs(b);
        row(`Bubble ${i + 1} typing delay`, `${delay}ms  (${b.length} chars × 20ms, clamped 600–3000)`);
        if (i > 0) row(`  + inter-bubble gap`, `${TIMING.MULTI_MESSAGE_GAP_MIN}–${TIMING.MULTI_MESSAGE_GAP_MAX}ms random`);
      });

      // ── Final Telegram payload ──────────────────────────────────────────
      section("FINAL TELEGRAM PAYLOAD");
      bubbles.forEach((b, i) => console.log(`  sendMessage(${i + 1}): "${b}"`));
    }
  }

  section("DONE");
  console.log("");
}

main().catch((e) => {
  console.error("debug-conversation error:", e);
  process.exit(1);
});
