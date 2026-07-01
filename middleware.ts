import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Only Razorpay's webhook is truly public — it authenticates every request with
// an HMAC signature, so it must be reachable without the CRM key.
const PUBLIC_PATHS = ["/api/razorpay/webhook", "/api/checkout"];

// Scheduler endpoints — authenticated with CRON_SECRET (not the CRM key).
// /api/health is here (not public): it runs live Telegram getMe + OpenRouter
// checks and leaks infra status, so it must require the cron secret. verify-crons
// and external uptime monitors reach it with the x-cron-secret header.
const CRON_PATHS = [
  "/api/telegram/poll",
  "/api/telegram/remind",
  "/api/telegram/reengage",
  "/api/razorpay/reconcile",
  "/api/razorpay/recover",
  "/api/automation/stale-leads",
  "/api/automation/failed-unlock",
  "/api/automation/vip-followup",
  "/api/automation/whale-followup",
  "/api/automation/daily-summary",
  "/api/automation/retry-queue",
  "/api/automation/verify-crons",
  "/api/health",
];

const SESSION_COOKIE = "crm_session";

// --- Brute-force throttle for failed dashboard auth --------------------------
// The dashboard authenticates via an exact `?key=` / cookie / header match, so
// the only attack surface is guessing CRM_API_KEY. We throttle *failed* auth
// attempts per client IP with an in-memory sliding window. This adds zero cost
// to legitimate authenticated requests (they never reach this code) and is a
// best-effort per-instance mitigation — serverless instances don't share state,
// but each instance independently caps how fast an attacker can guess.
const FAIL_WINDOW_MS = 60_000; // 1 minute
const FAIL_MAX = 10; // max failed auth attempts per IP per window
const failCounts = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

// Returns true if this IP is over its failed-attempt budget. Opportunistically
// evicts expired entries so the map can't grow unbounded under sustained abuse.
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = failCounts.get(ip);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= FAIL_MAX;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = failCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    failCounts.set(ip, { count: 1, resetAt: now + FAIL_WINDOW_MS });
  } else {
    entry.count += 1;
  }
  // Bound memory: prune expired entries when the map gets large.
  if (failCounts.size > 5000) {
    for (const [k, v] of failCounts) {
      if (now > v.resetAt) failCounts.delete(k);
    }
  }
}

function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: "Too many failed attempts. Try again later." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

export const config = {
  // Run on all pages and API routes; skip Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function unauthorizedPage(): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>401 Unauthorized</title></head>` +
      `<body style="font-family:system-ui,sans-serif;background:#0b0b0f;color:#e7e7ea;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center">` +
      `<div style="text-align:center;max-width:420px;padding:24px">` +
      `<h2 style="margin:0 0 8px">401 — Unauthorized</h2>` +
      `<p style="color:#9a9aa3;line-height:1.5">This dashboard is private. Append <code style="color:#c9c9d4">?key=YOUR_CRM_API_KEY</code> to the URL to sign in.</p>` +
      `</div></body></html>`,
    { status: 401, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const apiKey = process.env.CRM_API_KEY;
  const cronSecret = process.env.CRON_SECRET;

  // 1. Cron endpoints: Bearer <CRON_SECRET> (Vercel Cron) or x-cron-secret (manual).
  if (CRON_PATHS.some((p) => pathname.startsWith(p))) {
    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
    }
    const authHeader = request.headers.get("authorization");
    const ok =
      authHeader === `Bearer ${cronSecret}` ||
      request.headers.get("x-cron-secret") === cronSecret;
    if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // 2. Signature-verified public endpoints (Razorpay webhook, media download).
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/media/") && (pathname.endsWith("/file") || pathname.endsWith("/preview"))) {
    return NextResponse.next();
  }

  // 3. Everything else (dashboard pages + all other API routes) requires the CRM key.
  if (!apiKey) {
    return NextResponse.json({ error: "CRM_API_KEY is not configured" }, { status: 500 });
  }

  const hasValidCookie = request.cookies.get(SESSION_COOKIE)?.value === apiKey;
  const hasValidHeader = request.headers.get("x-api-key") === apiKey;

  // Already authenticated requests skip the throttle entirely (no added latency).
  // Anyone else is a potential brute-forcer: block if over budget before we even
  // compare keys, so guessing can't outrun the window.
  if (!hasValidCookie && !hasValidHeader) {
    const ip = clientIp(request);
    if (isRateLimited(ip)) return tooManyRequests();
    // A request that presents no credentials at all (just loading the login
    // page) shouldn't burn budget; only count attempts that try a key.
    const attemptedKey = searchParams.get("key") || request.headers.get("x-api-key");
    if (attemptedKey && attemptedKey !== apiKey) recordFailure(ip);
  }

  // Login via ?key=<CRM_API_KEY>: set an httpOnly session cookie, then redirect
  // to the same URL with the key stripped so it never lingers in history/logs.
  const providedKey = searchParams.get("key");
  if (!hasValidCookie && providedKey && providedKey === apiKey) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    res.cookies.set(SESSION_COOKIE, apiKey, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  if (hasValidCookie || hasValidHeader) {
    const res = NextResponse.next();
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return res;
  }

  // Unauthorized.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return unauthorizedPage();
}
