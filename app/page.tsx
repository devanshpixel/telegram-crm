import { Dashboard } from "@/components/dashboard/Dashboard";
import { getDashboardStats, listChats } from "@/lib/db/service";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  const chats = await listChats();
  const stats = await getDashboardStats();
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
