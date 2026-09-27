/**
 * Copy the owner's checkmarks from the Laravel MySQL database.
 * Matches cards by set code, collector number, and variant. Does not copy passwords.
 *
 *   npm run import-ownership
 */

import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
  console.error("Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE in .env");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const connection = await mysql.createConnection({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT || 3306),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD ?? "",
  database: MYSQL_DATABASE,
});

const { data: owner, error: ownerError } = await supabase
  .from("profiles")
  .select("id, email")
  .eq("role", "owner")
  .limit(1)
  .maybeSingle();

if (ownerError) throw ownerError;
if (!owner) {
  console.error("No Supabase profile with role = 'owner'. Promote the login user first.");
  process.exit(1);
}

const [rows] = await connection.execute(`
  select s.code, c.collector_number, c.variant_type, o.is_owned, o.quantity, o.notes
  from ownership o
  join cards c on c.id = o.card_id
  join sets s on s.id = c.set_id
  join users u on u.id = o.user_id
  where u.role = 'owner'
`);
await connection.end();

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

const payload = [];
let missed = 0;
for (const row of rows) {
  const cardId = byKey.get(`${String(row.code).toUpperCase()}|${row.collector_number}|${row.variant_type}`);
  if (!cardId) {
    missed += 1;
    continue;
  }
  payload.push({
    card_id: cardId,
    user_id: owner.id,
    is_owned: Boolean(row.is_owned),
    quantity: Number(row.quantity) || 0,
    notes: row.notes,
  });
}

for (let index = 0; index < payload.length; index += 200) {
  const batch = payload.slice(index, index + 200);
  const { error } = await supabase.from("ownership").upsert(batch, { onConflict: "card_id,user_id" });
  if (error) throw error;
}

console.log(`Imported ${payload.length} ownership row(s) for ${owner.email}. ${missed} old card(s) had no match.`);
