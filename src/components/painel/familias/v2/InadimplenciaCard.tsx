"use client";

import { useMemo, useState } from "react";

import type { FamiliasEndividamentoData } from "@/lib/painel-familias";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtPct } from "@/lib/format-br";
import { Chip, serieToPoints } from "./shared";

/**
 * "Estresse de crédito" — inadimplência (>90 dias) por modalidade, todas na
 * faixa 0–12%. O rotativo do cartão (~60%+) NÃO entra no eixo: o saldo
 * rotativo é minúsculo (30 dias de fatura) e concentra exatamente quem não
 * pagou — seleção adversa que infla a taxa. Ele vira CHIP com a nota certa:
 * o salto vem da Resolução 4.549/2017, NÃO da regulação de 2024.
 */

const MODALIDADES = [
  { key: "pf_livres_total", label: "Livres — total PF", color: AZ_BRAND.navy },
  { key: "cartao_parcelado", label: "Cartão — parcelado", color: AZ_SERIES[2] },
  { key: "cartao_total", label: "Cartão — total", color: AZ_BRAND.azure },
  { key: "pessoal_nao_consignado", label: "Pessoal não consignado", color: AZ_SERIES[4] },
  { key: "veiculos", label: "Veículos", color: AZ_SERIES[5] },
  { key: "consignado_privado", label: "Consignado privado", color: AZ_SERIES[3] },
] as const;

export function InadimplenciaCard({
  endividamento,
  geradoEm,
}: {
  endividamento: FamiliasEndividamentoData;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const pontos = endividamento.bloco_inadimplencia.series_pontos;

  const series = useMemo(
    () =>
      MODALIDADES.map((m) => ({
        id: m.key,
        label: m.label,
        color: m.color,
        data: serieToPoints(pontos[m.key]),
      })).filter((s) => s.data.length > 0),
    [pontos],
  );

  const rotativoSerie = useMemo(() => serieToPoints(pontos["cartao_rotativo"]), [pontos]);
  const rotativoUlt =
    rotativoSerie.length > 0
      ? rotativoSerie[rotativoSerie.length - 1]
      : endividamento.hero.inad_cartao_rotativo_pct?.valor != null
        ? ([endividamento.hero.inad_cartao_rotativo_pct.data ?? "", endividamento.hero.inad_cartao_rotativo_pct.valor] as const)
        : null;

  const minIso = series[0]?.data[0]?.[0] ?? "";
  const maxIso = series[0]?.data[series[0].data.length - 1]?.[0] ?? "";

  const ultTotal = series.find((s) => s.id === "pf_livres_total")?.data.at(-1) ?? null;
  const ultParcelado = series.find((s) => s.id === "cartao_parcelado")?.data.at(-1) ?? null;

  const titulo =
    ultTotal != null
      ? `Inadimplência do crédito livre PF em ${fmtPct(ultTotal[1], 1)}${
          ultParcelado != null && ultParcelado[1] > ultTotal[1]
            ? ` — o cartão parcelado (${fmtPct(ultParcelado[1], 1)}) é o ponto de atenção`
            : ""
        }`
      : "Inadimplência da pessoa física por modalidade";

  return (
    <ChartCard
      title={titulo}
      subtitle="Atrasos acima de 90 dias, recursos livres, por modalidade — todas na mesma escala (0–12%). O rotativo fica no chip: no mesmo eixo, ele esmagaria todas as outras linhas."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="BCB SGS — inadimplência >90 dias, recursos livres PF. A alta do cartão PARCELADO é uma migração GRADUAL de risco desde a Resolução 4.549/2017 (rotativo limitado a 30 dias: o saldo problemático passou a ser parcelado) — de ~1,6% em 2011 para ~10% em dez/2023 — e NÃO um efeito da regulação de 2024 (teto do rotativo, Lei 14.690/2023). O rotativo alto decorre de denominador pequeno + seleção adversa, não de piora generalizada do crédito."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      {rotativoUlt != null ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip
            label={`Cartão rotativo${rotativoUlt[0] ? ` (${fmtMesCurto(rotativoUlt[0])})` : ""}`}
            valor={fmtPct(rotativoUlt[1], 1)}
            hint="fora do gráfico: saldo pequeno (30 dias de fatura) + seleção adversa — taxa estruturalmente inflada desde a regra de 2017"
          />
        </div>
      ) : null}
      <AzTimeSeriesChart series={series} unit="%" period={period} height={320} yAxisLabel="% da carteira" />
    </ChartCard>
  );
}
