"use client";

import { useEffect, useState } from "react";

import { fmtNum } from "@/lib/format-br";
import { fetchIndexQuote, fetchLiveCurve } from "@/lib/painel-b3-live";

export type TapeItem = {
  label: string;
  /** Texto do valor (ja formatado) — ex.: "170.331" ou "5,06". */
  value?: string;
  /** Variacao percentual no dia (define cor e seta); null = sem variacao exibida. */
  changePct?: number | null;
  /** Variacao em bps (taxas de juros, como o DI): mostrada no lugar do %. */
  changeBps?: number | null;
  /** Sufixo opcional do valor (ex.: "%"). */
  suffix?: string;
};

type Props = {
  /** Itens calculados no servidor (Blob, D-1/15min). */
  items: TapeItem[];
};

/**
 * Direcao da variacao. Variacao que arredonda a ~zero (|%| < 0,03 ou |bps| < 1, mesma
 * faixa dos cartoes KPI) e neutra: azul, sem seta — "▲ 0,00%" em verde parecia alta.
 */
function tapeDirection(item: TapeItem): "up" | "down" | "flat" | null {
  if (item.changeBps != null && Number.isFinite(item.changeBps)) {
    if (Math.abs(item.changeBps) < 1) return "flat";
    return item.changeBps > 0 ? "up" : "down";
  }
  const ch = item.changePct;
  if (ch == null || !Number.isFinite(ch)) return null;
  if (Math.abs(ch) < 0.03) return "flat";
  return ch > 0 ? "up" : "down";
}

const TAPE_TONE = { up: "text-[#39d98a]", down: "text-[#ff7d7d]", flat: "text-[#027DFC]" } as const;

function TapeEntry({ item }: { item: TapeItem }) {
  const dir = tapeDirection(item);
  const arrow = dir === "up" ? "▲ " : dir === "down" ? "▼ " : "";
  const amount =
    item.changeBps != null && Number.isFinite(item.changeBps)
      ? `${fmtNum(Math.abs(item.changeBps), 0)} bps`
      : `${fmtNum(Math.abs(item.changePct ?? 0), 2)}%`;
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1.5 px-4 font-mono text-xs">
      <span className="font-semibold tracking-wide text-zinc-500">{item.label}</span>
      {item.value ? <span className="text-zinc-100">{item.value}{item.suffix ?? ""}</span> : null}
      {dir ? (
        <span className={TAPE_TONE[dir]}>
          {arrow}
          {amount}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Tape de cotacoes full-bleed (ponta a ponta) no topo do Panorama.
 * Server entrega os itens base (Blob); o client adiciona IBOV e DI1
 * ao vivo da B3 (delayed ~15 min).
 */
export function MarketTape({ items }: Props) {
  const [liveItems, setLiveItems] = useState<TapeItem[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    async function load() {
      const next: TapeItem[] = [];
      try {
        const ibov = await fetchIndexQuote("IBOV", ctrl.signal);
        if (ibov) {
          next.push({
            label: "IBOV",
            value: ibov.last.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
            changePct: ibov.changePct,
          });
        }
      } catch {
        // segue sem IBOV
      }
      try {
        const di = await fetchLiveCurve("DI1", ctrl.signal);
        const liquid = di.contracts.filter((c) => c.rate != null && /F\d{2}$/.test(c.symbol));
        if (liquid.length > 0) {
          const short = liquid[0];
          const long = liquid.find((c) => c.maturity.startsWith("203")) ?? liquid[liquid.length - 1];
          // Taxa de juros varia em bps (como nos cartoes KPI), nao em "%".
          next.push(
            {
              label: `DI ${short.symbol.replace("DI1", "")}`,
              value: fmtNum(short.rate as number, 2),
              suffix: "%",
              changeBps: short.changeBps,
            },
            {
              label: `DI ${long.symbol.replace("DI1", "")}`,
              value: fmtNum(long.rate as number, 2),
              suffix: "%",
              changeBps: long.changeBps,
            },
          );
        }
      } catch {
        // segue sem DI
      }
      if (!cancelled && next.length > 0) setLiveItems(next);
    }

    load();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  const all = [...liveItems, ...items];
  if (all.length === 0) return null;

  // Duplica a sequencia pra animacao de loop continuo.
  const loop = [...all, ...all];

  return (
    <div
      aria-label="Cotações em destaque"
      className="relative left-1/2 right-1/2 -mx-[50vw] -mt-6 w-screen overflow-hidden bg-[#091433]"
    >
      <style>{`
        @keyframes az-tape-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .az-tape-track { animation: az-tape-scroll 60s linear infinite; }
        .az-tape:hover .az-tape-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .az-tape-track { animation: none; }
        }
      `}</style>
      <div className="az-tape relative flex items-center">
        <div className="az-tape-track flex w-max items-center py-2">
          {loop.map((item, i) => (
            <TapeEntry key={`${item.label}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
