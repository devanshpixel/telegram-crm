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

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const apiKey = process.env.CRM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CRM_API_KEY is not configured" }, { status: 500 });
  }

  // Allow requests with valid session cookie (browser frontend)
  if (request.cookies.get("crm_session")?.value === apiKey) {
    return NextResponse.next();
  }

  // Allow requests with valid API key header (extension, programmatic)
  if (request.headers.get("x-api-key") === apiKey) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: "/api/:path*",
};
