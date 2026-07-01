import { NextResponse } from "next/server";

// Dashboard logout: clears the httpOnly `crm_session` cookie set by the
// middleware on `?key=` login. Reachable only by an already-authenticated
// session (middleware requires a valid cookie/header to hit this route), so
// it doubles as CSRF protection — an attacker without the session cannot
// force a logout. POST-only to avoid accidental logout via prefetch/GET.
const SESSION_COOKIE = "crm_session";

export async function POST() {
  const res = NextResponse.json({ success: true }, { status: 200 });
  // Overwrite with an immediately-expired cookie using the same attributes
  // the middleware used to set it, so the browser reliably drops it.
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
