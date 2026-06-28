import { Dashboard } from "@/components/dashboard/Dashboard";
import { getDashboardStats, listChats } from "@/lib/db/service";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  let chats: import("@/types").Chat[] = [];
  let stats: import("@/types").DashboardStats = { totalChats: 0, onlineCount: 0, totalRevenue: 0, unreadTotal: 0 };
  try {
    [chats, stats] = await Promise.all([listChats(), getDashboardStats()]);
  } catch (e: unknown) {
    console.error("[PAGE] Home data load failed:", e instanceof Error ? e.message : String(e));
    chats = [];
    stats = { totalChats: 0, onlineCount: 0, totalRevenue: 0, unreadTotal: 0 };
  }
  const params = await searchParams;
  const requestedContactId =
    typeof params.contact === "string" ? params.contact : undefined;

  return (
    <Dashboard
      initialChats={chats}
      initialStats={stats}
      requestedContactId={requestedContactId}
    />
  );
}
