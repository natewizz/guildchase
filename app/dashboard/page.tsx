import { DashboardView } from "@/components/dashboard-view";
import { SetupNotice } from "@/components/setup-notice";
import { shapeDashboard } from "@/lib/collection";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { DashboardPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard — MTG Lands Collection" };

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats");
  if (error) return <SetupNotice detail={error.message} />;

  const stats = shapeDashboard(data as DashboardPayload);
  return <DashboardView {...stats} />;
}
