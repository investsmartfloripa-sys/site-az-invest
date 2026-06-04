"use client";

import { useEffect, useState } from "react";

import { fetchLiveCurve, maturityLabel } from "@/lib/painel-b3-live";

export type KpiCard = {
  label: string;
  value: string;
  /** Linha pequena abaixo do valor (contexto/fonte). */
  sub?: string;
  /** Variacao do dia em % — define cor da seta; null = neutro. */
  changePct?: number | null;
  /** Cor da borda lateral: auto pela variacao se omitido. */
  accent?: "up" | "down" | "info" | "neutral";
};

type Props = {
  base: KpiCard[];
};

const ACCENT: Record<NonNullable<KpiCard["accent"]>, string> = {
  up: "border-l-[#16A34A]",
  down: "border-l-[#DC2626]",
  info: "border-l-[#027DFC]",
  neutral: "border-l-zinc-300",
};

function accentOf(card: KpiCard): string {
  if (card.accent) return ACCENT[card.accent];
  if (card.changePct == null) return ACCENT.neutral;
  return card.changePct >= 0 ? ACCENT.up : ACCENT.down;
}

function Card({ card }: { card: KpiCard }) {
  const ch = card.changePct;
  return (
    <article
      className={`min-w-0 rounded-r-xl border border-l-4 border-[#132960]/10 bg-white px-3 py-2.5 shadow-sm ${accentOf(card)}`}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{card.label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-[#132960]">{card.value}</span>
        {ch != null ? (
          <span className={`text-[11px] font-semibold ${ch >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
            {ch >= 0 ? "▲" : "▼"} {Math.abs(ch).toFixed(2)}%
          </span>
        ) : null}
      </p>
      {card.sub ? <p className="truncate text-[10px] text-zinc-400">{card.sub}</p> : null}
    </article>
  );
}

/**
 * Faixa de KPIs do Panorama. Cards base vêm do servidor (Blob);
 * um card extra de DI jan curto chega ao vivo da B3 no client.
 */
export function KpiStrip({ base }: Props) {
  const [liveCard, setLiveCard] = useState<KpiCard | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    fetchLiveCurve("DI1", ctrl.signal)
      .then((di) => {
        if (cancelled) return;
        const front = di.contracts.find((c) => /F\d{2}$/.test(c.symbol) && c.rate != null);
        if (!front) return;
        const bps = front.changeBps;
        setLiveCard({
          label: `DI ${maturityLabel(front.maturity)}`,
          value: `${(front.rate as number).toFixed(2).replace(".", ",")}%`,
          sub: bps == null ? "B3 · delay 15 min" : `${bps > 0 ? "+" : ""}${bps} bps hoje · B3 15 min`,
          changePct: null,
          accent: bps == null ? "info" : bps > 0 ? "down" : "up",
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  const cards = liveCard ? [...base, liveCard] : base;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => (
        <Card key={card.label} card={card} />
      ))}
    </div>
  );
}
