import { Dashboard } from "@/components/dashboard/Dashboard";
import { getDashboardStats, listChats } from "@/lib/db/service";

export const dynamic = "force-dynamic";

export default function Home() {
  const chats = listChats();
  const stats = getDashboardStats();

  return <Dashboard initialChats={chats} initialStats={stats} />;
}
