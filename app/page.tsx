import { cookies } from "next/headers";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { getDashboardStats, listChats } from "@/lib/db/service";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  const apiKey = process.env.CRM_API_KEY;
  if (apiKey) {
    const cookieStore = await cookies();
    if (!cookieStore.has("crm_session")) {
      cookieStore.set("crm_session", apiKey, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  const chats = listChats();
  const stats = getDashboardStats();
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
