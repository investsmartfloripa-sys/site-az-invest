"use client";

import { useMemo, useState } from "react";

import type {
  AtividadeCodaceData,
  AtividadeIbcBrData,
  AtividadePimData,
  AtividadePmcData,
  AtividadePmsData,
} from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";
import { num, rebase100 } from "./shared";

/**
 * Painel-síntese da área de Atividade — a pergunta mais frequente do leitor
 * ("cinco anos depois da pandemia, quem recuperou e quem ficou para trás?")
 * num único gráfico: indústria, varejo e serviços em nível dessazonalizado,
 * todos rebasados para fev/2020 = 100, com o IBC-Br como "economia total".
 *
 * A mensagem é verificada contra o dado (não afirmada a priori): a manchete
 * ordena os setores pelo valor atual.
 */

type Setor = { id: string; label: string; color: string; points: AzSeriesPoint[] };

export function SinteseSetorialCard({
  pim,
  pmc,
  pms,
  ibcbr,
  codace,
}: {
  pim: AtividadePimData | null;
  pmc: AtividadePmcData | null;
  pms: AtividadePmsData | null;
  ibcbr: AtividadeIbcBrData | null;
  codace: AtividadeCodaceData | null;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const setores = useMemo<Setor[]>(() => {
    const out: Setor[] = [];
    if (ibcbr) {
      const pts: AzSeriesPoint[] = [];
      for (const r of ibcbr.serie) if (r.indice_sa != null) pts.push([`${r.mes}-01`, r.indice_sa]);
      out.push({ id: "ibcbr", label: "Economia total (IBC-Br)", color: AZ_BRAND.navy, points: rebase100(pts) });
    }
    if (pim) {
      const pts: AzSeriesPoint[] = [];
      for (const r of pim.geral.serie) if (r.indice_sa != null) pts.push([`${r.mes}-01`, r.indice_sa]);
      out.push({ id: "industria", label: "Indústria (PIM)", color: AZ_SERIES[2], points: rebase100(pts) });
    }
    if (pmc) {
      const pts: AzSeriesPoint[] = [];
      for (const r of pmc.serie) {
        const v = num(r, "restrito_volume_indice_sa");
        if (v != null) pts.push([`${r.mes}-01`, v]);
      }
      out.push({ id: "varejo", label: "Varejo restrito (PMC)", color: AZ_SERIES[3], points: rebase100(pts) });
    }
    if (pms) {
      const pts: AzSeriesPoint[] = [];
      for (const r of pms.serie) {
        const v = num(r, "volume_indice_sa");
        if (v != null) pts.push([`${r.mes}-01`, v]);
      }
      out.push({ id: "servicos", label: "Serviços (PMS)", color: AZ_BRAND.azure, points: rebase100(pts) });
    }
    return out.filter((s) => s.points.length > 0);
  }, [pim, pmc, pms, ibcbr]);

  const series = useMemo<AzTimeSeries[]>(
    () => setores.map((s) => ({ id: s.id, label: s.label, color: s.color, data: s.points })),
    [setores],
  );

  // Manchete verificada contra o dado: ordena pelo nível atual.
  const leitura = useMemo(() => {
    const atuais = setores
      .filter((s) => s.id !== "ibcbr")
      .map((s) => ({ label: s.label.replace(/ \(.+\)$/, ""), v: s.points[s.points.length - 1][1] - 100 }))
      .sort((a, b) => b.v - a.v);
    if (atuais.length === 0) return null;
    return atuais;
  }, [setores]);

  const titulo = leitura
    ? `Pós-pandemia: ${leitura[0].label.toLowerCase()} lidera (${fmtSignedPct(leitura[0].v, 1)} vs fev/2020)${
        leitura.length > 1
          ? `; ${leitura[leitura.length - 1].label.toLowerCase()} ${
              leitura[leitura.length - 1].v < 0 ? "segue abaixo" : "fecha a fila"
            } (${fmtSignedPct(leitura[leitura.length - 1].v, 1)})`
          : ""
      }`
    : "Síntese setorial — nível pós-pandemia";

  if (series.length === 0) return null;

  const minIso = series[0].data[0]?.[0] ?? "";
  const maxIso = series[0].data[series[0].data.length - 1]?.[0] ?? "";

  const faixas = (codace?.mensal ?? [])
    .filter((f) => f.tipo === "recessao")
    .map((f) => ({ x1: `${f.pico}-01`, x2: `${f.vale}-01` }));

  return (
    <ChartCard
      title={titulo}
      subtitle="Cinco anos depois da pandemia, quais setores recuperaram e quais ficaram para trás? Volume dessazonalizado, todos rebasados para fev/2020 = 100."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Índices SA: PIM 8888 (indústria geral), PMC 8880 (restrito — bens; serviços às famílias ficam fora), PMS 5906 (volume), IBC-Br SGS 24364 (economia total, em navy). Séries com inícios distintos; faixas cinzas = recessões CODACE."
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={series}
        unit="index"
        period={period}
        height={340}
        xRefAreas={faixas}
        refLines={[{ y: 100, label: "fev/2020", color: "#94A3B8" }]}
      />
    </ChartCard>
  );
}
