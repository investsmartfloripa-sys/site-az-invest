"use client";

import { useEffect, useMemo, useState } from "react";

import type { TreasuryHistory } from "@/lib/painel-renda-fixa-data";
import { fetchLiveCurve, type LiveCurve } from "@/lib/painel-b3-live";
import { MarketCard } from "@/components/painel/market/MarketCard";
import {
  AzPeriodSelector,
  AzTimeSeriesChart,
  type AzPeriodValue,
  type AzTimeSeries,
} from "@/components/painel/charts";
import { seriesColor } from "@/lib/az-chart-theme";
import { fmtMesCurto } from "@/lib/format-br";

type CategoryKey = "PRE" | "IPCA";

/**
 * Casa um vencimento de título público com o contrato FUTURO B3 mais próximo
 * (DI para Pré, DAP para IPCA+) e devolve a taxa ao vivo desse contrato — o
 * "ponto D+0". Tolerância de ~20 dias (o futuro vence no 1º dia útil; o
 * vencimento ANBIMA pode diferir poucos dias). null se nada casar.
 */
function nearestFutureRate(curve: LiveCurve, vencISO: string): number | null {
  const target = Date.parse(`${vencISO}T00:00:00Z`);
  if (!Number.isFinite(target)) return null;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const c of curve.contracts) {
    if (c.rate == null) continue;
    const m = Date.parse(`${c.maturity}T00:00:00Z`);
    if (!Number.isFinite(m)) continue;
    const dist = Math.abs(m - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = c.rate;
    }
  }
  return bestDist <= 20 * 86_400_000 ? best : null;
}

type Props = {
  data: TreasuryHistory | null;
};

export function TreasuryTimeSeries({ data }: Props) {
  const [category, setCategory] = useState<CategoryKey>("PRE");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "3m" });
  const [selected, setSelected] = useState<Record<CategoryKey, string[]>>({
    PRE: [],
    IPCA: [],
  });
  const [liveDi, setLiveDi] = useState<LiveCurve | null>(null);
  const [liveDap, setLiveDap] = useState<LiveCurve | null>(null);

  // Curvas de FUTUROS B3 ao vivo (DI/DAP, intraday ~15 min) — usadas só para
  // acrescentar o ponto D+0 de hoje a cada vencimento. CORS aberto: o fetch é
  // no navegador do visitante. Degrada para só-ANBIMA (D-1) se falhar.
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    async function load() {
      const [di, dap] = await Promise.all([
        fetchLiveCurve("DI1", ctrl.signal).catch(() => null),
        fetchLiveCurve("DAP", ctrl.signal).catch(() => null),
      ]);
      if (cancelled) return;
      setLiveDi(di);
      setLiveDap(dap);
    }
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  const cat = data?.categories[category];

  // Prefixado: o contrato de referência de cada ano vence em 1º de janeiro
  // (LTN/NTN-F). Os vencimentos intra-ano (abr/jul/out) são secundários e
  // poluem a leitura — exibimos só os de janeiro. IPCA+ (NTN-B) vence em
  // mai/ago (sem janeiro), então mantém todos os vencimentos.
  const catVencimentos = useMemo(() => {
    if (!cat) return [] as string[];
    if (category === "PRE") {
      const jan = cat.vencimentos.filter((v) => v.slice(5, 7) === "01");
      if (jan.length > 0) return jan;
    }
    return cat.vencimentos;
  }, [cat, category]);

  // Default: pega 4 vencimentos espacados ENTRE OS AINDA VIVOS (data > last_data_date).
  // Pre/IPCA tem vencimentos antigos no historico (LTN 2010 etc.) que ja venceram —
  // useis pra ver series passadas, mas o default precisa mostrar a curva vigente.
  const defaultSelected = useMemo(() => {
    if (catVencimentos.length === 0) return [] as string[];
    const lastDate = data?.last_data_date ?? "9999-12-31";
    const alive = catVencimentos.filter((v) => v > lastDate);
    const pool = alive.length >= 4 ? alive : catVencimentos;
    if (pool.length <= 4) return pool;
    const idx = [0, Math.floor(pool.length / 3), Math.floor((pool.length * 2) / 3), pool.length - 1];
    return Array.from(new Set(idx.map((i) => pool[i])));
  }, [catVencimentos, data?.last_data_date]);

  const activeSelected = selected[category].length > 0 ? selected[category] : defaultSelected;

  // Observação mais antiga entre as séries da categoria (limita o "Personalizado").
  const seriesMin = useMemo(() => {
    if (!cat) return "1900-01-01";
    let min = "";
    for (const venc of catVencimentos) {
      const first = cat.series[venc]?.[0]?.[0];
      if (first && (!min || first < min)) min = first;
    }
    return min || "1900-01-01";
  }, [cat, catVencimentos]);

  // Curva de futuros da categoria (Pré→DI, IPCA+→DAP) + a data de hoje (D+0),
  // só quando há pregão de hoje.
  const liveCurve = category === "PRE" ? liveDi : liveDap;
  const liveTodayISO =
    liveCurve?.isToday && liveCurve.quotedAt ? liveCurve.quotedAt.slice(0, 10) : null;

  // Séries no formato do AzTimeSeriesChart. Quando há pregão de hoje, cada
  // vencimento ganha um ponto D+0 ao vivo (futuro B3 do mesmo vencimento),
  // estendendo a linha do fechamento ANBIMA (D-1) até hoje.
  const chartSeries = useMemo<AzTimeSeries[]>(() => {
    if (!cat) return [];
    return activeSelected.map((venc, i) => {
      const base = cat.series[venc] ?? [];
      let pts: ReadonlyArray<readonly [string, number]> = base;
      if (liveTodayISO && liveCurve) {
        const r = nearestFutureRate(liveCurve, venc);
        const lastIso = base.length > 0 ? base[base.length - 1][0] : "";
        if (r != null && liveTodayISO > lastIso) {
          pts = [...base, [liveTodayISO, r] as const];
        }
      }
      return { id: venc, label: fmtMesCurto(venc), color: seriesColor(i), data: pts };
    });
  }, [cat, activeSelected, liveCurve, liveTodayISO]);

  function toggleVencimento(venc: string) {
    setSelected((prev) => {
      const cur = prev[category].length > 0 ? prev[category] : defaultSelected;
      const has = cur.includes(venc);
      const next = has ? cur.filter((v) => v !== venc) : [...cur, venc];
      // Limita 6
      const limited = next.slice(-6);
      return { ...prev, [category]: limited };
    });
  }

  if (!data || !cat) {
    return (
      <MarketCard title="Curva histórica de juros — Títulos Públicos">
        <div className="py-10 text-center text-sm text-zinc-500">
          Dados ANBIMA ainda não publicados pelo pipeline diário.
        </div>
      </MarketCard>
    );
  }

  // data.source vem concatenado por dia no builder (ANBIMA × N dias + Tesouro
  // Transparente) — dedup das partes repetidas para o rodapé não ficar com a
  // mesma fonte 40 vezes.
  const fonte = Array.from(new Set(data.source.split(" + ").map((s) => s.trim()))).join(" + ");

  return (
    <MarketCard
      title="Curva histórica de juros"
      subtitle="Evolução da taxa indicativa de cada vencimento ao longo do tempo. A taxa atual de cada título aparece marcada no fim da linha."
      badge={`ANBIMA · ${data.last_data_date}`}
      bodyClassName="px-4 pb-4 pt-2"
      footer={`Fonte: ${fonte}`}
      stampGiro={data.generated_at}
      stampDado={data.last_data_date}
      toolbar={
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCategory("PRE")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              category === "PRE"
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC]"
            }`}
          >
            Prefixado
          </button>
          <button
            type="button"
            onClick={() => setCategory("IPCA")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              category === "IPCA"
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC]"
            }`}
          >
            IPCA+
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Periodos */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Janela:</span>
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={seriesMin}
            max={data.last_data_date}
          />
        </div>

        {/* Vencimentos disponiveis: separa vivos (em circulacao) de vencidos (historico) */}
        {(() => {
          const lastDate = data.last_data_date ?? "9999-12-31";
          const alive = catVencimentos.filter((v) => v > lastDate);
          const expired = catVencimentos.filter((v) => v <= lastDate);
          const renderChip = (venc: string, isExpired = false) => {
            const active = activeSelected.includes(venc);
            return (
              <button
                key={venc}
                type="button"
                onClick={() => toggleVencimento(venc)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-[#027DFC] text-white"
                    : isExpired
                      ? "border border-zinc-200 bg-white text-zinc-500 hover:border-[#027DFC] hover:text-[#027DFC]"
                      : "border border-[#132960]/15 bg-zinc-50 text-[#132960] hover:border-[#027DFC]"
                }`}
                title={isExpired ? "Vencido — disponível para visualizar série histórica" : undefined}
              >
                {fmtMesCurto(venc)}
              </button>
            );
          };
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">Em circulação:</span>
                {alive.map((v) => renderChip(v, false))}
              </div>
              {expired.length > 0 ? (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-[#027DFC]">
                    <span className="select-none">Vencidos ({expired.length}) — clique para mostrar séries históricas</span>
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {expired.map((v) => renderChip(v, true))}
                  </div>
                </details>
              ) : null}
              <p className="text-[11px] italic text-zinc-500">
                Máx 6 vencimentos simultâneos. Default: 4 espaçados entre os em circulação.
              </p>
            </div>
          );
        })()}

        {/* Grafico no estilo padrao AZ (mesmo do Ibovespa/IFIX). As taxas
            atuais vao na legenda colorida abaixo, no lugar do painel lateral. */}
        <AzTimeSeriesChart
          series={chartSeries}
          unit="%"
          mode="raw"
          period={period}
          height={420}
          showLegend={false}
          seriesEndLabels={!!liveTodayISO}
        />

        {/* Taxas atuais — último dado de cada vencimento, na cor da linha.
            Substitui o antigo painel lateral de estatísticas. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[#132960]/10 bg-zinc-50/50 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {liveTodayISO ? "Taxa atual (D+0)" : "Taxa atual"}
          </span>
          {chartSeries.map((s) => {
            const last = s.data.length > 0 ? s.data[s.data.length - 1] : null;
            const atual = last ? last[1] : null;
            const isLive = !!liveTodayISO && last?.[0] === liveTodayISO;
            return (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-sm">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-medium text-[#132960]">{s.label}</span>
                <span className="tabular-nums font-semibold text-[#132960]">
                  {atual != null ? `${atual.toFixed(2).replace(".", ",")}%` : "—"}
                </span>
                {isLive ? (
                  <span className="rounded bg-[#1E8A5C]/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-[#1E8A5C]">
                    ao vivo
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>

        <p className="text-xs italic text-zinc-500">
          Cada linha mostra a evolução da <em>taxa indicativa</em> de um título com data de vencimento
          específica. No Prefixado exibimos apenas os vencimentos de <strong>janeiro</strong> (LTN/NTN-F),
          o contrato de referência de cada ano; IPCA+ usa NTN-B (vencimentos de maio e agosto).
          {liveTodayISO ? (
            <>
              {" "}O último ponto de cada linha (dot, <strong>D+0</strong> de hoje) vem do{" "}
              <strong>futuro B3 ao vivo</strong> do mesmo vencimento (DI para Pré, DAP para IPCA+, ~15 min);
              o histórico é o fechamento ANBIMA (D-1). Pode haver pequena diferença de base entre o futuro
              e a taxa indicativa.
            </>
          ) : null}
        </p>
      </div>
    </MarketCard>
  );
}
