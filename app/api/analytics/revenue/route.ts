import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();

    const totalOffers = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE offer_sent = 1")
      .get() as { count: number }).count;

    const totalBuyers = (await db
      .prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases")
      .get() as { count: number }).count;

    const conversionRate = totalOffers > 0 ? Math.round((totalBuyers / totalOffers) * 100) : 0;

    const aovRow = await db
      .prepare("SELECT COALESCE(AVG(amount), 0) AS avg FROM purchases")
      .get() as { avg: number };
    const aov = Math.round(aovRow.avg);

    const ltvRow = await db
      .prepare("SELECT COALESCE(AVG(total_spent), 0) AS avg FROM contacts WHERE total_spent > 0")
      .get() as { avg: number };
    const ltv = Math.round(ltvRow.avg);

    const totalBuyerCount = (await db
      .prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases")
      .get() as { count: number }).count;

    const repeatBuyers = (await db
      .prepare("SELECT COUNT(*) AS count FROM (SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) > 1)")
      .get() as { count: number }).count;

    const repeatPurchaseRate = totalBuyerCount > 0 ? Math.round((repeatBuyers / totalBuyerCount) * 100) : 0;

    const totalRevenue30d = (await db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM purchases WHERE purchase_date >= date('now', '-30 days')")
      .get() as { total: number }).total;

    const purchases30d = (await db
      .prepare("SELECT COUNT(*) AS count FROM purchases WHERE purchase_date >= date('now', '-30 days')")
      .get() as { count: number }).count;

    const totalRevenueAll = (await db
      .prepare("SELECT COALESCE(SUM(revenue), 0) AS total FROM contacts")
      .get() as { total: number }).total;

    const avgEmotionalTemp = (await db
      .prepare("SELECT COALESCE(ROUND(AVG(emotional_temp), 1), 0) AS avg FROM contacts WHERE emotional_temp != 50")
      .get() as { avg: number }).avg;

    const avgRelationshipScore = (await db
      .prepare("SELECT COALESCE(ROUND(AVG(relationship_score), 1), 0) AS avg FROM contacts WHERE relationship_score > 0")
      .get() as { avg: number }).avg;

    return NextResponse.json({
      conversion: {
        offersSent: totalOffers,
        uniqueBuyers: totalBuyers,
        conversionRate: `${conversionRate}%`,
      },
      revenue: {
        totalAllTime: totalRevenueAll,
        last30Days: totalRevenue30d,
        purchasesLast30Days: purchases30d,
        aov: `₹${aov}`,
        ltv: `₹${ltv}`,
      },
      retention: {
        repeatBuyers,
        totalBuyers: totalBuyerCount,
        repeatPurchaseRate: `${repeatPurchaseRate}%`,
      },
      engagement: {
        avgEmotionalTemp,
        avgRelationshipScore,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analytics failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
