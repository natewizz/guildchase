import { SetSymbol } from "@/components/set-symbol";
import type { LandStat, ShapedSet, VariantStat } from "@/lib/types";
import Link from "next/link";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

export function DashboardView({
  totalCards,
  ownedCards,
  completionPercentage,
  fullyCompletedCount,
  inProgressSets,
  notStartedSets,
  variantStats,
  landStats,
  goldSets,
  silverSets,
  completedCount,
}: {
  totalCards: number;
  ownedCards: number;
  completionPercentage: number;
  fullyCompletedCount: number;
  inProgressSets: ShapedSet[];
  notStartedSets: ShapedSet[];
  variantStats: VariantStat[];
  landStats: LandStat[];
  goldSets: ShapedSet[];
  silverSets: ShapedSet[];
  completedCount: number;
}) {
  return (
    <>
      <div className="dashboard-nav">
        <h1>Dashboard</h1>
        <Link href="/" className="nav-link">← All Sets</Link>
      </div>

      <div className="panel panel-gap">
        <div className="hero-panel">
          <div>
            <div className="panel-title">Overall Collection Progress</div>
            <div className="hero-numbers">
              <span className="hero-owned">{formatCount(ownedCards)}</span>
              <span className="hero-sep">/</span>
              <span className="hero-total">{formatCount(totalCards)}</span>
              <span className="hero-pct">cards owned</span>
            </div>
            <div className="progress-bar progress-bar-hero">
              <div className="progress-fill" style={{ width: `${completionPercentage}%` }} />
            </div>
            <div className="hero-meta">
              <div className="hero-meta-item">
                <div className="hero-meta-value">{completionPercentage}%</div>
                <div className="hero-meta-label">Complete</div>
              </div>
              <div className="hero-meta-item">
                <div className="hero-meta-value">{fullyCompletedCount}</div>
                <div className="hero-meta-label">Fully Complete</div>
              </div>
              <div className="hero-meta-item">
                <div className="hero-meta-value">{inProgressSets.length}</div>
                <div className="hero-meta-label">In Progress</div>
              </div>
              <div className="hero-meta-item">
                <div className="hero-meta-value">{formatCount(totalCards - ownedCards)}</div>
                <div className="hero-meta-label">Cards Missing</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {variantStats.length > 0 ? (
        <div className="panel panel-gap">
          <div className="panel-title">Progress by Variant</div>
          <div className="rings-grid">
            {variantStats.map((stat) => (
              <div className="ring-card" key={stat.type}>
                <div className="ring-wrap">
                  <div className="ring" style={{ ["--pct" as string]: stat.percentage }}>
                    <div className="ring-inner">
                      <span className="ring-pct-text">{stat.percentage}%</span>
                      <span className="ring-fraction">{formatCount(stat.owned)}/{formatCount(stat.total)}</span>
                    </div>
                  </div>
                </div>
                <span className="ring-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {landStats.length > 0 ? (
        <div className="panel panel-gap">
          <div className="panel-title">Progress by Land Type</div>
          <div className="land-grid">
            {landStats.map((stat) => (
              <div className="land-row" key={stat.type}>
                <span className="land-name">{stat.type}</span>
                <div className="land-bar-track">
                  <div className="land-bar-fill" style={{ width: `${stat.percentage}%`, backgroundColor: stat.color }} />
                </div>
                <span className="land-pct-label">{stat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel panel-gap">
        <div className="panel-title">
          Trophy Shelf
          {completedCount > 0 ? <span className="chip">{completedCount}</span> : null}
        </div>
        {completedCount === 0 ? <div className="empty-state">No sets completed yet — keep going!</div> : null}
        {goldSets.length > 0 ? (
          <div className="trophy-section">
            <div className="trophy-tier-label gold">
              <span className="tier-icon">⬡</span>
              Commander&apos;s Vault
              <span className="trophy-tier-sub">— every variant complete</span>
              <span className="chip chip-end">{goldSets.length}</span>
            </div>
            <div className="completed-grid">
              {goldSets.map((set) => (
                <TrophyCard key={set.id} set={set} />
              ))}
            </div>
          </div>
        ) : null}
        {silverSets.length > 0 ? (
          <div className="trophy-section">
            <div className="trophy-tier-label silver">
              <span className="tier-icon">◈</span>
              The Showcase
              <span className="trophy-tier-sub">— at least one variant complete</span>
              <span className="chip chip-end">{silverSets.length}</span>
            </div>
            <div className="completed-grid">
              {silverSets.map((set) => (
                <TrophyCard key={set.id} set={set} partial />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="panel panel-gap">
        <div className="panel-title">
          In Progress
          <span className="chip">{inProgressSets.length}</span>
        </div>
        {inProgressSets.length === 0 ? <div className="empty-state">No sets in progress.</div> : (
          <div className="progress-list">
            {inProgressSets.map((set, index) => (
              <ProgressRow key={set.id} set={set} rank={String(index + 1)} />
            ))}
          </div>
        )}
      </div>

      {notStartedSets.length > 0 ? (
        <div className="panel">
          <div className="panel-title">
            Not Started
            <span className="chip">{notStartedSets.length}</span>
          </div>
          <div className="progress-list">
            {notStartedSets.map((set) => (
              <ProgressRow key={set.id} set={set} rank="—" />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function TrophyCard({ set, partial = false }: { set: ShapedSet; partial?: boolean }) {
  return (
    <Link href={`/sets/${set.id}`} className="completed-set-card">
      {set.code ? (
        <span className={`completed-set-symbol${partial ? " partial" : ""}`}>
          <SetSymbol code={set.code} />
        </span>
      ) : null}
      <span className="completed-set-name">{set.name}</span>
      <div className="completed-badges">
        {set.all_variant_details.map((detail) => (
          <span key={detail.type} className={`completed-badge ${detail.done ? "done" : "missing"}`}>
            {detail.done ? "✓" : "✕"} {detail.label}
          </span>
        ))}
      </div>
    </Link>
  );
}

function ProgressRow({ set, rank }: { set: ShapedSet; rank: string }) {
  return (
    <Link href={`/sets/${set.id}`} className="progress-list-row">
      <span className="progress-rank">{rank}</span>
      <span className="progress-set-name">
        {set.code ? <SetSymbol code={set.code} size="" /> : null}
        {set.name}
      </span>
      <div className="progress-bar-mini">
        <div className="progress-bar-mini-fill" style={{ width: `${set.completion}%` }} />
      </div>
      <span className="progress-pct">{set.owned_cards}/{set.total_cards} &nbsp; {set.completion}%</span>
    </Link>
  );
}
