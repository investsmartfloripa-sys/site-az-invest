"use client";

import { useMemo, useState } from "react";

import type { FamiliasEndividamentoData } from "@/lib/painel-familias";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { Chip, serieToPoints } from "./shared";

/**
 * "A que preço?" — taxas médias das concessões à pessoa física (% a.a.) por
 * modalidade, com a Selic tracejada como benchmark. O rotativo do cartão
 * (300%+ a.a.) NÃO entra no eixo: escala própria que esmagaria as demais —
 * vira chip com nota. Bloco v2 do builder (bloco_juros) — o card só é
 * montado pelo dashboard quando o bloco existe.
 */

const MODALIDADES = [
  { key: "livres_total", label: "Livres — total PF", color: AZ_BRAND.azure },
  { key: "consignado_total", label: "Consignado", color: AZ_SERIES[3] },
  { key: "pessoal_nao_consignado", label: "Pessoal não consignado", color: AZ_SERIES[4] },
  { key: "veiculos", label: "Veículos", color: AZ_SERIES[5] },
] as const;

const CHAVES_ROTATIVO = ["cartao_rotativo", "rotativo", "rotativo_total"];

export function JurosPfCard({
  juros,
  geradoEm,
}: {
  juros: NonNullable<FamiliasEndividamentoData["bloco_juros"]>;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const series = useMemo(
    () =>
      MODALIDADES.map((m) => ({
        id: m.key,
        label: m.label,
        color: m.color,
        data: serieToPoints(juros.series_pontos[m.key]),
      })).filter((s) => s.data.length > 0),
    [juros.series_pontos],
  );

  const selicPts = useMemo(() => serieToPoints(juros.series_pontos["selic_media_aa"]), [juros.series_pontos]);
  const pfTotalPts = useMemo(() => serieToPoints(juros.series_pontos["pf_total"]), [juros.series_pontos]);

  const rotativo = useMemo(() => {
    for (const k of CHAVES_ROTATIVO) {
      const pts = serieToPoints(juros.series_pontos[k]);
      if (pts.length > 0) return pts[pts.length - 1];
    }
    return null;
  }, [juros.series_pontos]);

  const minIso = series[0]?.data[0]?.[0] ?? "";
  const maxIso = series[0]?.data[series[0].data.length - 1]?.[0] ?? "";

  const ultLivres = series.find((s) => s.id === "livres_total")?.data.at(-1) ?? null;
  const ultSelic = selicPts.at(-1) ?? null;
  const ultPfTotal = pfTotalPts.at(-1) ?? null;

  const titulo =
    ultLivres != null
      ? `Crédito livre à pessoa física custa ${fmtPct(ultLivres[1], 1)} ao ano${
          ultSelic != null ? ` — ${fmtNum(ultLivres[1] - ultSelic[1], 0)} p.p. acima da Selic` : ""
        }`
      : "Taxas de juros das concessões à pessoa física";

  return (
    <ChartCard
      title={titulo}
      subtitle="Taxa média das NOVAS concessões por modalidade (% a.a.). A distância entre cada linha e a Selic tracejada é o spread: risco esperado, garantia, cunha fiscal e margem."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="BCB SGS — taxas médias das concessões PF com recursos livres (% a.a.) e Selic média mensal anualizada. O rotativo do cartão fica FORA do eixo (escala própria — ver chip). A transmissão da Selic às pontas é DEFASADA: o estoque repactua aos poucos e o spread responde também à inadimplência esperada — o gráfico mostra o preço do crédito NOVO, não do estoque."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {ultPfTotal != null ? (
          <Chip
            label={`Taxa média PF (${fmtMesCurto(ultPfTotal[0])})`}
            valor={`${fmtPct(ultPfTotal[1], 1)} a.a.`}
            hint="média de todas as modalidades, livres + direcionados"
          />
        ) : null}
        {rotativo != null ? (
          <Chip
            label={`Cartão rotativo (${fmtMesCurto(rotativo[0])})`}
            valor={`${fmtPct(rotativo[1], 0)} a.a.`}
            hint="fora do gráfico: escala própria — linha de emergência de 30 dias, não crédito de carregamento"
          />
        ) : null}
      </div>
      <AzTimeSeriesChart
        series={series}
        benchmarks={ultSelic != null ? [{ id: "selic", label: "Selic (média mensal a.a.)", color: "#64748B", data: selicPts }] : []}
        unit="%"
        period={period}
        height={300}
        yAxisLabel="% a.a."
      />
    </ChartCard>
  );
}
