import { NextResponse } from "next/server";
import { pollIncomingMessages } from "@/src/lib/telegram/pollMessages";

export async function POST() {
  try {
    const summary = await pollIncomingMessages();
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Poll failed";
    console.error("[Poll API] Fatal error:", message);
    return NextResponse.json(
      { 
        dialogsChecked: 0,
        newMessages: 0,
        repliesSent: 0,
        offersSent: 0,
        remindersSent: 0,
        errors: [`Fatal poll error: ${message}`],
      },
      { status: 200 },
    );
  }
}
