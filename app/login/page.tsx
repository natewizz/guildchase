import { LoginForm } from "@/components/login-form";
import { SetupNotice } from "@/components/setup-notice";
import { getViewer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Login - Lands Collection" };

export default async function LoginPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const viewer = await getViewer();
  if (viewer.email) redirect("/");
  return <LoginForm />;
}
