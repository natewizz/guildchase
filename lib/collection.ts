import type {
  CardRow,
  DashboardPayload,
  LandStat,
  RawSet,
  ShapedSet,
  VariantStat,
} from "@/lib/types";

export const VARIANT_ORDER = ["regular", "full_art", "foil_regular", "foil_full_art"] as const;

export const VARIANT_LABELS: Record<string, string> = {
  regular: "Regular",
  full_art: "Full Art",
  foil_regular: "Foil Regular",
  foil_full_art: "Foil Full Art",
};

export const LAND_ORDER = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes", "Snow"] as const;

export const LAND_COLORS: Record<string, string> = {
  Plains: "#f5e6a3",
  Island: "#4a9eff",
  Swamp: "#9b6dbd",
  Mountain: "#ef4444",
  Forest: "#22c55e",
  Wastes: "#9ca3af",
  Snow: "#bfdbfe",
};

export function completionPercent(owned: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((owned / total) * 1000) / 10;
}

export function variantLabel(type: string): string {
  return VARIANT_LABELS[type] ?? type.replaceAll("_", " ");
}

export function shapeSet(set: RawSet): ShapedSet {
  const total = Number(set.total_cards) || 0;
  const owned = Number(set.owned_cards) || 0;
  const counts = new Map((set.variants ?? []).map((variant) => [variant.type, variant]));
  const details = VARIANT_ORDER.flatMap((type) => {
    const count = counts.get(type);
    const variantTotal = Number(count?.total) || 0;
    if (variantTotal === 0) return [];
    const variantOwned = Number(count?.owned) || 0;
    return [{ type, label: variantLabel(type), done: variantOwned >= variantTotal }];
  });
  const completed = details.filter((detail) => detail.done);

  return {
    id: Number(set.id),
    code: set.code,
    name: set.name,
    total_cards: total,
    owned_cards: owned,
    completion: completionPercent(owned, total),
    all_variant_details: details,
    is_complete: completed.length > 0,
    all_variants_complete: details.length > 0 && completed.length === details.length,
  };
}

export function shapeDashboard(payload: DashboardPayload) {
  const sets = (payload.sets ?? []).map(shapeSet).filter((set) => set.total_cards > 0);
  const variantCounts = new Map((payload.variants ?? []).map((variant) => [variant.type, variant]));
  const variantStats: VariantStat[] = VARIANT_ORDER.flatMap((type) => {
    const count = variantCounts.get(type);
    const total = Number(count?.total) || 0;
    if (total === 0) return [];
    const owned = Number(count?.owned) || 0;
    return [{ type, label: variantLabel(type), total, owned, percentage: completionPercent(owned, total) }];
  });

  const landCounts = new Map((payload.lands ?? []).map((land) => [land.type, land]));
  const landStats: LandStat[] = LAND_ORDER.flatMap((type) => {
    const count = landCounts.get(type);
    const total = Number(count?.total) || 0;
    if (total === 0) return [];
    const owned = Number(count?.owned) || 0;
    return [{
      type,
      total,
      owned,
      percentage: completionPercent(owned, total),
      color: LAND_COLORS[type] ?? "#888",
    }];
  });

  const completedSets = sets.filter((set) => set.is_complete);
  const goldSets = completedSets.filter((set) => set.all_variants_complete).sort((a, b) => a.name.localeCompare(b.name));
  const silverSets = completedSets.filter((set) => !set.all_variants_complete).sort((a, b) => a.name.localeCompare(b.name));
  const inProgressSets = sets
    .filter((set) => set.completion > 0 && !set.all_variants_complete)
    .sort((a, b) => b.completion - a.completion);
  const notStartedSets = sets.filter((set) => set.completion === 0).sort((a, b) => a.name.localeCompare(b.name));
  const totalCards = sets.reduce((sum, set) => sum + set.total_cards, 0);
  const ownedCards = sets.reduce((sum, set) => sum + set.owned_cards, 0);

  return {
    variantStats,
    landStats,
    goldSets,
    silverSets,
    completedCount: completedSets.length,
    fullyCompletedCount: sets.filter((set) => set.all_variants_complete).length,
    inProgressSets,
    notStartedSets,
    totalCards,
    ownedCards,
    completionPercentage: completionPercent(ownedCards, totalCards),
  };
}

export function summarizeCards(cards: CardRow[]) {
  const total = cards.length;
  const owned = cards.filter((card) => card.is_owned).length;
  const variantStats: Record<string, VariantStat> = {};

  for (const type of VARIANT_ORDER) {
    const group = cards.filter((card) => card.variant_type === type);
    if (group.length === 0) continue;
    const groupOwned = group.filter((card) => card.is_owned).length;
    variantStats[type] = {
      type,
      total: group.length,
      owned: groupOwned,
      percentage: completionPercent(groupOwned, group.length),
      label: variantLabel(type),
    };
  }

  return {
    total,
    owned,
    completion: completionPercent(owned, total),
    variantStats,
  };
}

export function withImageFallback(cards: CardRow[]): CardRow[] {
  const images = new Map<string, string>();
  for (const card of cards) {
    if (card.image_url && !images.has(card.collector_number)) {
      images.set(card.collector_number, card.image_url);
    }
  }
  return cards.map((card) => {
    if (card.image_url) return card;
    return { ...card, image_url: images.get(card.collector_number) ?? null };
  });
}

export function compareCollectorNumber(a: string, b: string): number {
  const left = Number.parseInt(a, 10);
  const right = Number.parseInt(b, 10);
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
  return a.localeCompare(b);
}

export function filterCards(
  cards: CardRow[],
  query: { land_type?: string; variant_type?: string; owned?: string; search?: string },
): CardRow[] {
  const search = query.search?.trim().toLowerCase() ?? "";
  return cards
    .filter((card) => {
      if (query.land_type && card.land_type !== query.land_type) return false;
      if (query.variant_type && card.variant_type !== query.variant_type) return false;
      if (query.owned === "1" && !card.is_owned) return false;
      if (query.owned === "0" && card.is_owned) return false;
      if (!search) return true;
      const haystack = `${card.collector_number} ${card.name} ${card.artist}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => {
      const byNumber = compareCollectorNumber(a.collector_number, b.collector_number);
      if (byNumber !== 0) return byNumber;
      return VARIANT_ORDER.indexOf(a.variant_type) - VARIANT_ORDER.indexOf(b.variant_type);
    });
}
