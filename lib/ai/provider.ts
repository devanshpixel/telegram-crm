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

// Build the ordered fallback chain for a tier. Always tries a fast paid model
// (gemini-2.5-flash) first and falls back to the free model on 402/429, so the
// common case completes in 1-3s instead of waiting 8s for the free model.
// Explicit per-tier env overrides are prepended when set.
function modelChain(tier: ModelTier): string[] {
  const override = {
    fast: process.env.AI_MODEL_FAST,
    cheap: process.env.AI_MODEL_CHEAP,
    smart: process.env.AI_MODEL_SMART,
  }[tier];

  const chain: (string | undefined)[] = [];
  if (override) chain.push(override);
  // Always try gemini-2.5-flash first — instant 402 if no credits (skips to free)
  chain.push("google/gemini-2.5-flash");
  chain.push(OPENROUTER_MODEL_FREE);

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
  // 5 s per attempt: fast enough to fall through to the next model quickly.
  // Timeouts are noRetry — if a model didn't respond in 5 s, retrying it
  // just wastes another 5 s; move straight to the next model in the chain.
  const timeoutMs = args.timeoutMs ?? 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
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
      // No credits / rate-limited / timeout → skip to next model immediately.
      if (res.status === 402 || res.status === 429) err.noRetry = true;
      throw err;
    }

    const body = await res.json();
    const text: string | undefined = body?.choices?.[0]?.message?.content;
    if (!text || text.trim().length === 0) throw new Error("Empty response");
    // Reject single-line fragments shorter than 4 words — truncated completions
    // that pass the empty check but are not sendable replies. Multi-line replies
    // (multi-bubble output using \n) are exempt: each line may be 1-2 words and
    // that is intentional ("haan\nsun", "ruk\nek sec"). Falls through to the next
    // model in the chain immediately without retrying the same model.
    const lines = text.trim().split("\n").filter(l => l.trim().length > 0);
    const isMultiBubble = lines.length >= 2;
    const words = text.trim().split(/\s+/);
    if (!isMultiBubble && words.length < 4) {
      console.log(JSON.stringify({
        event: "ai_rejected_short_completion",
        model: args.model,
        wordCount: words.length,
        preview: text.trim().slice(0, 40),
      }));
      throw new Error(`Degenerate response: ${words.length} word(s)`);
    }
    return text;
  } catch (err) {
    // AbortError = our own timeout fired → noRetry so generate() skips to next model.
    if (err instanceof Error && err.name === "AbortError") {
      // Instrument: emit a dedicated log line so production logs can confirm
      // whether 5 s timeouts are a real latency source before changing the limit.
      console.warn(JSON.stringify({
        event: "ai_timeout",
        model: args.model,
        timeoutMs,
        elapsedMs: Date.now() - t0,
      }));
      const e: RetryableError = new Error(`Timeout after ${timeoutMs} ms`);
      e.noRetry = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    // Latency logged here so it covers both success and failure paths.
    console.log(JSON.stringify({
      event: "ai_call",
      model: args.model,
      latencyMs: Date.now() - t0,
    }));
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
  let fallbackReason: string | undefined;

  for (const model of models) {
    // One transient retry per model. Timeouts and rate-limits are noRetry —
    // they skip straight to the next model without burning another attempt.
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
        if (text && text.trim()) {
          if (fallbackReason) {
            console.log(JSON.stringify({ event: "ai_fallback_used", model, fallbackReason }));
          }
          return { text, model };
        }
        fallbackReason = "empty_response";
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(JSON.stringify({ event: "ai_model_failed", model, attempt, reason: msg }));
        if ((err as RetryableError)?.noRetry) {
          fallbackReason = msg;
          break; // skip to next model immediately
        }
        if (attempt === 1) {
          fallbackReason = msg;
          break; // exhausted same-model retries
        }
        // loop once more on the same model (transient network error, not timeout)
      }
    }
  }

  console.log(JSON.stringify({ event: "ai_all_models_failed", tier: args.tier, fallbackReason }));
  return null;
}
