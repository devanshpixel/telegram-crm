import { NextResponse } from "next/server";
import { verifyCode } from "@/src/lib/telegram/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone ?? "").trim();
    const code = String(body.code ?? "").trim();
    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code are required" }, { status: 400 });
    }
    await verifyCode(phone, code);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verification failed";
    if (message.toLowerCase().includes("two-factor") || message.toLowerCase().includes("password")) {
      return NextResponse.json({ error: message, needs2fa: true }, { status: 200 });
    }
    return NextResponse.json({ error: message, code: "VERIFY_CODE_FAILED" }, { status: 500 });
  }
}
