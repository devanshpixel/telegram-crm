import { NextResponse } from "next/server";
import { getLoginStatus } from "@/src/lib/telegram/auth";

export async function GET() {
  try {
    const status = getLoginStatus();
    return NextResponse.json(status, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Status check failed";
    return NextResponse.json({ error: message, code: "STATUS_FAILED" }, { status: 500 });
  }
}
