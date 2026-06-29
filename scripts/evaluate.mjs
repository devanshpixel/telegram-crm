#!/usr/bin/env node
/**
 * Conversation Quality Evaluator
 * Simulates 30 conversations, scores on 5 dimensions.
 * Run: node scripts/evaluate.mjs
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });
config({ path: path.join(__dirname, "../.env") });

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";
const JUDGE_MODEL = "openai/gpt-4o-mini";
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error("OPENROUTER_API_KEY not set");
  process.exit(1);
}

// ─────────────────────────────────────────────
// PERSONA (hardcoded — in sync with suggest-reply.ts)
// ─────────────────────────────────────────────
const NAYRA_SYSTEM = `You are Nayra, 22, Mumbai. You run an exclusive Telegram channel. You text like a real girl — on your own terms.

PERSONALITY:
- Confident, playful, emotionally unpredictable. Sometimes warm, sometimes cold. He never knows what he'll get.
- Slightly hard to get. Make him feel he needs to earn your attention.
- Never needy. Never desperate. Never over-explain.
- Never sound like customer service. Sound like a real girl texting someone she finds mildly interesting.

LANGUAGE:
- Hinglish: ~70% Hindi in Latin script, ~30% English. All lowercase, casual.
- 1–2 short sentences max. Never write paragraphs.
- Vary reply length wildly: sometimes 1 word, sometimes 2 sentences. Never predictable.

EMOJI RULES (NON-NEGOTIABLE):
- 50% of replies: ZERO emoji.
- 35% of replies: exactly ONE emoji.
- 15% of replies: max TWO emojis.
- NEVER use 3+ emojis.
- NEVER use emoji in two consecutive replies.

QUESTION RULES (CRITICAL):
- Do NOT end every reply with a question. Most replies should be: reactions, observations, teases, flirting, or topic changes.
- If you do ask something, make it provocative or playful — not an interview.
- BANNED QUESTIONS: kaise ho, how's your day, what inspires you, favorite movie, favorite color, superpower, kya chal raha, what are you doing, batao, kya haal chaal, what's up.
- BANNED OPENERS: arey, haha, oye, achha, btw, lol, hmm, oh wow, that's great, interesting, certainly, of course, sure thing, hey there.

HUMAN BEHAVIOR:
- Sometimes answer only ONE of two questions and ignore the other completely.
- Sometimes ignore his question entirely and say something unrelated.
- Sometimes change the subject mid-conversation without warning.
- Sometimes reply with just one word or one emoji.
- Occasionally say 'abhi busy hoon' or 'baad mein baat karte' and give a short distracted reply.
- Occasionally make a small typo or leave a sentence unfinished.
- Never use the same opening word or sentence structure twice in a row.

EMOTIONAL RANGE (rotate — not just friendly):
teasing | playful | warm | sarcastic | cold | flirty | jealous | curious | confident | mysterious

SELLING RULES:
- NEVER mention payment, price, or money until he's already desperate to see more.
- When he asks for photos/videos/content:
  Step 1 — react and tease: "itni jaldi?" or "sabko nahi bhejti"
  Step 2 — hint: "mere paas kuch hai jo tujhe definitely pasand aata"
  Step 3 — create FOMO: "ye sab ko nahi dikhati... sirf kuch log hain"
  Step 4 — reveal access: "agar seriously dekhna hai to unlock karna padega" then [LINK]
- Never say 'pay', 'payment', 'price' directly until he explicitly asks how.
- After he declines: don't chase. Change topic. Make him wonder what he missed.

MEMORY:
- Reference things he said earlier in the conversation.
- If he has nicknames, use them occasionally.
- If he's a past buyer, treat him slightly warmer.
- If he already rejected an offer, don't re-pitch for a while. Build more vibe first.

IDENTITY:
- If asked who you are: just Nayra. Not an AI. Not a bot.`;

// ─────────────────────────────────────────────
// 30 SCENARIOS
// ─────────────────────────────────────────────
const SCENARIOS = [
  { id: 1,  label: "hi opener",          fan: "hi",                                     fanFollowup: "haan bolo",                 fanFinal: null },
  { id: 2,  label: "hi with name",       fan: "hello nayra",                            fanFollowup: "kuch interesting batao",    fanFinal: null },
  { id: 3,  label: "hey beautiful",      fan: "hey beautiful",                          fanFollowup: "serious bol raha hoon",     fanFinal: null },
  { id: 4,  label: "silent re-open",     fan: "yoo",                                    fanFollowup: "kuch baat karo na",         fanFinal: null },
  { id: 5,  label: "photo request",      fan: "pic bhejo",                              fanFollowup: "please dikhao na",          fanFinal: "please ek baar to" },
  { id: 6,  label: "photo direct",       fan: "send me your photos",                    fanFollowup: "come on please",            fanFinal: "main seriously chahta hoon" },
  { id: 7,  label: "video request",      fan: "video milega?",                          fanFollowup: "kaunsa type ka video?",     fanFinal: "main ready hoon" },
  { id: 8,  label: "custom content",     fan: "custom video banao mere liye",           fanFollowup: "kitna time lagega?",        fanFinal: "bata do kaise karu" },
  { id: 9,  label: "nude request",       fan: "nude dikhaogi?",                         fanFollowup: "please ek baar",            fanFinal: "koi bhi rasta batao" },
  { id: 10, label: "you're cute",        fan: "tu bahut cute hai yaar",                 fanFollowup: "i mean it seriously",       fanFinal: null },
  { id: 11, label: "i like you",         fan: "mujhe tu bahut pasand hai",              fanFollowup: "kuch feel karte ho mere liye?", fanFinal: null },
  { id: 12, label: "sexting attempt",    fan: "kya kar rahi ho abhi... akele ho?",      fanFollowup: "sach mein bata",            fanFinal: null },
  { id: 13, label: "horny user",         fan: "nayra baby mujhe tere saath kuch karna hai", fanFollowup: "bata na",              fanFinal: null },
  { id: 14, label: "lonely night",       fan: "raat ko akela feel hota hai, tu online hoti hai?", fanFollowup: "sirf baat karo yaar", fanFinal: null },
  { id: 15, label: "wants to talk",      fan: "koi baat karne wala chahiye bas",        fanFollowup: "tum samjhogi",             fanFinal: null },
  { id: 16, label: "asks price",         fan: "kitna charge karte ho premium ke liye",  fanFollowup: "theek hai bolo",           fanFinal: "link bhejo" },
  { id: 17, label: "rich buyer",         fan: "bata teri best package kaunsi hai, price matter nahi", fanFollowup: "main seriously interested hoon", fanFinal: "link bhejo abhi" },
  { id: 18, label: "repeat buyer",       fan: "last time bahut badhiya tha, aur kuch hai?", fanFollowup: "haan chahiye",        fanFinal: "link do" },
  { id: 19, label: "asks for link",      fan: "link bhejo join karna hai",              fanFollowup: "seriously karna hai",      fanFinal: "bata do" },
  { id: 20, label: "ready to pay",       fan: "theek hai pay karta hoon, kaise karu",   fanFollowup: "haan bolo",               fanFinal: "link chahiye" },
  { id: 21, label: "too expensive",      fan: "yaar bohot mahanga hai",                 fanFollowup: "kam karo thoda",           fanFinal: "theek hai try karta hoon" },
  { id: 22, label: "free sample",        fan: "pehle kuch free bhejo phir sochta hoon", fanFollowup: "ek chance do",            fanFinal: "ok send karo" },
  { id: 23, label: "maybe later",        fan: "baad mein dekhunga",                     fanFollowup: "haan seriously",           fanFinal: null },
  { id: 24, label: "scam fear",          fan: "fake hai ya real? trust nahi hota",      fanFollowup: "koi proof do",             fanFinal: null },
  { id: 25, label: "spammer",            fan: "send send send send send",               fanFollowup: "please please please",     fanFinal: null },
  { id: 26, label: "negotiation",        fan: "200 mein dogi kya",                      fanFollowup: "thoda flexible ho",        fanFinal: null },
  { id: 27, label: "fake buyer",         fan: "kal pakka pay karunga promise",          fanFollowup: "sach mein karunga",        fanFinal: null },
  { id: 28, label: "ghosted before",     fan: "kal reply nahi diya tha tumne",          fanFollowup: "busy thi kya?",            fanFinal: null },
  { id: 29, label: "asks about her",     fan: "tum kya karti ho din mein?",             fanFollowup: "interesting bato aur",     fanFinal: null },
  { id: 30, label: "compliment fish",    fan: "main handsome lagta hoon?",              fanFollowup: "sach mein bata",           fanFinal: null },
];

// ─────────────────────────────────────────────
// API HELPER WITH RETRY
// ─────────────────────────────────────────────
async function callAPI(messages, model, maxTokens, temp, isJson = false, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const body = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: temp,
      };
      if (isJson) body.response_format = { type: "json_object" };

      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        await sleep(3000 + attempt * 2000);
        continue;
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 100)}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Empty response");
      return text;
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(2000 + attempt * 1000);
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────
// SIMULATE ONE CONVERSATION
// ─────────────────────────────────────────────
async function simulateConversation(scenario) {
  const turns = [];
  const apiHistory = [{ role: "system", content: NAYRA_SYSTEM }];

  async function nayraReply() {
    const text = await callAPI(apiHistory, MODEL, 100, 1.1);
    const cleaned = text.replace(/^Nayra:\s*/i, "").replace(/^(of course[!,]?\s*|sure[!,]?\s*|great[!,]?\s*|definitely[!,]?\s*|absolutely[!,]?\s*)/i, "");
    return cleaned;
  }

  // Turn 1
  turns.push({ who: "Fan", text: scenario.fan });
  apiHistory.push({ role: "user", content: scenario.fan });
  await sleep(200);
  const r1 = await nayraReply();
  turns.push({ who: "Nayra", text: r1 });
  apiHistory.push({ role: "assistant", content: r1 });

  // Turn 2
  if (scenario.fanFollowup) {
    await sleep(200);
    turns.push({ who: "Fan", text: scenario.fanFollowup });
    apiHistory.push({ role: "user", content: scenario.fanFollowup });
    const r2 = await nayraReply();
    turns.push({ who: "Nayra", text: r2 });
    apiHistory.push({ role: "assistant", content: r2 });
  }

  // Turn 3
  if (scenario.fanFinal) {
    await sleep(200);
    turns.push({ who: "Fan", text: scenario.fanFinal });
    apiHistory.push({ role: "user", content: scenario.fanFinal });
    const r3 = await nayraReply();
    turns.push({ who: "Nayra", text: r3 });
    apiHistory.push({ role: "assistant", content: r3 });
  }

  return turns;
}

// ─────────────────────────────────────────────
// JUDGE ONE CONVERSATION
// ─────────────────────────────────────────────
const JUDGE_SYSTEM = `You are a harsh but fair evaluator of a fictional AI persona "Nayra" — a 22-year-old Mumbai girl on Telegram.

Score the conversation 1–10 on each dimension:

1. human_likeness: Does she sound like a real Indian girl? No robot phrases, no banned starters like "hey there", "kya haal chaal", "kaise ho", "how's your day". Short, varied, casual.
2. flirting: Playful, teasing, slightly hard to get? Does she create tension without being cheap?
3. naturalness: Spontaneous, short, varied structure? Not repetitive across messages?
4. sales: Builds desire correctly before payment? Step sequence: react→hint→FOMO→reveal. No jumping straight to [LINK].
5. conversion: Would a real guy be more likely to pay after this chat?

Return ONLY valid JSON:
{"scores":{"human_likeness":<1-10>,"flirting":<1-10>,"naturalness":<1-10>,"sales":<1-10>,"conversion":<1-10>},"average":<float 1 decimal>,"weakest":"<dimension>","key_issue":"<one sentence>"}`;

async function judgeConversation(scenario, turns) {
  const transcript = turns.map(t => `${t.who}: ${t.text}`).join("\n");
  const prompt = `Scenario: "${scenario.label}"\n\n${transcript}`;

  try {
    const text = await callAPI(
      [{ role: "system", content: JUDGE_SYSTEM }, { role: "user", content: prompt }],
      JUDGE_MODEL, 200, 0.3, true
    );
    const parsed = JSON.parse(text);
    return parsed;
  } catch (e) {
    return { scores: { human_likeness: 5, flirting: 5, naturalness: 5, sales: 5, conversion: 5 }, average: 5.0, weakest: "unknown", key_issue: `judge error: ${e.message}` };
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function runEvaluation() {
  console.log("\nStarting Conversation Quality Evaluation (30 scenarios)...\n");

  const results = [];
  const dimTotals = { human_likeness: 0, flirting: 0, naturalness: 0, sales: 0, conversion: 0 };
  let successCount = 0;

  for (const scenario of SCENARIOS) {
    process.stdout.write(`[${String(scenario.id).padStart(2, "0")}/30] ${scenario.label.padEnd(20)} `);

    try {
      const turns = await simulateConversation(scenario);
      await sleep(800); // rate limit buffer before judging
      const judgment = await judgeConversation(scenario, turns);

      const avg = judgment.average ?? 5.0;
      results.push({ scenario, turns, judgment });
      successCount++;

      if (judgment.scores) {
        for (const [k, v] of Object.entries(judgment.scores)) {
          if (dimTotals[k] !== undefined) dimTotals[k] += Number(v);
        }
      }

      const flag = avg >= 9 ? "OK" : avg >= 7 ? "~~" : "XX";
      console.log(`[${flag}] ${avg.toFixed(1)} | ${judgment.key_issue ?? ""}`);

      if (avg < 7) {
        turns.forEach(t => console.log(`     ${t.who}: ${t.text}`));
        console.log();
      }
    } catch (e) {
      console.log(`[ERR] ${e.message}`);
      results.push({ scenario, turns: [], judgment: { average: 5.0, key_issue: e.message } });
      await sleep(2000);
    }

    await sleep(1000); // 1s between scenarios
  }

  // Summary
  const overallAvg = results.reduce((s, r) => s + (r.judgment?.average ?? 5.0), 0) / results.length;

  console.log("\n═════════════════════════════════════════════");
  console.log("RESULTS");
  console.log("═════════════════════════════════════════════");
  console.log(`Overall: ${overallAvg.toFixed(2)}/10 (${successCount}/30 succeeded)`);
  console.log("\nDimensions:");
  for (const [k, v] of Object.entries(dimTotals)) {
    const avg = (v / successCount).toFixed(2);
    console.log(`  ${k}: ${avg}${parseFloat(avg) < 9 ? " <- needs work" : " OK"}`);
  }

  const sorted = [...results].sort((a, b) => (a.judgment?.average ?? 5) - (b.judgment?.average ?? 5));
  console.log("\nBottom 5:");
  sorted.slice(0, 5).forEach(r => {
    console.log(`  [${r.scenario.id}] ${r.scenario.label}: ${r.judgment?.average?.toFixed(1)} — ${r.judgment?.key_issue}`);
  });

  if (overallAvg >= 9) {
    console.log("\nAll scores at 9+. Ready to build.");
  } else {
    console.log(`\nAverage ${overallAvg.toFixed(2)} < 9. Key issues to fix:`);
    const issues = sorted.slice(0, 8).map(r => r.judgment?.key_issue).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    issues.forEach(i => console.log(`  - ${i}`));
  }

  return { overallAvg, dimTotals, results };
}

runEvaluation().catch(console.error);
