import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Only Razorpay's webhook is truly public — it authenticates every request with
// an HMAC signature, so it must be reachable without the CRM key.
const PUBLIC_PATHS = ["/api/razorpay/webhook", "/api/checkout", "/api/media"];

// Scheduler endpoints — authenticated with CRON_SECRET (not the CRM key).
const CRON_PATHS = ["/api/telegram/poll", "/api/telegram/remind", "/api/telegram/reengage", "/api/razorpay/reconcile", "/api/razorpay/recover", "/api/health"];

const SESSION_COOKIE = "crm_session";

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

  // 2. Signature-verified public endpoints (Razorpay webhook).
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 3. Everything else (dashboard pages + all other API routes) requires the CRM key.
  if (!apiKey) {
    return NextResponse.json({ error: "CRM_API_KEY is not configured" }, { status: 500 });
  }

  const hasValidCookie = request.cookies.get(SESSION_COOKIE)?.value === apiKey;
  const hasValidHeader = request.headers.get("x-api-key") === apiKey;

  // Login via ?key=<CRM_API_KEY>: set an httpOnly session cookie, then redirect
  // to the same URL with the key stripped so it never lingers in history/logs.
  const providedKey = searchParams.get("key");
  if (!hasValidCookie && providedKey && providedKey === apiKey) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    res.cookies.set(SESSION_COOKIE, apiKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  if (hasValidCookie || hasValidHeader) {
    return NextResponse.next();
  }

  // Unauthorized.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return unauthorizedPage();
}
