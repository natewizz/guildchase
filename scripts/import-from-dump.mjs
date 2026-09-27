/**
 * Copy owned cards from a phpMyAdmin dump of the old lands database.
 * Matches on set code, collector number, and variant. Ignores passwords.
 *
 *   node --env-file=.env scripts/import-from-dump.mjs gethzlpy_lands.sql
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2] ?? "gethzlpy_lands.sql";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const sets = rowsFor(sql, "sets");
const cards = rowsFor(sql, "cards");
const users = rowsFor(sql, "users");
const ownership = rowsFor(sql, "ownership");

const owner = users.find((row) => row[3] === "owner");
if (!owner) {
  console.error("No owner user in the dump.");
  process.exit(1);
}

const setCode = new Map(sets.map((row) => [String(row[0]), String(row[1] ?? "").toUpperCase()]));
const cardKey = new Map(cards.map((row) => {
  const code = setCode.get(String(row[1])) ?? "";
  return [String(row[0]), `${code}|${row[2]}|${row[6]}`];
}));

const wanted = ownership.filter((row) => String(row[2]) === String(owner[0]));
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: profile, error: ownerError } = await supabase
  .from("profiles")
  .select("id, email")
  .eq("role", "owner")
  .limit(1)
  .maybeSingle();
if (ownerError) throw ownerError;
if (!profile) {
  console.error("No Supabase profile with role = 'owner'.");
  process.exit(1);
}

const catalog = [];
let from = 0;
while (true) {
  const { data, error } = await supabase
    .from("cards")
    .select("id, collector_number, variant_type, sets(code)")
    .range(from, from + 999);
  if (error) throw error;
  catalog.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}

const byKey = new Map(catalog.map((card) => {
  const code = card.sets?.code?.toUpperCase() ?? "";
  return [`${code}|${card.collector_number}|${card.variant_type}`, card.id];
}));

const dumpCard = new Map(cards.map((row) => [String(row[0]), row]));
const liveSets = [];
from = 0;
while (true) {
  const { data, error } = await supabase.from("sets").select("id, code, is_active").range(from, from + 999);
  if (error) throw error;
  liveSets.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}
const setByCode = new Map(liveSets.map((set) => [String(set.code).toUpperCase(), set]));
const codeBySetId = new Map(liveSets.map((set) => [set.id, String(set.code).toUpperCase()]));

const pending = [];
const seen = new Set();
for (const dump of cards) {
  const code = setCode.get(String(dump[1]));
  const liveSet = code ? setByCode.get(code) : undefined;
  const rarity = dump[8];
  if (!liveSet?.is_active || (rarity && rarity !== "common")) continue;
  const lookup = `${code}|${dump[2]}|${dump[6]}`;
  if (byKey.has(lookup) || seen.has(lookup)) continue;
  seen.add(lookup);
  pending.push({
    set_id: liveSet.id,
    collector_number: dump[2],
    name: dump[3],
    artist: dump[4],
    land_type: dump[5],
    variant_type: dump[6],
    image_url: dump[7],
    rarity,
  });
}

let catalogAdded = 0;
for (let index = 0; index < pending.length; index += 200) {
  const batch = pending.slice(index, index + 200);
  const { data, error } = await supabase.from("cards").insert(batch).select("id, set_id, collector_number, variant_type");
  if (error) throw error;
  for (const card of data) {
    const code = codeBySetId.get(card.set_id) ?? "";
    byKey.set(`${code}|${card.collector_number}|${card.variant_type}`, card.id);
  }
  catalogAdded += data.length;
}

const payload = [];
let skipped = 0;
let added = 0;
for (const row of wanted) {
  const lookup = cardKey.get(String(row[1]));
  let cardId = lookup ? byKey.get(lookup) : undefined;
  if (!cardId) {
    const dump = dumpCard.get(String(row[1]));
    const code = dump ? setCode.get(String(dump[1])) : "";
    const liveSet = code ? setByCode.get(code) : undefined;
    const rarity = dump?.[8];
    if (!dump || !liveSet?.is_active || (rarity && rarity !== "common")) {
      skipped += 1;
      continue;
    }
    const { data, error } = await supabase.from("cards").insert({
      set_id: liveSet.id,
      collector_number: dump[2],
      name: dump[3],
      artist: dump[4],
      land_type: dump[5],
      variant_type: dump[6],
      image_url: dump[7],
      rarity: rarity,
    }).select("id").single();
    if (error) throw error;
    cardId = data.id;
    byKey.set(lookup, cardId);
    added += 1;
  }
  payload.push({
    card_id: cardId,
    user_id: profile.id,
    is_owned: Number(row[4]) === 1,
    quantity: Number(row[3]) || 0,
    notes: row[5],
  });
}

for (let index = 0; index < payload.length; index += 200) {
  const batch = payload.slice(index, index + 200);
  const { error } = await supabase.from("ownership").upsert(batch, { onConflict: "card_id,user_id" });
  if (error) throw error;
}

const owned = payload.filter((row) => row.is_owned).length;
console.log(`Imported ${payload.length} ownership row(s) for ${profile.email}. ${owned} marked owned. Added ${catalogAdded + added} card(s) from the old catalog. Skipped ${skipped}.`);

function rowsFor(source, table) {
  const rows = [];
  const needle = `INSERT INTO \`${table}\``;
  let cursor = 0;
  while (true) {
    const start = source.indexOf(needle, cursor);
    if (start === -1) break;
    const valuesAt = source.indexOf("VALUES", start);
    let index = valuesAt + "VALUES".length;
    while (index < source.length) {
      while (source[index] === " " || source[index] === "\n" || source[index] === "\r" || source[index] === ",") index += 1;
      if (source[index] === ";") break;
      if (source[index] !== "(") break;
      const parsed = parseTuple(source, index);
      rows.push(parsed.row);
      index = parsed.next;
    }
    cursor = index;
  }
  return rows;
}

function parseTuple(source, start) {
  const fields = [];
  let index = start + 1;
  while (index < source.length) {
    while (source[index] === " " || source[index] === "\n" || source[index] === "\r") index += 1;
    if (source[index] === ")") return { row: fields, next: index + 1 };
    if (source.startsWith("NULL", index)) {
      fields.push(null);
      index += 4;
    } else if (source[index] === "'") {
      let value = "";
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          value += source[index + 1];
          index += 2;
          continue;
        }
        if (source[index] === "'" && source[index + 1] === "'") {
          value += "'";
          index += 2;
          continue;
        }
        if (source[index] === "'") {
          index += 1;
          break;
        }
        value += source[index];
        index += 1;
      }
      fields.push(value);
    } else {
      let end = index;
      while (end < source.length && source[end] !== "," && source[end] !== ")") end += 1;
      fields.push(source.slice(index, end).trim());
      index = end;
    }
    while (source[index] === " " || source[index] === "\n" || source[index] === "\r") index += 1;
    if (source[index] === ",") index += 1;
  }
  return { row: fields, next: index };
}
