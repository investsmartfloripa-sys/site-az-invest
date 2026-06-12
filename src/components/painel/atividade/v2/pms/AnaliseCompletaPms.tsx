"use client";

import { useMemo, useState } from "react";

import type { AtividadePmsData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, num, toPointsMes } from "../shared";

/**
 * Esmiuçamento profissional da PMS: a série geral em quatro transformações
 * (MoM SA, YoY, acum. 12m, nível SA) com toggle volume × receita — receita
 * SÓ em variação (nível nominal mistura atividade e inflação, nunca é
 * plotado) —, tabela dos últimos 12 meses e export CSV com turismo e
 * transportes.
 */

type Transf = "mom_sa" | "yoy" | "acum12" | "nivel";
type Medida = "volume" | "receita";

const TRANSF_OPCOES = [
  { id: "mom_sa", label: "MoM SA" },
  { id: "yoy", label: "YoY" },
  { id: "acum12", label: "Acum. 12m" },
  { id: "nivel", label: "Nível SA" },
];

const TRANSF_INFO: Record<Transf, { sufixo: string; titulo: string; unit: "%" | "index" }> = {
  mom_sa: { sufixo: "var_mom_sa", titulo: "Variação mensal com ajuste sazonal", unit: "%" },
  yoy: { sufixo: "var_yoy", titulo: "Variação sobre o mesmo mês do ano anterior", unit: "%" },
  acum12: { sufixo: "var_acum_12m", titulo: "Variação acumulada em 12 meses", unit: "%" },
  nivel: { sufixo: "indice_sa", titulo: "Índice de volume com ajuste sazonal (base 2022 = 100)", unit: "index" },
};

export function AnaliseCompletaPms({ pms, geradoEm }: { pms: AtividadePmsData; geradoEm: string }) {
  const [transf, setTransf] = useState<Transf>("yoy");
  const [medida, setMedida] = useState<Medida>("volume");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const info = TRANSF_INFO[transf];
  const prefixo = medida === "volume" ? "volume" : "receita_nominal";
  const points = useMemo(() => toPointsMes(pms.serie, `${prefixo}_${info.sufixo}`), [pms.serie, prefixo, info.sufixo]);

  const minIso = points.length > 0 ? points[0][0] : "";
  const maxIso = points.length > 0 ? points[points.length - 1][0] : "";

  // Receita NUNCA em nível nominal — a opção some do segmented.
  const opcoesTransf = medida === "receita" ? TRANSF_OPCOES.filter((o) => o.id !== "nivel") : TRANSF_OPCOES;

  const tabela = useMemo(() => pms.serie.slice(-12).reverse(), [pms.serie]);

  const csvSerie = () => {
    const turismoPorMes = new Map((pms.turismo?.serie ?? []).map((r) => [r.mes, r] as const));
    const transpPorMes = new Map((pms.transportes?.serie ?? []).map((r) => [r.mes, r] as const));
    const header = [
      "mes",
      "volume_mom_sa",
      "volume_yoy",
      "volume_acum_12m",
      "receita_mom_sa",
      "receita_yoy",
      "receita_acum_12m",
      "turismo_volume_yoy",
      "cargas_yoy",
      "passageiros_yoy",
    ];
    const rows = pms.serie.map((r) => [
      r.mes,
      num(r, "volume_var_mom_sa"),
      num(r, "volume_var_yoy"),
      num(r, "volume_var_acum_12m"),
      num(r, "receita_nominal_var_mom_sa"),
      num(r, "receita_nominal_var_yoy"),
      num(r, "receita_nominal_var_acum_12m"),
      num(turismoPorMes.get(r.mes), "volume_var_yoy"),
      num(transpPorMes.get(r.mes), "cargas_var_yoy"),
      num(transpPorMes.get(r.mes), "passageiros_var_yoy"),
    ]);
    baixarCsv(`pms-serie-${pms.mes_recente}.csv`, header, rows);
  };

  return (
    <ChartCard
      title="Análise completa — a PMS em todas as transformações"
      subtitle={`${info.titulo} — ${medida === "volume" ? "volume (deflacionado)" : "receita nominal (sem deflação)"}`}
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Medida da série"
            options={[
              { id: "volume", label: "Volume" },
              { id: "receita", label: "Receita" },
            ]}
            value={medida}
            onChange={(id) => {
              const m = id as Medida;
              setMedida(m);
              if (m === "receita" && transf === "nivel") setTransf("yoy");
            }}
          />
          <AzSegmented ariaLabel="Transformação da série" options={opcoesTransf} value={transf} onChange={(id) => setTransf(id as Transf)} />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </>
      }
      footer="SIDRA 5906 — volume (deflacionado, a manchete do IBGE) e receita nominal. Receita aparece SÓ em variação: nível nominal mistura atividade e inflação. CSV no padrão Excel pt-BR com volume, receita, turismo (YoY volume) e transportes (YoY cargas e passageiros)."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[
          {
            id: "pms",
            label: medida === "volume" ? "Volume de serviços" : "Receita nominal",
            color: AZ_BRAND.azure,
            data: points,
          },
        ]}
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
              <th className="py-1.5 text-right font-semibold">Acum. 12m</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => (
              <tr key={r.mes} className="border-b border-zinc-100">
                <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtMesCurto(r.mes)}</td>
                {(["var_mom_sa", "var_yoy", "var_acum_ano", "var_acum_12m"] as const).map((k) => {
                  const v = num(r, `${prefixo}_${k}`);
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
      </div>
    </ChartCard>
  );
}
