import { NextResponse } from "next/server";
import { sendCode } from "@/src/lib/telegram/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone ?? "").trim();
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    const result = await sendCode(phone);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send code failed";
    return NextResponse.json({ error: message, code: "SEND_CODE_FAILED" }, { status: 500 });
  }
}
