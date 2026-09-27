import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function getViewer() {
  if (!isSupabaseConfigured()) {
    return { email: null as string | null, isOwner: false };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { email: null, isOwner: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    email: user.email ?? null,
    isOwner: profile?.role === "owner",
  };
}
