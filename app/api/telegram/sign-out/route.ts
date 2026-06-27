import { NextResponse } from "next/server";
import { signOut } from "@/src/lib/telegram/auth";

export async function POST() {
  try {
    await signOut();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Sign out failed", code: "SIGN_OUT_FAILED" },
      { status: 500 }
    );
  }
}