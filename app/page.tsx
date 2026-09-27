import { SetupNotice } from "@/components/setup-notice";
import { SetSymbol } from "@/components/set-symbol";
import { completionPercent, shapeSet } from "@/lib/collection";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { DashboardPayload } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search = "" } = await searchParams;
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats");
  if (error) return <SetupNotice detail={error.message} />;

  const query = search.trim().toLowerCase();
  const payload = data as DashboardPayload;
  const sets = (payload.sets ?? [])
    .map(shapeSet)
    .filter((set) => set.total_cards > 0)
    .filter((set) => {
      if (!query) return true;
      return set.name.toLowerCase().includes(query) || (set.code ?? "").toLowerCase().includes(query);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <h1>MTG Basic Lands Collection</h1>
      <div className="search-box">
        <form>
          <input type="text" name="search" placeholder="Search sets..." defaultValue={search} />
        </form>
      </div>
      {sets.length === 0 ? (
        <p className="empty-state">No sets yet. Run the Scryfall sync after the database is connected.</p>
      ) : (
        <div className="sets-grid">
          {sets.map((set) => {
            const percent = completionPercent(set.owned_cards, set.total_cards);
            return (
              <Link href={`/sets/${set.id}`} key={set.id}>
                <div className="set-card">
                  <div className="set-card-header">
                    {set.code ? <span className="set-symbol"><SetSymbol code={set.code} /></span> : null}
                    <h2>{set.name}</h2>
                  </div>
                  {set.code ? <div className="code">{set.code}</div> : null}
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="stats">
                    <span>{set.owned_cards} / {set.total_cards}</span>
                    <span>{percent}%</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
