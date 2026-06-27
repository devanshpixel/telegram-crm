import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-cron-secret");
    if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const db = await getDb();
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const newContactsToday = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE created_at >= ?")
      .get(yesterday) as { count: number }).count;

    const newPurchasesToday = (await db
      .prepare("SELECT COUNT(*) AS count FROM purchases WHERE created_at >= ?")
      .get(yesterday) as { count: number }).count;

    const revenueToday = (await db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM purchases WHERE purchase_date = ?")
      .get(today) as { total: number }).total;

    const pendingFollowUps = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE conv_state = 'OFFER_SENT'")
      .get() as { count: number }).count;

    const atRiskContacts = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE churn_risk >= 60")
      .get() as { count: number }).count;

    const hotLeads = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE lead_classification = 'hot'")
      .get() as { count: number }).count;

    const segmentCounts = await db
      .prepare(`
        SELECT spend_segment, COUNT(*) AS count
        FROM contacts
        GROUP BY spend_segment
        ORDER BY count DESC
      `)
      .all() as { spend_segment: string; count: number }[];

    const failedPending = (await db
      .prepare("SELECT COUNT(*) AS count FROM failed_actions WHERE resolved_at IS NULL AND retry_count < max_retries")
      .get() as { count: number }).count;

    return NextResponse.json({
      date: today,
      period: "last_24h",
      newContacts: newContactsToday,
      newPurchases: newPurchasesToday,
      revenueToday,
      pendingFollowUps,
      atRiskContacts,
      hotLeads,
      segmentBreakdown: Object.fromEntries(segmentCounts.map((s) => [s.spend_segment, s.count])),
      pendingRetries: failedPending,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Daily summary failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
