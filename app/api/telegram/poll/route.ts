import { NextResponse } from "next/server";
import { pollIncomingMessages } from "@/src/lib/telegram/pollMessages";

export async function POST() {
  try {
    const summary = await pollIncomingMessages();
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Poll failed";
    return NextResponse.json(
      { error: message, code: "POLL_FAILED" },
      { status: 500 },
    );
  }
}
