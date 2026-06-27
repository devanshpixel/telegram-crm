import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { razorpay } from "@/lib/razorpay";
import { getTelegramClient } from "@/src/lib/telegram/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // 1. Database
  try {
    const db = await getDb();
    const row = await db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number } | undefined;
    checks.db = row ? `connected (${row.count} contacts)` : "connected";
  } catch (e) {
    checks.db = `error: ${e instanceof Error ? e.message : String(e)}`;
    healthy = false;
  }

  // 2. Razorpay
  if (razorpay) {
    checks.razorpay = "configured";
  } else {
    checks.razorpay = "not configured";
    healthy = false;
  }

  // 3. OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    checks.openrouter = "configured";
  } else {
    checks.openrouter = "not configured (engine falls back to canned replies)";
  }

  // 4. Telegram session
  try {
    const client = await getTelegramClient();
    if (client.connected) {
      const me = await client.getMe();
      checks.telegram = `connected as ${me.firstName ?? me.username ?? "unknown"}`;
    } else {
      checks.telegram = "not connected";
      healthy = false;
    }
  } catch (e) {
    checks.telegram = `error: ${e instanceof Error ? e.message : String(e)}`;
    healthy = false;
  }

  // 5. Environment
  checks.env = process.env.CRM_API_KEY && process.env.CRON_SECRET ? "configured" : "missing required vars";

  return NextResponse.json({
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
}
