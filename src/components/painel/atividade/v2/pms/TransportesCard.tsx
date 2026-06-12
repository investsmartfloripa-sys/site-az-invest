"use client";

import { useMemo, useState } from "react";

import type { AtividadePmsData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";
import { codaceAreas, mmPoints, toPointsMes } from "../shared";

/**
 * Transportes (PMS 8695) — cargas × passageiros em YoY suavizada (mm3).
 * Cargas são o termômetro do ciclo de indústria + varejo (logística);
 * passageiros refletem renda das famílias e turismo. Labels canônicos vêm de
 * labels_transportes (valores publicados pelo IBGE) — nunca os slugs do JSON.
 */

type TransportesBloco = NonNullable<AtividadePmsData["transportes"]>;

export function TransportesCard({
  transportes,
  codaceMensal,
  geradoEm,
}: {
  transportes: TransportesBloco;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const labels = Object.values(transportes.labels_transportes ?? {});
  const labelCargas = labels.find((l) => l.toLowerCase().includes("carga")) ?? "Transporte de cargas";
  const labelPassageiros = labels.find((l) => l.toLowerCase().includes("passageiro")) ?? "Transporte de passageiros";

  const cargasPts = useMemo(() => mmPoints(toPointsMes(transportes.serie, "cargas_var_yoy"), 3), [transportes.serie]);
  const passageirosPts = useMemo(
    () => mmPoints(toPointsMes(transportes.serie, "passageiros_var_yoy"), 3),
    [transportes.serie],
  );
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const ultCargas = cargasPts.length > 0 ? cargasPts[cargasPts.length - 1][1] : null;
  const ultPassageiros = passageirosPts.length > 0 ? passageirosPts[passageirosPts.length - 1][1] : null;

  const minIso = cargasPts.length > 0 ? cargasPts[0][0] : "";
  const maxIso = cargasPts.length > 0 ? cargasPts[cargasPts.length - 1][0] : "";

  const titulo =
    ultCargas != null && ultPassageiros != null
      ? `Cargas ${ultCargas >= 0 ? "crescem" : "caem"} ${fmtSignedPct(ultCargas, 1)} e passageiros ${
          ultPassageiros >= 0 ? "crescem" : "caem"
        } ${fmtSignedPct(ultPassageiros, 1)} — ${
          ultCargas >= ultPassageiros ? "o ciclo de mercadorias dá o tom" : "a mobilidade das pessoas dá o tom"
        }`
      : "Transportes — cargas × passageiros";

  return (
    <ChartCard
      title={titulo}
      subtitle="O país está movendo mais mercadorias ou mais pessoas? Variação interanual do volume, suavizada por média móvel de 3 meses, nos dois recortes da PMS de transportes."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="SIDRA 8695 (volume, base 2022 = 100), YoY suavizada por mm3 — amortece efeitos de base. Cargas = termômetro do ciclo de indústria e varejo (logística); passageiros = renda das famílias e turismo. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <AzTimeSeriesChart
        series={[
          { id: "cargas", label: `${labelCargas} (YoY mm3)`, color: AZ_BRAND.azure, data: cargasPts },
          { id: "passageiros", label: `${labelPassageiros} (YoY mm3)`, color: AZ_BRAND.navy, data: passageirosPts },
        ]}
        unit="%"
        period={period}
        height={300}
        xRefAreas={faixas}
      />
    </ChartCard>
  );
}
