"use client";

import { useMemo, useState } from "react";

import type { AtividadePimData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, num, toPointsMes } from "../shared";

/**
 * Esmiuçamento profissional da PIM: a MESMA série da indústria geral em
 * quatro transformações (MoM SA, YoY, acumulado em 12 meses, nível SA cru),
 * tabela dos últimos 12 meses e export CSV — série completa e abertura por
 * atividades do mês mais recente.
 */

type Transf = "mom" | "yoy" | "acum12" | "nivel";

const TRANSF_OPCOES = [
  { id: "mom", label: "MoM SA" },
  { id: "yoy", label: "YoY" },
  { id: "acum12", label: "Acum. 12m" },
  { id: "nivel", label: "Nível SA" },
];

const TRANSF_INFO: Record<Transf, { key: string; titulo: string; unit: "%" | "index" }> = {
  mom: { key: "var_mom_sa", titulo: "Variação mensal com ajuste sazonal (a manchete do IBGE)", unit: "%" },
  yoy: { key: "var_yoy", titulo: "Variação sobre o mesmo mês do ano anterior", unit: "%" },
  acum12: { key: "var_acum_12m", titulo: "Variação acumulada em 12 meses", unit: "%" },
  nivel: { key: "indice_sa", titulo: "Índice de produção com ajuste sazonal (base 2022 = 100)", unit: "index" },
};

export function AnaliseCompletaPim({ pim, geradoEm }: { pim: AtividadePimData; geradoEm: string }) {
  const [transf, setTransf] = useState<Transf>("yoy");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const info = TRANSF_INFO[transf];
  const points = useMemo(() => toPointsMes(pim.geral.serie, info.key), [pim.geral.serie, info.key]);

  const minIso = points.length > 0 ? points[0][0] : "";
  const maxIso = points.length > 0 ? points[points.length - 1][0] : "";

  const tabela = useMemo(() => pim.geral.serie.slice(-12).reverse(), [pim.geral.serie]);

  const csvSerie = () => {
    baixarCsv(
      `pim-geral-${pim.mes_recente}.csv`,
      ["mes", "var_mom_sa", "var_yoy", "var_acum_ano", "var_acum_12m", "indice", "indice_sa"],
      pim.geral.serie.map((r) => [r.mes, r.var_mom_sa, r.var_yoy, r.var_acum_ano, r.var_acum_12m, r.indice, r.indice_sa]),
    );
  };

  const csvAtividades = () => {
    const mes = pim.atividades.mes_recente;
    const items = pim.atividades.serie_mensal[mes] ?? [];
    if (items.length === 0) return;
    baixarCsv(
      `pim-atividades-${mes}.csv`,
      ["id", "atividade", "var_yoy", "var_mom_sa", "var_acum_12m", "indice_sa"],
      items.map((a) => [a.id, a.atividade, a.var_yoy, a.var_mom_sa, a.var_acum_12m, a.indice_sa]),
    );
  };

  return (
    <ChartCard
      title="Análise completa — indústria geral em quatro transformações"
      subtitle={info.titulo}
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
      footer="SIDRA 8888 (indústria geral, base 2022 = 100 retropolada a 2002). Exporte a série completa ou a abertura por atividades do mês mais recente em CSV (padrão Excel pt-BR)."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[{ id: "pim", label: "Indústria geral", color: AZ_BRAND.azure, data: points }]}
        unit={info.unit}
        period={period}
        height={280}
        showLegend={false}
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 font-semibold">Mês</th>
              <th className="py-1.5 pr-2 text-right font-semibold">MoM SA</th>
              <th className="py-1.5 pr-2 text-right font-semibold">YoY</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Acum. ano</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Acum. 12m</th>
              <th className="py-1.5 text-right font-semibold">Índice SA</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => (
              <tr key={r.mes} className="border-b border-zinc-100">
                <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtMesCurto(r.mes)}</td>
                {(["var_mom_sa", "var_yoy", "var_acum_ano", "var_acum_12m"] as const).map((k) => {
                  const v = num(r, k);
                  return (
                    <td key={k} className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                      {v != null ? fmtSignedPct(v, 1) : "—"}
                    </td>
                  );
                })}
                <td className="py-1.5 text-right tabular-nums text-zinc-700">
                  {r.indice_sa != null ? fmtNum(r.indice_sa, 1) : "—"}
                </td>
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
        <button
          type="button"
          onClick={csvAtividades}
          className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
        >
          Baixar atividades do mês (CSV)
        </button>
      </div>
    </ChartCard>
  );
}
