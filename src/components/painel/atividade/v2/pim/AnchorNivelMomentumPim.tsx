"use client";

import { useMemo, useState } from "react";

import type { AtividadePimData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtPct } from "@/lib/format-br";
import { FEV_2020_ISO, codaceAreas, mesIso, mmPoints, rebase100, toPointsMes } from "../shared";

/**
 * ÂNCORA do Painel PIM v2 — "a indústria recuperou o que perdeu?".
 *
 * DOIS painéis empilhados (nível e momentum NUNCA no mesmo eixo):
 * (a) nível = índice SA da indústria geral rebasado fev/2020 = 100, com a
 *     régua do pico histórico (calculado da própria série pelo builder — a
 *     data NUNCA é hardcoded) e recessões CODACE sombreadas;
 * (b) momentum = MoM SA suavizada (mm3), a leitura de margem.
 * A janela de período é COMPARTILHADA entre os dois painéis.
 */

export function AnchorNivelMomentumPim({
  pim,
  codaceMensal,
  geradoEm,
}: {
  pim: AtividadePimData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const nivelBruto = useMemo(() => toPointsMes(pim.geral.serie, "indice_sa"), [pim.geral.serie]);
  const nivel = useMemo(() => rebase100(nivelBruto), [nivelBruto]);
  const momentum = useMemo(() => mmPoints(toPointsMes(pim.geral.serie, "var_mom_sa"), 3), [pim.geral.serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  // Valor do índice SA na base do rebase (fev/2020) — p/ rebasar também o pico.
  const baseFev2020 = useMemo(() => nivelBruto.find(([d]) => d >= FEV_2020_ISO)?.[1] ?? null, [nivelBruto]);

  const pico = pim.picos?.industria_geral ?? null;
  const ultNivelBruto = nivelBruto.length > 0 ? nivelBruto[nivelBruto.length - 1][1] : null;
  const pctVsPico = pico && pico.indice_sa > 0 && ultNivelBruto != null ? (ultNivelBruto / pico.indice_sa - 1) * 100 : null;
  const picoRebasado = pico && baseFev2020 ? +((100 * pico.indice_sa) / baseFev2020).toFixed(2) : null;
  const mm3Ult = momentum.length > 0 ? momentum[momentum.length - 1][1] : null;

  const titulo =
    pico && pctVsPico != null
      ? `Indústria opera ${fmtPct(Math.abs(pctVsPico), 1)} ${pctVsPico < 0 ? "abaixo" : "acima"} do pico de ${fmtMesCurto(
          pico.mes,
        )}${mm3Ult != null ? ` — e ${mm3Ult > 0 ? "acelera" : "desacelera"} na margem` : ""}`
      : "Indústria geral — nível e momentum";

  const refsNivel = useMemo<AzRefLine[]>(() => {
    const out: AzRefLine[] = [{ y: 100, label: "fev/2020", color: "#94A3B8" }];
    if (pico && picoRebasado != null) out.push({ y: picoRebasado, label: `pico ${fmtMesCurto(pico.mes)}`, color: AZ_BRAND.navy });
    return out;
  }, [pico, picoRebasado]);

  const minIso = nivel.length > 0 ? nivel[0][0] : "";
  const maxIso = nivel.length > 0 ? nivel[nivel.length - 1][0] : "";

  return (
    <ChartCard
      title={titulo}
      subtitle="A indústria recuperou o que perdeu? Painel de cima: nível de produção com ajuste sazonal (fev/2020 = 100) contra o pico histórico da série. Painel de baixo: o momentum da margem (variação mensal SA, média móvel de 3 meses)."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Índice SA da indústria geral (SIDRA 8888, base 2022 = 100 retropolada a 2002), rebasado fev/2020 = 100 — último mês pré-pandemia. O pico é calculado da própria série SA, não é data fixa. Momentum: MoM SA suavizada (mm3). Faixas cinzas: recessões CODACE/FGV (última datação: 2020)."
      stampGiro={geradoEm}
      stampDado={pim.geral.serie.length > 0 ? mesIso(pim.geral.serie[pim.geral.serie.length - 1].mes) : null}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Nível (índice SA, fev/2020 = 100)</p>
        <AzTimeSeriesChart
          series={[{ id: "nivel", label: "Indústria geral (SA)", color: AZ_BRAND.azure, data: nivel }]}
          unit="index"
          period={period}
          height={200}
          xRefAreas={faixas}
          refLines={refsNivel}
          showLegend={false}
        />

        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Momentum (MoM SA, média móvel de 3 meses)
        </p>
        <AzTimeSeriesChart
          series={[{ id: "momentum", label: "MoM SA (mm3)", color: AZ_BRAND.azure, data: momentum }]}
          unit="%"
          period={period}
          height={200}
          xRefAreas={faixas}
          showLegend={false}
        />
      </div>
    </ChartCard>
  );
}
