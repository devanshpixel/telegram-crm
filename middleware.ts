import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/api/telegram/send-code",
  "/api/telegram/verify-code",
  "/api/telegram/verify-password",
  "/api/telegram/status",
  "/api/webhooks/stripe",
  "/api/media/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const apiKey = process.env.CRM_API_KEY;
  if (!apiKey) {
    return NextResponse.next();
  }

  if (request.headers.get("x-api-key") !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
