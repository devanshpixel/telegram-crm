import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/api/telegram/send-code",
  "/api/telegram/verify-code",
  "/api/telegram/verify-password",
  "/api/telegram/status",
  "/api/razorpay/webhook",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const apiKey = process.env.CRM_API_KEY;

  // Build response and set crm_session cookie if missing
  const response = NextResponse.next();
  if (apiKey && !request.cookies.get("crm_session")) {
    response.cookies.set("crm_session", apiKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // Allow public paths without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return response;
  }

  // Auth gate only API routes
  if (pathname.startsWith("/api/")) {
    if (!apiKey) {
      return NextResponse.json({ error: "CRM_API_KEY is not configured" }, { status: 500 });
    }

    if (request.cookies.get("crm_session")?.value === apiKey) {
      return response;
    }

    if (request.headers.get("x-api-key") === apiKey) {
      return response;
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Non-API routes pass through (cookie set automatically above)
  return response;
}
