import { SetCollection } from "@/components/set-collection";
import { SetSymbol } from "@/components/set-symbol";
import { SetupNotice } from "@/components/setup-notice";
import { filterCards, LAND_ORDER, summarizeCards, variantLabel, withImageFallback } from "@/lib/collection";
import { getViewer } from "@/lib/auth";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { CardRow } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ land_type?: string; variant_type?: string; owned?: string; search?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { id } = await params;
  const query = await searchParams;
  const setId = Number(id);
  if (!Number.isInteger(setId)) notFound();

  const supabase = await createClient();
  const [{ data: set, error: setError }, { data: cards, error: cardsError }, viewer] = await Promise.all([
    supabase.from("sets").select("id, code, name").eq("id", setId).maybeSingle(),
    supabase.rpc("set_cards", { p_set_id: setId }),
    getViewer(),
  ]);

  if (setError) return <SetupNotice detail={setError.message} />;
  if (!set) notFound();
  if (cardsError) return <SetupNotice detail={cardsError.message} />;

  const allCards = withImageFallback((cards ?? []) as CardRow[]);
  const summary = summarizeCards(allCards);
  const visible = filterCards(allCards, query);
  const variantList = Object.values(summary.variantStats);

  return (
    <>
      <div className="header">
        <Link href="/" className="back-link">← Back to Sets</Link>
        <div className="set-title">
          {set.code ? (
            <span className="set-symbol set-symbol-large">
              <SetSymbol code={set.code} size="ss-3x" />
            </span>
          ) : null}
          <div>
            <h1>{set.name}</h1>
            {set.code ? <div className="code">{set.code}</div> : null}
          </div>
        </div>
      </div>

      <SetCollection
        cards={visible}
        isOwner={viewer.isOwner}
        ownedCards={summary.owned}
        totalCards={summary.total}
        completion={summary.completion}
        variantStats={variantList}
        filters={
          <form className="filters" action={`/sets/${set.id}`}>
            <select name="land_type" defaultValue={query.land_type ?? ""}>
              <option value="">All Land Types</option>
              {LAND_ORDER.map((land) => (
                <option key={land} value={land}>{land}</option>
              ))}
            </select>
            {variantList.length > 1 ? (
              <select name="variant_type" defaultValue={query.variant_type ?? ""}>
                <option value="">All Variants</option>
                {variantList.map((stat) => (
                  <option key={stat.type} value={stat.type}>{variantLabel(stat.type)}</option>
                ))}
              </select>
            ) : null}
            <select name="owned" defaultValue={query.owned === "1" || query.owned === "0" ? query.owned : ""}>
              <option value="">All Cards</option>
              <option value="1">Owned</option>
              <option value="0">Missing</option>
            </select>
            <input type="text" name="search" placeholder="Search..." defaultValue={query.search ?? ""} />
            <button type="submit">Filter</button>
          </form>
        }
      />
    </>
  );
}
