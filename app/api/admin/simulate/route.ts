import { NextResponse } from "next/server";
import { simulateConversation, PERSONA_KEYS, type PersonaKey } from "@/lib/ai/simulator";

// Admin-only conversation quality harness. Not public, not a cron — it falls
// through middleware to the CRM-key gate. Drives the real reply engine with a
// generated fan of each persona so quality can be checked without Telegram.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY not configured — the simulator needs the model" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const personaParam = (url.searchParams.get("persona") || "buyer").toLowerCase();
  const all = personaParam === "all";
  const turnsRaw = parseInt(url.searchParams.get("turns") || "", 10);
  const turns = Math.min(Math.max(Number.isNaN(turnsRaw) ? (all ? 3 : 6) : turnsRaw, 1), 12);

  if (!all && !PERSONA_KEYS.includes(personaParam as PersonaKey)) {
    return NextResponse.json(
      { error: `Unknown persona '${personaParam}'. Valid: ${PERSONA_KEYS.join(", ")}, or 'all'.` },
      { status: 400 },
    );
  }

  const keys: PersonaKey[] = all ? PERSONA_KEYS : [personaParam as PersonaKey];
  const start = Date.now();
  const results: unknown[] = [];

  for (const key of keys) {
    // Stay under maxDuration; return whatever completed (free-tier latency varies).
    if (Date.now() - start > 50000) break;
    try {
      results.push(await simulateConversation(key, turns));
    } catch (e) {
      results.push({ persona: key, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ turns, requested: keys.length, returned: results.length, results });
}

export const GET = handle;
export const POST = handle;
