"use client";

import { useMemo, useState } from "react";

import type { AtividadePmcData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, num, toPointsMes } from "../shared";

/**
 * Esmiuçamento profissional da PMC: a série do volume em quatro
 * transformações (MoM SA, YoY, acum. 12m, nível SA) × dois escopos, tabela
 * dos últimos 12 meses (com gap e deflator) e export CSV completo.
 */

type Transf = "mom" | "yoy" | "acum12m" | "nivel";
type Escopo = "restrito" | "ampliado";

const TRANSF_OPCOES = [
  { id: "mom", label: "MoM SA" },
  { id: "yoy", label: "YoY" },
  { id: "acum12m", label: "Acum. 12m" },
  { id: "nivel", label: "Nível SA" },
];

const ESCOPO_OPCOES = [
  { id: "restrito", label: "Restrito" },
  { id: "ampliado", label: "Ampliado" },
];

const TRANSF_INFO: Record<Transf, { sufixo: string; titulo: string; unit: "%" | "index" }> = {
  mom: { sufixo: "volume_var_mom_sa", titulo: "Variação mensal com ajuste sazonal", unit: "%" },
  yoy: { sufixo: "volume_var_yoy", titulo: "Variação sobre o mesmo mês do ano anterior", unit: "%" },
  acum12m: { sufixo: "volume_var_acum_12m", titulo: "Variação acumulada em 12 meses", unit: "%" },
  nivel: { sufixo: "volume_indice_sa", titulo: "Índice de volume com ajuste sazonal (base 2022 = 100)", unit: "index" },
};

const CSV_ESCOPOS = ["restrito", "ampliado"] as const;
const CSV_TIPOS = ["volume", "receita_nominal"] as const;
const CSV_METRICAS = ["var_mom_sa", "var_yoy", "var_acum_ano", "var_acum_12m", "indice", "indice_sa"] as const;

export function AnaliseCompletaPmc({ pmc, geradoEm }: { pmc: AtividadePmcData; geradoEm: string }) {
  const [transf, setTransf] = useState<Transf>("yoy");
  const [escopo, setEscopo] = useState<Escopo>("restrito");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const info = TRANSF_INFO[transf];
  const points = useMemo(() => toPointsMes(pmc.serie, `${escopo}_${info.sufixo}`), [pmc.serie, escopo, info.sufixo]);

  const minIso = points.length > 0 ? points[0][0] : "";
  const maxIso = points.length > 0 ? points[points.length - 1][0] : "";

  const tabela = useMemo(() => pmc.serie.slice(-12).reverse(), [pmc.serie]);

  const csvCompleto = () => {
    const cols: string[] = [];
    for (const e of CSV_ESCOPOS) {
      for (const t of CSV_TIPOS) {
        for (const m of CSV_METRICAS) cols.push(`${e}_${t}_${m}`);
      }
    }
    cols.push("restrito_deflator_yoy", "ampliado_deflator_yoy", "gap_yoy");
    const rows = pmc.serie.map((r) => [r.mes, ...cols.map((k) => num(r, k))]);
    baixarCsv(`pmc-serie-${pmc.mes_recente}.csv`, ["mes", ...cols], rows);
  };

  return (
    <ChartCard
      title="Análise completa — PMC em quatro transformações"
      subtitle={`${info.titulo} — varejo ${escopo}.`}
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Transformação da série"
            options={TRANSF_OPCOES}
            value={transf}
            onChange={(id) => setTransf(id as Transf)}
          />
          <AzSegmented
            ariaLabel="Escopo do varejo"
            options={ESCOPO_OPCOES}
            value={escopo}
            onChange={(id) => setEscopo(id as Escopo)}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </>
      }
      footer="SIDRA 8880/8881 (restrito, desde 2000) e 8882/8883 (ampliado, desde 2003), base 2022 = 100. O CSV traz a série completa: volume e receita nominal nas seis transformações, por escopo, mais deflator implícito e gap (padrão Excel pt-BR: separador ; e vírgula decimal)."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[{ id: "pmc", label: `Varejo ${escopo}`, color: AZ_BRAND.azure, data: points }]}
        unit={info.unit}
        period={period}
        height={280}
        showLegend={false}
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 font-semibold">Mês</th>
              <th className="py-1.5 pr-2 text-right font-semibold">MoM SA (restr.)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">YoY (restr.)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Acum. 12m (restr.)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">YoY (ampl.)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Gap (p.p.)</th>
              <th className="py-1.5 text-right font-semibold">Deflator (restr.)</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => {
              const gap = num(r, "gap_yoy");
              return (
                <tr key={r.mes} className="border-b border-zinc-100">
                  <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtMesCurto(r.mes)}</td>
                  {(
                    [
                      "restrito_volume_var_mom_sa",
                      "restrito_volume_var_yoy",
                      "restrito_volume_var_acum_12m",
                      "ampliado_volume_var_yoy",
                    ] as const
                  ).map((k) => {
                    const v = num(r, k);
                    return (
                      <td key={k} className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                        {v != null ? fmtSignedPct(v, 1) : "—"}
                      </td>
                    );
                  })}
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                    {gap != null ? fmtSignedNum(gap, 1) : "—"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-700">
                    {(() => {
                      const v = num(r, "restrito_deflator_yoy");
                      return v != null ? fmtSignedPct(v, 1) : "—";
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={csvCompleto}
          className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
        >
          Baixar série completa (CSV)
        </button>
      </div>
    </ChartCard>
  );
}
