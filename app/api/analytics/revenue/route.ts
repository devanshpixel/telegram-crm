import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();

    const totalContacts = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts")
      .get() as { count: number }).count;

    const engagedContacts = (await db
      .prepare("SELECT COUNT(DISTINCT c.id) AS count FROM contacts c JOIN conversations conv ON conv.contact_id = c.id JOIN messages m ON m.conversation_id = conv.id WHERE m.direction = 'incoming'")
      .get() as { count: number }).count;

    const totalOffers = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE offer_sent = 1")
      .get() as { count: number }).count;

    const totalBuyers = (await db
      .prepare("SELECT COUNT(DISTINCT contact_id) AS count FROM purchases")
      .get() as { count: number }).count;

    const repeatBuyers = (await db
      .prepare("SELECT COUNT(*) AS count FROM (SELECT contact_id FROM purchases GROUP BY contact_id HAVING COUNT(*) > 1)")
      .get() as { count: number }).count;

    const whaleBuyers = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE total_spent >= 20000")
      .get() as { count: number }).count;

    const conversionRate = totalOffers > 0 ? Math.round((totalBuyers / totalOffers) * 100) : 0;
    const repeatPurchaseRate = totalBuyers > 0 ? Math.round((repeatBuyers / totalBuyers) * 100) : 0;

    const aovRow = await db
      .prepare("SELECT COALESCE(AVG(amount), 0) AS avg FROM purchases")
      .get() as { avg: number };
    const aov = Math.round(aovRow.avg);

    const ltvRow = await db
      .prepare("SELECT COALESCE(AVG(total_spent), 0) AS avg FROM contacts WHERE total_spent > 0")
      .get() as { avg: number };
    const ltv = Math.round(ltvRow.avg);

    const revenueByOfferRows = await db
      .prepare(`
        SELECT
          CASE
            WHEN amount < 100 THEN 'tier_under_100'
            WHEN amount < 300 THEN 'tier_100_299'
            WHEN amount < 500 THEN 'tier_300_499'
            WHEN amount < 1000 THEN 'tier_500_999'
            ELSE 'tier_1000_plus'
          END AS tier,
          COUNT(*) AS count,
          COALESCE(SUM(amount), 0) AS total
        FROM purchases
        GROUP BY tier
        ORDER BY total DESC
      `)
      .all() as { tier: string; count: number; total: number }[];

    const revenueByOffer: Record<string, { count: number; total: number }> = {};
    for (const r of revenueByOfferRows) {
      revenueByOffer[r.tier] = { count: r.count, total: r.total };
    }

    const segmentBreakdown = await db
      .prepare("SELECT spend_segment, COUNT(*) AS count FROM contacts GROUP BY spend_segment ORDER BY count DESC")
      .all() as { spend_segment: string; count: number }[];

    const segmentRevenue = await db
      .prepare(`
        SELECT c.spend_segment, COALESCE(SUM(p.amount), 0) AS total
        FROM contacts c
        LEFT JOIN purchases p ON p.contact_id = c.id
        GROUP BY c.spend_segment
        ORDER BY total DESC
      `)
      .all() as { spend_segment: string; total: number }[];

    const revenueBySegment: Record<string, { count: number; revenue: number }> = {};
    for (const s of segmentBreakdown) revenueBySegment[s.spend_segment] = { count: s.count, revenue: 0 };
    for (const s of segmentRevenue) {
      if (revenueBySegment[s.spend_segment]) revenueBySegment[s.spend_segment].revenue = s.total;
    }

    const contactsWithLockedResponses = (await db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE last_locked_response_at IS NOT NULL")
      .get() as { count: number }).count;

    const purchasedAfterLocked = (await db
      .prepare(`
        SELECT COUNT(*) AS count FROM contacts c
        WHERE c.last_locked_response_at IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM purchases p
            WHERE p.contact_id = c.id
              AND p.created_at > c.last_locked_response_at
          )
      `)
      .get() as { count: number }).count;

    const reengagementGapDays = 14;
    const reengagedBuyers = (await db
      .prepare(`
        SELECT COUNT(*) AS count FROM contacts c
        WHERE c.total_spent > 0
          AND EXISTS (
            SELECT 1 FROM messages m
            JOIN conversations conv ON conv.id = m.conversation_id
            WHERE conv.contact_id = c.id
              AND m.direction = 'incoming'
            GROUP BY conv.contact_id
            HAVING MAX(m.created_at) < datetime('now', '-' || ? || ' days')
          )
          AND EXISTS (
            SELECT 1 FROM purchases p
            WHERE p.contact_id = c.id
              AND p.purchase_date >= (
                SELECT MAX(m2.created_at) FROM messages m2
                JOIN conversations conv2 ON conv2.id = m2.conversation_id
                WHERE conv2.contact_id = c.id AND m2.direction = 'incoming'
              )
          )
      `)
      .get(reengagementGapDays) as { count: number }).count;

    const topBuyersRows = await db
      .prepare(`
        SELECT
          c.id, c.name, c.username, c.avatar, c.avatar_color, c.total_spent,
          (SELECT COUNT(*) FROM purchases p WHERE p.contact_id = c.id) AS purchase_count
        FROM contacts c
        WHERE c.total_spent > 0
        ORDER BY c.total_spent DESC
        LIMIT 10
      `)
      .all() as { id: number; name: string; username: string; avatar: string; avatar_color: string; total_spent: number; purchase_count: number }[];

    const topBuyers = topBuyersRows.map((r) => ({
      id: String(r.id),
      name: r.name,
      username: r.username,
      avatar: r.avatar,
      avatarColor: r.avatar_color,
      totalSpent: r.total_spent,
      purchaseCount: r.purchase_count,
    }));

    const topOffersRows = await db
      .prepare(`
        SELECT amount, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
        FROM purchases
        GROUP BY amount
        ORDER BY total DESC
        LIMIT 5
      `)
      .all() as { amount: number; count: number; total: number }[];

    const topOffers = topOffersRows.map((r) => ({
      amount: r.amount,
      purchases: r.count,
      revenue: r.total,
    }));

    return NextResponse.json({
      revenueByOffer,
      revenueBySegment,
      funnel: {
        totalContacts,
        engagedContacts,
        offersSent: totalOffers,
        uniqueBuyers: totalBuyers,
        repeatBuyers,
        whaleBuyers,
        offerConversionRate: `${conversionRate}%`,
        engagedToBuyerRate: engagedContacts > 0 ? `${Math.round((totalBuyers / engagedContacts) * 100)}%` : "0%",
        buyerToRepeatRate: `${repeatPurchaseRate}%`,
        buyerToWhaleRate: totalBuyers > 0 ? `${Math.round((whaleBuyers / totalBuyers) * 100)}%` : "0%",
      },
      reminderConversion: {
        contactsWithLockedResponses,
        purchasedAfterLockedResponse: purchasedAfterLocked,
        conversionRate: contactsWithLockedResponses > 0
          ? `${Math.round((purchasedAfterLocked / contactsWithLockedResponses) * 100)}%`
          : "0%",
      },
      reengagementConversion: {
        reengagementGapDays,
        reengagedBuyers,
      },
      repeatPurchaseRate: `${repeatPurchaseRate}%`,
      ltv: `₹${ltv}`,
      aov: `₹${aov}`,
      topBuyers,
      topOffers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Revenue analytics failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
