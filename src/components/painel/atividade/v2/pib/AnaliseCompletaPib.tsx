"use client";

import { useMemo, useState } from "react";

import type { AtividadePibData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, fmtTrimCurto, num, toPointsTrim } from "../shared";

/**
 * Esmiuçamento profissional do PIB: a MESMA série em quatro transformações
 * (QoQ SA, YoY, acumulado em 4 trimestres, nível SA), tabela dos últimos
 * trimestres e export CSV — série completa e contribuições.
 */

type Transf = "qoq" | "yoy" | "acum4t" | "nivel";

const TRANSF_OPCOES = [
  { id: "qoq", label: "QoQ SA" },
  { id: "yoy", label: "YoY" },
  { id: "acum4t", label: "Acum. 4T" },
  { id: "nivel", label: "Nível SA" },
];

const TRANSF_INFO: Record<Transf, { key: string; serie: "variacao" | "indice"; titulo: string; unit: "%" | "index" }> = {
  qoq: { key: "qoq_sa_pib", serie: "variacao", titulo: "Variação trimestral com ajuste sazonal", unit: "%" },
  yoy: { key: "yoy_pib", serie: "variacao", titulo: "Variação sobre o mesmo trimestre do ano anterior", unit: "%" },
  acum4t: { key: "acum_4t_pib", serie: "variacao", titulo: "Variação acumulada em 4 trimestres", unit: "%" },
  nivel: { key: "sa_pib", serie: "indice", titulo: "Índice de volume com ajuste sazonal (média 1995 = 100)", unit: "index" },
};

export function AnaliseCompletaPib({ pib, geradoEm }: { pib: AtividadePibData; geradoEm: string }) {
  const [transf, setTransf] = useState<Transf>("yoy");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const info = TRANSF_INFO[transf];
  const fonte = info.serie === "variacao" ? pib.variacao.serie : pib.indice_volume.serie;
  const points = useMemo(() => toPointsTrim(fonte, info.key), [fonte, info.key]);

  const minIso = points.length > 0 ? points[0][0] : "";
  const maxIso = points.length > 0 ? points[points.length - 1][0] : "";

  const tabela = useMemo(() => pib.variacao.serie.slice(-8).reverse(), [pib.variacao.serie]);

  const csvSerie = () => {
    const header = ["trimestre", "qoq_sa", "yoy", "acum_ano", "acum_4t", "indice_sa"];
    const idxByTrim = new Map(pib.indice_volume.serie.map((r) => [r.trim, r]));
    const rows = pib.variacao.serie.map((r) => [
      r.trim,
      num(r, "qoq_sa_pib"),
      num(r, "yoy_pib"),
      num(r, "acum_ano_pib"),
      num(r, "acum_4t_pib"),
      num(idxByTrim.get(r.trim), "sa_pib"),
    ]);
    baixarCsv(`pib-serie-${pib.trim_recente}.csv`, header, rows);
  };

  const csvContribuicoes = () => {
    const serie = pib.contribuicoes?.serie ?? [];
    if (serie.length === 0) return;
    const keys = Object.keys(serie[serie.length - 1]).filter((k) => k !== "trim");
    const rows = serie.map((r) => [r.trim, ...keys.map((k) => num(r, k))]);
    baixarCsv(`pib-contribuicoes-${pib.trim_recente}.csv`, ["trimestre", ...keys], rows);
  };

  return (
    <ChartCard
      title="Análise completa — PIB em quatro transformações"
      subtitle={TRANSF_INFO[transf].titulo}
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Transformação da série"
            options={TRANSF_OPCOES}
            value={transf}
            onChange={(id) => setTransf(id as Transf)}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </>
      }
      footer="SIDRA 5932 (variações) e 1621 (índice SA). Exporte a série completa ou as contribuições por ótica em CSV (padrão Excel pt-BR)."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[{ id: "pib", label: "PIB", color: AZ_BRAND.azure, data: points }]}
        unit={info.unit}
        period={period}
        height={280}
        showLegend={false}
        dots={2}
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 font-semibold">Trimestre</th>
              <th className="py-1.5 pr-2 text-right font-semibold">QoQ SA</th>
              <th className="py-1.5 pr-2 text-right font-semibold">YoY</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Acum. ano</th>
              <th className="py-1.5 text-right font-semibold">Acum. 4T</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => (
              <tr key={r.trim} className="border-b border-zinc-100">
                <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtTrimCurto(r.trim)}</td>
                {(["qoq_sa_pib", "yoy_pib", "acum_ano_pib", "acum_4t_pib"] as const).map((k) => {
                  const v = num(r, k);
                  return (
                    <td key={k} className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                      {v != null ? fmtSignedPct(v, 1) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={csvSerie}
          className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
        >
          Baixar série completa (CSV)
        </button>
        {pib.contribuicoes?.serie?.length ? (
          <button
            type="button"
            onClick={csvContribuicoes}
            className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
          >
            Baixar contribuições (CSV)
          </button>
        ) : null}
      </div>
    </ChartCard>
  );
}
