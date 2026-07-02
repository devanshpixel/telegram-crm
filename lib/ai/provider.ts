// ─────────────────────────────────────────────
// AI PROVIDER ROUTER
// ─────────────────────────────────────────────
// One entry point for every model call. Each request is routed to a model *tier*
// based on how much the reply matters, then falls through an ordered chain of
// models so a single provider outage / rate-limit is NEVER a user-facing failure.
//
//   fast   → cheap, instant model for trivial one-liners ("hi", "ok")   → Gemini Flash
//   cheap  → default for normal conversation                            → Gemini Flash / cheap OpenRouter
//   smart  → emotionally-loaded or long-context replies                 → Claude Sonnet
//
// Everything goes through OpenRouter's single gateway (one API key, per the
// locked architecture), so "provider" == which model id we ask for. The named
// premium models only activate when the router is explicitly enabled (or a
// per-tier override is set); otherwise every tier resolves to the always-free
// model, so behaviour is byte-for-byte identical to before until credits are
// added — no surprise cost, no regression. The chain always ends at the free
// model, and generate() returns null (not throw) so callers keep their own
// in-persona canned fallback as the final safety net.

export type ModelTier = "fast" | "cheap" | "smart";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// The free model that requires no OpenRouter credits — the guaranteed last resort.
export const OPENROUTER_MODEL_FREE = "google/gemma-4-31b-it:free";

// Named provider defaults per tier, matching the routing spec. These are only
// consulted when the router is enabled (AI_ROUTER_ENABLED=1) — see modelChain().
const TIER_DEFAULTS: Record<ModelTier, string[]> = {
  fast: ["google/gemini-flash-1.5"],
  cheap: ["google/gemini-flash-1.5"],
  smart: ["anthropic/claude-3.5-sonnet"],
};

function routerEnabled(): boolean {
  const v = process.env.AI_ROUTER_ENABLED;
  return v === "1" || v === "true";
}

// Build the ordered fallback chain for a tier. Explicit per-tier env overrides
// always win; named defaults are added when the router is enabled; the free
// model is always appended so the chain can never be empty.
function modelChain(tier: ModelTier): string[] {
  const override = {
    fast: process.env.AI_MODEL_FAST,
    cheap: process.env.AI_MODEL_CHEAP,
    smart: process.env.AI_MODEL_SMART,
  }[tier];

  const chain: (string | undefined)[] = [];
  if (override) chain.push(override);
  if (routerEnabled()) chain.push(...TIER_DEFAULTS[tier]);
  chain.push(OPENROUTER_MODEL_FREE);

  // De-dupe while preserving order (an override equal to a default, etc.).
  return Array.from(new Set(chain.filter((m): m is string => !!m)));
}

// ─────────────────────────────────────────────
// TIER SELECTION (deterministic, unit-tested)
// ─────────────────────────────────────────────
export interface TierSignals {
  /** 0–100 warmth; hot moments are worth the stronger model. */
  emotionalTemp: number;
  /** 0–100 purchase intent; a live offer moment must not be fumbled. */
  intentScore: number;
  /** total chars of prompt+context — long context needs a stronger model. */
  contextChars: number;
  /** he objected / declined / is emotionally raw — reply needs care. */
  emotionallyCharged: boolean;
  /** trivial one-word reply where the fast model is plenty. */
  trivial: boolean;
}

// Above this, the dynamic context (transcript + memory) no longer fits a small
// model comfortably. Measure only the user prompt (dynamic) — the system prompt
// is a fixed ~4 KB persona and would otherwise always exceed this threshold,
// routing every reply to "smart" and wasting credits on trivial turns.
const LONG_CONTEXT_CHARS = 1800;

/**
 * Decide which model tier a reply deserves. Precision order matters: the
 * high-stakes signals (charged / long / hot / buying) win over the "trivial"
 * shortcut so we never send a cheap model into an emotionally important moment.
 */
export function selectTier(s: TierSignals): ModelTier {
  if (s.emotionallyCharged) return "smart";
  if (s.contextChars >= LONG_CONTEXT_CHARS) return "smart";
  if (s.emotionalTemp >= 70 || s.intentScore >= 60) return "smart";
  if (s.trivial) return "fast";
  return "cheap";
}

// ─────────────────────────────────────────────
// LOW-LEVEL COMPLETION
// ─────────────────────────────────────────────
export interface RawCompletionArgs {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  apiKey?: string;
}

interface RetryableError extends Error {
  noRetry?: boolean;
  status?: number;
}

/**
 * Single call to one model through OpenRouter. Returns the completion text, or
 * throws a RetryableError. 402 (no credits) / 429 (rate limit) are flagged
 * noRetry so the caller advances to the next model in the chain immediately.
 */
export async function rawCompletion(args: RawCompletionArgs): Promise<string> {
  const apiKey = args.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const e: RetryableError = new Error("OPENROUTER_API_KEY not configured");
    e.noRetry = true;
    throw e;
  }

  const controller = new AbortController();
  // 8 s per attempt keeps worst-case (2 attempts) at ≤16 s per model, well within
  // the 50 s poll budget even when several models are tried.
  const timeoutId = setTimeout(() => controller.abort(), args.timeoutMs ?? 8000);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
        max_tokens: args.maxTokens ?? 100,
        temperature: args.temperature ?? 1.0,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      const err: RetryableError = new Error(`API error ${res.status}: ${errorText}`);
      err.status = res.status;
      // No credits / rate-limited → retrying the same model won't help; move on.
      if (res.status === 402 || res.status === 429) err.noRetry = true;
      throw err;
    }

    const body = await res.json();
    const text: string | undefined = body?.choices?.[0]?.message?.content;
    if (!text || text.trim().length === 0) throw new Error("Empty response");
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────
// TIER-ROUTED GENERATION (with fallback chain)
// ─────────────────────────────────────────────
export interface GenerateArgs {
  system: string;
  user: string;
  tier: ModelTier;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Generate a reply for the chosen tier, walking the model fallback chain until
 * one succeeds. Returns { text, model } or null when every model failed (caller
 * then uses its own canned fallback — a user-facing failure never escapes here).
 */
export async function generate(args: GenerateArgs): Promise<{ text: string; model: string } | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;

  const models = modelChain(args.tier);
  for (const model of models) {
    // One transient retry per model; noRetry errors (402/429) skip straight on.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await rawCompletion({
          model,
          system: args.system,
          user: args.user,
          maxTokens: args.maxTokens,
          temperature: args.temperature,
          timeoutMs: args.timeoutMs,
        });
        if (text && text.trim()) return { text, model };
        break; // empty response → next model (retrying the same one won't help)
      } catch (err) {
        console.error(`[AI_PROVIDER] ${model} attempt ${attempt} failed:`, err);
        if ((err as RetryableError)?.noRetry) break; // → next model
        if (attempt === 1) break; // exhausted same-model retries → next model
        // otherwise loop once more on the same model (transient network/timeout)
      }
    }
  }
  return null;
}
