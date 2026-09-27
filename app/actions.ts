"use server";

import { summarizeCards } from "@/lib/collection";
import { createClient } from "@/lib/supabase/server";
import type { CardRow, ToggleResult } from "@/lib/types";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const message = error.message === "Invalid login credentials"
      ? "The provided credentials do not match our records."
      : error.message;
    return { error: message };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function toggleOwned(cardId: number): Promise<ToggleResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Authentication required" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner") return { success: false, error: "Unauthorized" };

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, set_id")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError || !card) return { success: false, error: "Card not found" };

  const { data: existing } = await supabase
    .from("ownership")
    .select("is_owned")
    .eq("card_id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isOwned = !(existing?.is_owned ?? false);
  const { error: writeError } = await supabase.from("ownership").upsert(
    {
      card_id: cardId,
      user_id: user.id,
      is_owned: isOwned,
      quantity: isOwned ? 1 : 0,
    },
    { onConflict: "card_id,user_id" },
  );

  if (writeError) return { success: false, error: writeError.message };

  const { data: rows, error: statsError } = await supabase.rpc("set_cards", { p_set_id: card.set_id });
  if (statsError) return { success: false, error: statsError.message };

  const summary = summarizeCards((rows ?? []) as CardRow[]);
  const variantStats: NonNullable<ToggleResult["variantStats"]> = {};
  for (const [type, stats] of Object.entries(summary.variantStats)) {
    variantStats[type] = {
      total: stats.total,
      owned: stats.owned,
      percentage: stats.percentage,
    };
  }

  return {
    success: true,
    isOwned,
    setStats: {
      owned: summary.owned,
      total: summary.total,
      completion: summary.completion,
    },
    variantStats,
  };
}
