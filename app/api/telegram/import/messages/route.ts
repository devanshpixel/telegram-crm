import { NextResponse } from "next/server";
import { importMessages } from "@/src/lib/telegram/importMessages";

export async function POST() {
  try {
    const summary = await importMessages();
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Message sync failed";
    return NextResponse.json(
      { error: message, code: "MESSAGE_SYNC_FAILED" },
      { status: 500 },
    );
  }
}
