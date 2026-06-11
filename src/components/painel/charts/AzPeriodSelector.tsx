"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { addMonthsUTC, parseIsoUTC } from "@/lib/format-br";

/**
 * Seletor de período padrão AZ p/ séries temporais: pílulas
 * 1M/3M/6M/YTD/1A/5A/Máx + "Personalizado" (dois <input type="date">
 * limitados ao range da série). Estado 100% CONTROLADO por props; opcional
 * espelhar na querystring (`queryKey`) p/ links compartilháveis.
 *
 * Cortes de data sempre em UTC — ver `resolvePeriodRange`.
 */

export type AzPeriodId = "1m" | "3m" | "6m" | "ytd" | "1y" | "5y" | "max" | "custom";

/** Valor do seletor: id do período + range explícito quando "custom". */
export type AzPeriodValue = {
  id: AzPeriodId;
  /** ISO "YYYY-MM-DD" — só usado quando id === "custom". */
  from?: string;
  /** ISO "YYYY-MM-DD" — só usado quando id === "custom". */
  to?: string;
};

export const AZ_PERIOD_LABELS: Record<Exclude<AzPeriodId, "custom">, string> = {
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  ytd: "YTD",
  "1y": "1A",
  "5y": "5A",
  max: "Máx",
};

const DEFAULT_PERIODS: Exclude<AzPeriodId, "custom">[] = ["1m", "3m", "6m", "ytd", "1y", "5y", "max"];

function clampIso(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

/**
 * Resolve o período em um range concreto [from, to] (ISO), recortado ao
 * range disponível da série [seriesMin, seriesMax]. Toda a aritmética é UTC
 * (`addMonthsUTC` com clamp de fim de mês — nada de setMonth local).
 */
export function resolvePeriodRange(
  value: AzPeriodValue,
  seriesMin: string,
  seriesMax: string,
): { from: string; to: string } {
  const to = seriesMax;
  switch (value.id) {
    case "1m":
      return { from: clampIso(addMonthsUTC(to, -1), seriesMin, to), to };
    case "3m":
      return { from: clampIso(addMonthsUTC(to, -3), seriesMin, to), to };
    case "6m":
      return { from: clampIso(addMonthsUTC(to, -6), seriesMin, to), to };
    case "1y":
      return { from: clampIso(addMonthsUTC(to, -12), seriesMin, to), to };
    case "5y":
      return { from: clampIso(addMonthsUTC(to, -60), seriesMin, to), to };
    case "ytd": {
      const year = to.slice(0, 4);
      return { from: clampIso(`${year}-01-01`, seriesMin, to), to };
    }
    case "custom": {
      const rawFrom = value.from && Number.isFinite(parseIsoUTC(value.from)) ? value.from : seriesMin;
      const rawTo = value.to && Number.isFinite(parseIsoUTC(value.to)) ? value.to : seriesMax;
      const from = clampIso(rawFrom, seriesMin, seriesMax);
      const upper = clampIso(rawTo, seriesMin, seriesMax);
      return from <= upper ? { from, to: upper } : { from: upper, to: from };
    }
    case "max":
    default:
      return { from: seriesMin, to: seriesMax };
  }
}

const VALID_IDS = new Set<string>([...DEFAULT_PERIODS, "custom"]);

function isIsoDate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(parseIsoUTC(s));
}

/** Lê o AzPeriodValue das chaves `{prefix}p`/`{prefix}de`/`{prefix}ate`. null se ausente/inválido. */
function parsePeriodParams(
  searchParams: { get(name: string): string | null },
  prefix: string,
): AzPeriodValue | null {
  const p = searchParams.get(`${prefix}p`);
  if (!p || !VALID_IDS.has(p)) return null;
  if (p === "custom") {
    const de = searchParams.get(`${prefix}de`);
    const ate = searchParams.get(`${prefix}ate`);
    if (isIsoDate(de) && isIsoDate(ate)) return { id: "custom", from: de, to: ate };
    return null;
  }
  return { id: p as AzPeriodId };
}

function periodToParams(qs: URLSearchParams, prefix: string, v: AzPeriodValue): void {
  qs.set(`${prefix}p`, v.id);
  if (v.id === "custom" && v.from && v.to) {
    qs.set(`${prefix}de`, v.from);
    qs.set(`${prefix}ate`, v.to);
  } else {
    qs.delete(`${prefix}de`);
    qs.delete(`${prefix}ate`);
  }
}

/**
 * Hook p/ usar a QUERYSTRING como fonte única do período (links
 * compartilháveis, back/forward do browser). Chaves: `{prefix}p`,
 * `{prefix}de`, `{prefix}ate` — passe prefixos distintos ("ibov-", "cdi-")
 * p/ múltiplos charts na página. O valor é DERIVADO da URL (sem estado
 * local); o setter escreve com router.replace (scroll: false).
 *
 * Páginas que usam este hook devem envolver o componente em <Suspense>
 * (exigência do useSearchParams no App Router).
 *
 * Use OU este hook OU a prop `queryKey` do AzPeriodSelector — nunca os dois
 * no mesmo chart, senão a URL é escrita em dobro.
 */
export function useAzPeriodQueryState(
  prefix = "",
  defaultValue: AzPeriodValue = { id: "1y" },
): [AzPeriodValue, (v: AzPeriodValue) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = parsePeriodParams(searchParams, prefix) ?? defaultValue;

  const set = useCallback(
    (v: AzPeriodValue) => {
      const qs = new URLSearchParams(searchParams.toString());
      periodToParams(qs, prefix, v);
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname, prefix],
  );

  return [value, set];
}

export type AzPeriodSelectorProps = {
  /** Valor controlado. */
  value: AzPeriodValue;
  onChange: (v: AzPeriodValue) => void;
  /** ISO da observação mais antiga da série — limita o input "de". */
  min?: string;
  /** ISO da observação mais recente — limita o input "até". */
  max?: string;
  /** Pílulas exibidas (default todas: 1M…Máx). */
  periods?: Exclude<AzPeriodId, "custom">[];
  /**
   * Se setado, espelha cada mudança na querystring (replace, scroll:false)
   * com chaves `{queryKey}p`/`{queryKey}de`/`{queryKey}ate`. NÃO use junto
   * com useAzPeriodQueryState no mesmo chart (dupla escrita).
   */
  queryKey?: string;
  className?: string;
};

/**
 * Pílulas de período + range personalizado. Sempre controlado: o pai guarda
 * o AzPeriodValue e repassa ao AzTimeSeriesChart via prop `period`.
 */
export function AzPeriodSelector({
  value,
  onChange,
  min,
  max,
  periods = DEFAULT_PERIODS,
  queryKey,
  className = "",
}: AzPeriodSelectorProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Painel custom: aberto quando o valor JÁ é custom (derivado) ou quando o
  // usuário abriu manualmente e ainda não escolheu o range completo.
  const [manualOpen, setManualOpen] = useState(false);
  const customOpen = manualOpen || value.id === "custom";

  // Rascunho dos inputs SOBREPOSTO ao valor externo: null = segue o valor.
  const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
  const shownFrom = draft?.from ?? value.from ?? min ?? "";
  const shownTo = draft?.to ?? value.to ?? max ?? "";

  const writeQuery = useCallback(
    (v: AzPeriodValue) => {
      if (queryKey == null) return;
      const qs = new URLSearchParams(searchParams.toString());
      periodToParams(qs, queryKey, v);
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    },
    [queryKey, searchParams, router, pathname],
  );

  const emit = useCallback(
    (v: AzPeriodValue) => {
      onChange(v);
      writeQuery(v);
    },
    [onChange, writeQuery],
  );

  const emitCustom = useCallback(
    (from: string, to: string) => {
      if (!isIsoDate(from) || !isIsoDate(to)) return;
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      emit({ id: "custom", from: lo, to: hi });
    },
    [emit],
  );

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-1">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value.id === p}
            onClick={() => {
              setManualOpen(false);
              setDraft(null);
              emit({ id: p });
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              value.id === p
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
            }`}
          >
            {AZ_PERIOD_LABELS[p]}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value.id === "custom"}
          aria-expanded={customOpen}
          onClick={() => {
            if (customOpen && value.id !== "custom") {
              setManualOpen(false);
              return;
            }
            setManualOpen(true);
            if (isIsoDate(shownFrom) && isIsoDate(shownTo)) emitCustom(shownFrom, shownTo);
          }}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
            value.id === "custom"
              ? "bg-[#132960] text-white"
              : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
          }`}
        >
          Personalizado
        </button>
      </div>

      {customOpen ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-600">
          <label className="flex items-center gap-1">
            De
            <input
              type="date"
              value={shownFrom}
              min={min}
              max={shownTo || max}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({ from: v, to: shownTo });
                if (isIsoDate(v) && isIsoDate(shownTo)) emitCustom(v, shownTo);
              }}
              className="rounded-md border border-[#132960]/20 bg-white px-1.5 py-0.5 text-xs text-[#132960] tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027DFC]"
            />
          </label>
          <label className="flex items-center gap-1">
            até
            <input
              type="date"
              value={shownTo}
              min={shownFrom || min}
              max={max}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({ from: shownFrom, to: v });
                if (isIsoDate(shownFrom) && isIsoDate(v)) emitCustom(shownFrom, v);
              }}
              className="rounded-md border border-[#132960]/20 bg-white px-1.5 py-0.5 text-xs text-[#132960] tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027DFC]"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
