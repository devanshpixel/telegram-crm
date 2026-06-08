import { NextResponse } from "next/server";
import { signOut } from "@/src/lib/telegram/auth";

export async function POST() {
  try {
    await signOut();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign out failed";
    return NextResponse.json({ error: message, code: "SIGN_OUT_FAILED" }, { status: 500 });
  }
}
