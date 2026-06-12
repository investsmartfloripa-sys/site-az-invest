"use client";

import { useMemo, useState } from "react";

import type { Idp12mPonto } from "@/lib/painel-contas-externas";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtPct } from "@/lib/format-br";
import { Stacked12mChart, type StackSerie } from "./Stacked12mChart";
import { filtraPeriodoMes, fmtUsBi, mesIso, num, ultimo } from "./shared";

/**
 * Bloco 05b — a QUALIDADE do IDP. Nem todo IDP é igual: participação no
 * capital é compromisso de longo prazo; operações intercompanhia são
 * economicamente quase-dívida (podem ser chamadas de volta como um empréstimo).
 */

const STACKS: StackSerie[] = [
  { key: "participacao", label: "Participação no capital", color: AZ_SERIES[0] },
  { key: "reinvestimento", label: "Reinvestimento de lucros", color: AZ_SERIES[4] },
  { key: "intercompanhia", label: "Intercompanhia (quase-dívida)", color: AZ_SERIES[5] },
];

export function IdpQualidadeCard({ serie12m, geradoEm }: { serie12m: Idp12mPonto[]; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const rows = useMemo(() => filtraPeriodoMes(serie12m, period), [serie12m, period]);
  const minIso = serie12m.length > 0 ? mesIso(serie12m[0].mes) : "";
  const maxIso = serie12m.length > 0 ? mesIso(serie12m[serie12m.length - 1].mes) : "";

  const titulo = useMemo(() => {
    const u = serie12m.length > 0 ? serie12m[serie12m.length - 1] : null;
    const total = num(u, "total");
    const part = num(u, "participacao");
    if (u == null || total == null || total <= 0)
      return "Como o investimento direto entra no país (12m)";
    if (part == null) return `O IDP soma ${fmtUsBi(total)} em 12 meses`;
    return `Participação no capital responde por ${fmtPct((100 * part) / total, 0)} do IDP de ${fmtUsBi(total)} em 12 meses`;
  }, [serie12m]);

  const ultTotal = ultimo(serie12m, "total");

  return (
    <ChartCard
      title={titulo}
      subtitle="Composição do IDP acumulado em 12 meses, US$ bilhões — a linha navy é o IDP total."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="IDP 12m (total SGS 22885): participação no capital (22891 — aporte novo, o compromisso mais longo) e reinvestimento de lucros (22892); intercompanhia é o residual auditado — empréstimos entre matriz e filial, economicamente mais próximos de DÍVIDA do que de capital de risco. Quanto maior a fatia de participação, mais sadio o financiamento."
      stampGiro={geradoEm}
      stampDado={ultTotal ? mesIso(ultTotal.row.mes) : null}
    >
      <Stacked12mChart rows={rows} stacks={STACKS} totalKey="total" totalLabel="IDP (12m)" height={300} />
    </ChartCard>
  );
}
