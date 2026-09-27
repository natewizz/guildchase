export type LandType = "Plains" | "Island" | "Swamp" | "Mountain" | "Forest" | "Wastes" | "Snow";

export type VariantType = "regular" | "full_art" | "foil_regular" | "foil_full_art";

export type VariantCount = {
  type: string;
  total: number;
  owned: number;
};

export type RawSet = {
  id: number;
  code: string | null;
  name: string;
  total_cards: number;
  owned_cards: number;
  variants: VariantCount[] | null;
};

export type VariantDetail = {
  type: string;
  label: string;
  done: boolean;
};

export type ShapedSet = {
  id: number;
  code: string | null;
  name: string;
  total_cards: number;
  owned_cards: number;
  completion: number;
  all_variant_details: VariantDetail[];
  is_complete: boolean;
  all_variants_complete: boolean;
};

export type LandStat = {
  type: string;
  total: number;
  owned: number;
  percentage: number;
  color: string;
};

export type VariantStat = {
  type: string;
  label: string;
  total: number;
  owned: number;
  percentage: number;
};

export type CardRow = {
  id: number;
  collector_number: string;
  name: string;
  artist: string;
  land_type: LandType;
  variant_type: VariantType;
  image_url: string | null;
  is_owned: boolean;
};

export type DashboardPayload = {
  sets: RawSet[];
  variants: VariantCount[];
  lands: { type: string; total: number; owned: number }[];
};

export type ToggleResult = {
  success: boolean;
  error?: string;
  isOwned?: boolean;
  setStats?: { owned: number; total: number; completion: number };
  variantStats?: Record<string, { total: number; owned: number; percentage: number }>;
};
