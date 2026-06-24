import { NextResponse } from "next/server";
import { pollIncomingMessages } from "@/src/lib/telegram/pollMessages";

// Poll is the whole engine: ingest DMs, AI replies, offers, reminders.
export const dynamic = "force-dynamic";
// Cap the function lifetime. Vercel Cron uses GET; external schedulers may POST.
export const maxDuration = 60;

async function handle(req: Request) {
  // Defense-in-depth auth (middleware also enforces this). Accept either
  // Vercel's `Authorization: Bearer <CRON_SECRET>` (cron is a GET) or an
  // explicit `x-cron-secret` header for manual/external POST schedulers.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-cron-secret");
    if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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

export const GET = handle;
export const POST = handle;
