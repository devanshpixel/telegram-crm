import { NextResponse } from "next/server";
import { checkPassword } from "@/src/lib/telegram/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = String(body.password ?? "").trim();
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    await checkPassword(password);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Password verification failed";
    return NextResponse.json({ error: message, code: "PASSWORD_FAILED" }, { status: 500 });
  }
}
