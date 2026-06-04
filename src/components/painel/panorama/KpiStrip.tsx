"use client";

import { useEffect, useState } from "react";

import { fetchIndexQuote, fetchLiveCurve } from "@/lib/painel-b3-live";

export type KpiCard = {
  id: string;
  label: string;
  /** Valor principal (nominal/nivel), ja formatado. */
  value: string;
  /** Variacao formatada (ex.: "+0,85%" ou "−25 bps") exibida colorida ao lado do valor. */
  change?: string | null;
  /** Direcao da variacao p/ cor: up=verde, flat=azul, down=vermelho. */
  direction?: "up" | "down" | "flat" | null;
  /** Linha pequena de contexto/fonte. */
  sub?: string;
};

type Props = {
  base: KpiCard[];
};

const TONE: Record<NonNullable<KpiCard["direction"]>, { text: string; border: string }> = {
  up: { text: "text-[#16A34A]", border: "border-l-[#16A34A]" },
  down: { text: "text-[#DC2626]", border: "border-l-[#DC2626]" },
  flat: { text: "text-[#027DFC]", border: "border-l-[#027DFC]" },
};

/** Direcao por variacao percentual: |v| < 0.03% conta como "no zero" (azul). */
export function directionOf(changePct: number | null | undefined, flatBand = 0.03): KpiCard["direction"] {
  if (changePct == null || !Number.isFinite(changePct)) return null;
  if (Math.abs(changePct) < flatBand) return "flat";
  return changePct > 0 ? "up" : "down";
}

function Card({ card }: { card: KpiCard }) {
  const tone = card.direction ? TONE[card.direction] : { text: "text-zinc-400", border: "border-l-zinc-300" };
  return (
    <article
      className={`min-w-0 rounded-r-xl border border-l-4 border-[#132960]/10 bg-white px-3 py-2.5 shadow-sm ${tone.border}`}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{card.label}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-lg font-semibold tabular-nums text-[#132960]">{card.value}</span>
        {card.change ? (
          <span className={`text-[11px] font-semibold tabular-nums ${tone.text}`}>{card.change}</span>
        ) : null}
      </p>
      {card.sub ? <p className="truncate text-[10px] text-zinc-400">{card.sub}</p> : null}
    </article>
  );
}

/**
 * Faixa de KPIs do Panorama. Ordem fixa definida editorialmente:
 * Dolar · Bolsa · S&P · Selic · Tesouro 32 · T-bill curta · T10.
 * Bolsa (IBOV) e Tesouro 32 (DI1F32) chegam ao vivo da B3 no client;
 * os demais vem do servidor (Blob/SGS/FRED).
 */
export function KpiStrip({ base }: Props) {
  const [live, setLive] = useState<Record<string, KpiCard>>({});

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    async function load() {
      const next: Record<string, KpiCard> = {};
      try {
        const ibov = await fetchIndexQuote("IBOV", ctrl.signal);
        if (ibov) {
          next["bolsa"] = {
            id: "bolsa",
            label: "Ibovespa",
            value: ibov.last.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
            change: ibov.changePct != null ? `${ibov.changePct >= 0 ? "+" : "−"}${Math.abs(ibov.changePct).toFixed(2).replace(".", ",")}%` : null,
            direction: directionOf(ibov.changePct),
            sub: ibov.isToday ? "pts · B3 ~15 min" : "pts · último fechamento B3",
          };
        }
      } catch {
        // mantem card server
      }
      try {
        const di = await fetchLiveCurve("DI1", ctrl.signal);
        const f32 = di.contracts.find((c) => c.symbol === "DI1F32" && c.rate != null);
        if (f32) {
          const bps = f32.changeBps;
          next["tesouro32"] = {
            id: "tesouro32",
            label: "Tesouro 2032 (DI)",
            value: `${(f32.rate as number).toFixed(2).replace(".", ",")}%`,
            change: bps != null ? `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${Math.abs(bps)} bps` : null,
            direction: bps == null ? null : Math.abs(bps) < 1 ? "flat" : bps > 0 ? "up" : "down",
            sub: di.isToday ? "DI jan/32 · B3 ~15 min" : "DI jan/32 · fechamento",
          };
        }
      } catch {
        // mantem card server
      }
      try {
        // Selic meta (SGS 432) client-side: CORS aberto e o WAF do BCB
        // às vezes recusa fetch de datacenter (server ficava "—").
        // O endpoint /ultimos/N devolve 400 intermitente — usar range de datas.
        const fmtBR = (d: Date) =>
          `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        const end = new Date();
        const start = new Date(end.getTime() - 540 * 86_400_000);
        const res = await fetch(
          `https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=${fmtBR(start)}&dataFinal=${fmtBR(end)}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (res.ok) {
          const rows = (await res.json()) as { data: string; valor: string }[];
          const last = rows[rows.length - 1];
          const lastVal = Number(last?.valor);
          if (Number.isFinite(lastVal)) {
            let changeDate = last.data;
            let prevVal: number | null = null;
            for (let i = rows.length - 1; i >= 0; i--) {
              const v = Number(rows[i].valor);
              if (!Number.isFinite(v)) continue;
              if (v !== lastVal) {
                prevVal = v;
                break;
              }
              changeDate = rows[i].data;
            }
            const bps = prevVal != null ? Math.round((lastVal - prevVal) * 100) : 0;
            const [, mm, yyyy] = changeDate.split("/");
            next["selic"] = {
              id: "selic",
              label: "Selic (meta)",
              value: `${lastVal.toFixed(2).replace(".", ",")}%`,
              change: bps !== 0 ? `${bps > 0 ? "+" : "−"}${Math.abs(bps)} bps` : null,
              direction: bps === 0 ? "flat" : bps > 0 ? "up" : "down",
              sub: `última mudança ${mm}/${yyyy.slice(2)} · BCB`,
            };
          }
        }
      } catch {
        // mantem card server
      }
      if (!cancelled && Object.keys(next).length > 0) setLive((prev) => ({ ...prev, ...next }));
    }

    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  const cards = base.map((c) => live[c.id] ?? c);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
    </div>
  );
}
