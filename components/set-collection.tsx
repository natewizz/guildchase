"use client";

import { toggleOwned } from "@/app/actions";
import type { CardRow, VariantStat } from "@/lib/types";
import { useState } from "react";

type VariantState = {
  total: number;
  owned: number;
  percentage: number;
  label: string;
};

export function SetCollection({
  cards,
  isOwner,
  ownedCards,
  totalCards,
  completion,
  variantStats,
  filters,
}: {
  cards: CardRow[];
  isOwner: boolean;
  ownedCards: number;
  totalCards: number;
  completion: number;
  variantStats: VariantStat[];
  filters?: React.ReactNode;
}) {
  const [ownedById, setOwnedById] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(cards.map((card) => [card.id, card.is_owned])),
  );
  const [stats, setStats] = useState({ owned: ownedCards, total: totalCards, completion });
  const [variants, setVariants] = useState<Record<string, VariantState>>(() =>
    Object.fromEntries(variantStats.map((stat) => [stat.type, stat])),
  );
  const [preview, setPreview] = useState<{ src: string; x: number; y: number } | null>(null);
  const [toast, setToast] = useState<{ tier: "gold" | "silver"; message: string } | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  function showPromotion(tier: "gold" | "silver", message: string) {
    setToast(null);
    window.setTimeout(() => {
      setToast({ tier, message });
      window.setTimeout(() => setToast(null), 4000);
    }, 20);
  }

  function positionPreview(event: React.MouseEvent, src: string) {
    const previewWidth = 240;
    const gap = 18;
    let x = event.clientX + gap;
    let y = event.clientY - 120;
    if (x + previewWidth > window.innerWidth) x = event.clientX - previewWidth - gap;
    if (y + 336 > window.innerHeight) y = window.innerHeight - 336 - gap;
    if (y < gap) y = gap;
    setPreview({ src, x, y });
  }

  async function onToggle(cardId: number, nextChecked: boolean) {
    const previous = ownedById[cardId] ?? false;
    const prevComplete = Object.fromEntries(
      Object.entries(variants).map(([type, stat]) => [type, stat.percentage >= 100]),
    );
    setOwnedById((current) => ({ ...current, [cardId]: nextChecked }));
    setPendingId(cardId);

    const result = await toggleOwned(cardId);
    setPendingId(null);

    if (!result.success || !result.setStats || !result.variantStats) {
      setOwnedById((current) => ({ ...current, [cardId]: previous }));
      if (result.error === "Authentication required") {
        window.location.href = "/login";
        return;
      }
      window.alert(result.error ?? "Failed to update ownership");
      return;
    }

    setStats({
      owned: result.setStats.owned,
      total: result.setStats.total,
      completion: result.setStats.completion,
    });
    setVariants((current) => {
      const next = { ...current };
      for (const [type, stat] of Object.entries(result.variantStats ?? {})) {
        if (!next[type]) continue;
        next[type] = { ...next[type], ...stat };
      }
      return next;
    });
    setOwnedById((current) => ({ ...current, [cardId]: result.isOwned ?? nextChecked }));

    const entries = Object.entries(result.variantStats);
    const anyNewlyDone = entries.some(([type, stat]) => stat.percentage >= 100 && !prevComplete[type]);
    if (anyNewlyDone) {
      const allDone = entries.every(([, stat]) => stat.percentage >= 100);
      if (allDone) showPromotion("gold", "⬡ Commander's Vault — every variant complete!");
      else showPromotion("silver", "◈ The Showcase — variant complete!");
    }
  }

  return (
    <>
      <div className="stats-bar">
        <div className="stats-bar-row">
          <span><strong>{stats.owned}</strong> / <strong>{stats.total}</strong> cards owned</span>
          <span><strong>{stats.completion}%</strong> complete</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${stats.completion}%` }} />
        </div>
      </div>

      {Object.keys(variants).length > 0 ? (
        <div className="variant-stats">
          <h2 className="section-label">Progress by Variant</h2>
          <div className="variant-progress-grid">
            {Object.entries(variants).map(([type, stat]) => (
              <div className="variant-progress-card" data-variant={type} key={type}>
                <div className="variant-progress-head">
                  <span className="variant-name">{stat.label}</span>
                  <span className="variant-owned">{stat.owned} / {stat.total}</span>
                </div>
                <div className="progress-bar progress-bar-tall">
                  <div className="progress-fill" style={{ width: `${stat.percentage}%` }} />
                </div>
                <div className="variant-percentage-row">
                  <span className="variant-percentage">{stat.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {filters}

      {cards.length === 0 ? <p className="empty-state">No cards match these filters.</p> : (
      <table className="cards-table">
        <thead>
          <tr>
            <th className="card-thumb-cell" />
            <th>#</th>
            <th>Name</th>
            <th>Variant</th>
            <th>Artist</th>
            <th>Status</th>
            {isOwner ? <th>Edit</th> : null}
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const owned = ownedById[card.id] ?? false;
            return (
              <tr key={card.id} className={owned ? "card-owned" : "card-missing"}>
                <td className="card-thumb-cell">
                  {card.image_url ? (
                    <img
                      className="card-thumb"
                      src={card.image_url}
                      alt={card.name}
                      loading="lazy"
                      onMouseEnter={(event) => positionPreview(event, card.image_url!)}
                      onMouseMove={(event) => positionPreview(event, card.image_url!)}
                      onMouseLeave={() => setPreview(null)}
                    />
                  ) : (
                    <div className="card-thumb-placeholder" />
                  )}
                </td>
                <td>{card.collector_number}</td>
                <td>{card.name}</td>
                <td><span className="variant-badge">{card.variant_type.replaceAll("_", " ")}</span></td>
                <td>{card.artist}</td>
                <td>
                  {owned ? (
                    <span className="owned-badge" title="Owned"><span className="mark-owned">✓</span> Owned</span>
                  ) : (
                    <span className="missing-badge" title="Missing"><span className="mark-missing">✗</span> Missing</span>
                  )}
                </td>
                {isOwner ? (
                  <td>
                    <input
                      type="checkbox"
                      className="owned-checkbox"
                      checked={owned}
                      disabled={pendingId === card.id}
                      aria-label={`Toggle owned for ${card.name} ${card.collector_number}`}
                      onChange={(event) => onToggle(card.id, event.target.checked)}
                    />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      )}

      {preview ? (
        <div className="card-preview-popup" style={{ left: preview.x, top: preview.y, display: "block" }}>
          <img src={preview.src} alt="Card preview" />
        </div>
      ) : null}
      <div className={`promotion-toast${toast ? ` ${toast.tier} show` : ""}`}>
        {toast?.message}
      </div>
    </>
  );
}
