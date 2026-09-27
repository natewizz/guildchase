/**
 * Sync basic lands from Scryfall into Supabase.
 * Ownership rows are never updated. Deletes only happen for pruned or duplicate printings,
 * and those cascade the same way the Laravel sync did.
 *
 *   npm run sync -- --discover          add sets that are not in the database yet
 *   npm run sync                        refresh sets already in the database
 *   npm run sync -- --discover --prune  first load, then drop non-commons and empty sets
 *   npm run sync -- --set=BFZ --dry-run
 */

import { createClient } from "@supabase/supabase-js";

const API = "https://api.scryfall.com";
const EXCLUDED_TYPES = ["token", "memorabilia", "minigame", "vanguard", "alchemy", "treasure_chest"];
const EXCLUDED_SETS = [
  "FBB", "4BB",
  "PMPS", "PMPS07", "PMPS08", "PMPS09", "PMPS10", "PMPS11",
  "PSAL", "PS11",
  "PDGM",
  "SLD",
];

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const opt = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const discover = has("--discover");
const dryRun = has("--dry-run");
const prune = has("--prune");
const updateImages = has("--update-images");
const onlySet = opt("set", "").toUpperCase();
const delayMs = Math.max(100, Number(opt("delay", "500")) || 500);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function landType(name) {
  const lower = name.toLowerCase();
  if (lower.includes("snow")) return "Snow";
  if (lower.includes("plains")) return "Plains";
  if (lower.includes("island")) return "Island";
  if (lower.includes("swamp")) return "Swamp";
  if (lower.includes("mountain")) return "Mountain";
  if (lower.includes("forest")) return "Forest";
  if (lower.includes("wastes")) return "Wastes";
  return "Plains";
}

function finishToVariant(finish, isFullArt) {
  if (finish === "nonfoil" && !isFullArt) return "regular";
  if (finish === "nonfoil" && isFullArt) return "full_art";
  if ((finish === "foil" || finish === "etched") && !isFullArt) return "foil_regular";
  if ((finish === "foil" || finish === "etched") && isFullArt) return "foil_full_art";
  return null;
}

function numericCollector(value) {
  const match = String(value).match(/^(\d+)/);
  return match ? Number(match[1]) : Number(value);
}

function isExtraShowcase(card, printings) {
  if (!card.full_art) return false;
  const type = landType(card.name);
  const number = numericCollector(card.collector_number);
  return printings.some((other) => {
    if (other.collector_number === card.collector_number) return false;
    if (!other.full_art) return false;
    if (landType(other.name) !== type) return false;
    return numericCollector(other.collector_number) < number;
  });
}

function imageUrl(card) {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
}

async function scryfall(pathOrUrl) {
  const target = pathOrUrl.startsWith("http") ? pathOrUrl : `${API}${pathOrUrl}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(attempt === 0 ? delayMs : 2000);
    const response = await fetch(target, {
      headers: { "User-Agent": "GuildChase/1.0", Accept: "application/json" },
    });
    if (response.status !== 429) return response;
    console.warn("        Rate limited — retrying");
  }
  throw new Error(`Scryfall rate limit persisted for ${target}`);
}

async function fetchBasics(setCode) {
  const cards = [];
  let next = `/cards/search?${new URLSearchParams({
    q: `type:basic lang:en set:${setCode}`,
    unique: "prints",
    order: "collector_number",
  })}`;

  while (next) {
    const response = await scryfall(next);
    if (response.status === 404) return [];
    if (!response.ok) {
      console.warn(`        API error ${response.status} for ${setCode}`);
      return cards;
    }
    const body = await response.json();
    cards.push(...(body.data ?? []));
    next = body.has_more ? body.next_page : null;
  }
  return cards;
}

function printableCards(cards) {
  return cards.filter((card) =>
    !card.digital
    && !String(card.collector_number ?? "").includes("★")
    && (card.lang ?? "en") === "en"
  );
}

function rowsFromCards(setId, cards) {
  const syncable = cards.filter((card) => !isExtraShowcase(card, cards));
  const skipped = [...new Set(cards.filter((card) => isExtraShowcase(card, cards)).map((card) => card.collector_number))];
  const rows = new Map();

  for (const card of syncable) {
    const fullArt = Boolean(card.full_art);
    for (const finish of card.finishes ?? ["nonfoil"]) {
      const variant = finishToVariant(finish, fullArt);
      if (!variant) continue;
      const key = `${card.collector_number}|${variant}`;
      rows.set(key, {
        set_id: setId,
        collector_number: card.collector_number,
        name: card.name,
        artist: card.artist ?? "",
        land_type: landType(card.name),
        variant_type: variant,
        image_url: imageUrl(card),
        rarity: card.rarity ?? null,
      });
    }
  }

  return { rows: [...rows.values()], skipped };
}

async function fetchAll(table, select, filter) {
  const rows = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select(select);
    if (filter) query = filter(query);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function loadSets() {
  const sets = await fetchAll("sets", "id, code, name");
  return sets.filter((set) => set.code && !EXCLUDED_SETS.includes(set.code.toUpperCase()));
}

async function discoverSets() {
  console.log("Fetching the Scryfall set catalogue…");
  const response = await scryfall("/sets");
  if (!response.ok) throw new Error(`Sets endpoint returned ${response.status}`);
  const body = await response.json();
  const existing = new Set((await loadSets()).map((set) => set.code.toUpperCase()));
  const candidates = (body.data ?? []).filter((set) => {
    const code = String(set.code ?? "").toUpperCase();
    if (set.digital) return false;
    if (EXCLUDED_TYPES.includes(set.set_type)) return false;
    if (EXCLUDED_SETS.includes(code)) return false;
    if (existing.has(code)) return false;
    if (onlySet && code !== onlySet) return false;
    return true;
  });

  console.log(`${candidates.length} new sets to check.`);
  let added = 0;
  for (const candidate of candidates) {
    const code = candidate.code.toUpperCase();
    console.log(`  [${code}] ${candidate.name}`);
    const cards = printableCards(await fetchBasics(candidate.code));
    if (cards.length === 0) {
      console.log("        → no paper basics");
      continue;
    }
    console.log(`        → ${cards.length} basic land card(s)`);
    if (dryRun) {
      added += 1;
      continue;
    }
    const { data: created, error } = await supabase.from("sets").insert({
      code,
      name: candidate.name,
      release_date: candidate.released_at ?? null,
      is_active: true,
    }).select("id, code, name").single();
    if (error) throw error;
    await writeCards(created, cards, new Map());
    added += 1;
  }
  console.log(`Discovered ${added} set(s).`);
}

async function writeCards(set, scryfallCards, existing) {
  const { rows, skipped } = rowsFromCards(set.id, scryfallCards);
  if (skipped.length > 0) {
    console.log(`        → skipping showcase duplicate(s): #${skipped.join(", #")}`);
    if (!dryRun) {
      const { error } = await supabase.from("cards").delete().eq("set_id", set.id).in("collector_number", skipped);
      if (error) throw error;
    }
  }

  const inserts = [];
  let updated = 0;
  let unchanged = 0;

  for (const row of rows) {
    const current = existing.get(`${row.collector_number}|${row.variant_type}`);
    if (!current) {
      inserts.push(row);
      continue;
    }
    const changes = {};
    if (current.name !== row.name) changes.name = row.name;
    if (current.artist !== row.artist) changes.artist = row.artist;
    if (current.land_type !== row.land_type) changes.land_type = row.land_type;
    if (row.rarity && current.rarity !== row.rarity) changes.rarity = row.rarity;
    if (!current.image_url && row.image_url) changes.image_url = row.image_url;
    if (updateImages && row.image_url && current.image_url !== row.image_url) changes.image_url = row.image_url;
    if (Object.keys(changes).length === 0) {
      unchanged += 1;
      continue;
    }
    updated += 1;
    if (!dryRun) {
      const { error } = await supabase.from("cards").update(changes).eq("id", current.id);
      if (error) throw error;
    }
  }

  if (!dryRun) {
    for (let index = 0; index < inserts.length; index += 200) {
      const batch = inserts.slice(index, index + 200);
      const { error } = await supabase.from("cards").insert(batch);
      if (error) throw error;
    }
  }

  console.log(`        → ${inserts.length} added, ${updated} updated, ${unchanged} unchanged`);
}

async function syncExisting() {
  let sets = await loadSets();
  if (onlySet) sets = sets.filter((set) => set.code.toUpperCase() === onlySet);
  if (sets.length === 0) {
    console.log("No sets to sync. Run with --discover first.");
    return;
  }

  for (const set of sets) {
    console.log(`  [${set.code}] ${set.name}`);
    const cards = printableCards(await fetchBasics(set.code));
    if (cards.length === 0) {
      console.log("        → no paper basics found");
      continue;
    }
    const stored = await fetchAll(
      "cards",
      "id, collector_number, variant_type, name, artist, land_type, image_url, rarity",
      (query) => query.eq("set_id", set.id),
    );
    const existing = new Map(stored.map((card) => [`${card.collector_number}|${card.variant_type}`, card]));
    await writeCards(set, cards, existing);
  }
}

if (dryRun) console.log("DRY RUN — no database changes will be made.");
if (discover) await discoverSets();
if (!discover || has("--sync")) await syncExisting();
if (prune) {
  if (dryRun) {
    console.log("Prune skipped during dry run.");
  } else {
    const { data, error } = await supabase.rpc("prune_catalog");
    if (error) throw error;
    console.log("Pruned catalog:", data);
  }
}
console.log(dryRun ? "Dry run finished." : "Sync finished.");
