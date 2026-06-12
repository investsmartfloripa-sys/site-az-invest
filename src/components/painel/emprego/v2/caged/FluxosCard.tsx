"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { CagedQuebrasData, CagedTotalData } from "@/lib/painel-emprego";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { codaceAreas, mesIso, mmPoints, toPointsMes } from "@/components/painel/atividade/v2/shared";
import { ultimoCom } from "./shared";

/**
 * "O mercado está girando?" — admissões e desligamentos em mm3 (fluxos
 * brutos, mil/mês): a DISTÂNCIA vertical entre as linhas é o saldo. O chip de
 * desligamentos A PEDIDO é a proxy do quits rate americano — mercado aquecido
 * é gente pedindo demissão por confiança em recolocação.
 *
 * NÃO chamamos isto de "rotatividade": a taxa oficial MTE/DIEESE usa outra
 * fórmula (mín. de admissões/desligamentos sobre o estoque).
 */

function emMil(points: ReadonlyArray<AzSeriesPoint>): AzSeriesPoint[] {
  return points.map(([d, v]) => [d, +(v / 1000).toFixed(1)] as const);
}

export function FluxosCard({
  total,
  quebras,
  codaceMensal,
  geradoEm,
}: {
  total: CagedTotalData;
  quebras: CagedQuebrasData | null;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const serie = total.serie;
  const admPts = useMemo(() => emMil(mmPoints(toPointsMes(serie, "admissoes"))), [serie]);
  const demPts = useMemo(() => emMil(mmPoints(toPointsMes(serie, "demissoes"))), [serie]);
  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const minIso = admPts.length > 0 ? admPts[0][0] : "";
  const maxIso = admPts.length > 0 ? admPts[admPts.length - 1][0] : "";

  // Chip do quits-rate proxy: último mês com pct_desligamentos_a_pedido não-nulo.
  const aPedido = useMemo(
    () => (quebras ? ultimoCom(quebras.serie, (r) => r.pct_desligamentos_a_pedido) : null),
    [quebras],
  );

  const ultAdm = admPts.length > 0 ? admPts[admPts.length - 1][1] : null;
  const ultDem = demPts.length > 0 ? demPts[demPts.length - 1][1] : null;
  const titulo =
    ultAdm != null && ultDem != null
      ? `O mercado gira com ${fmtNum(ultAdm, 0)} mil admissões contra ${fmtNum(ultDem, 0)} mil desligamentos por mês (mm3)`
      : "Admissões × desligamentos (mm3)";

  return (
    <ChartCard
      title={titulo}
      subtitle="Fluxos brutos do consolidado oficial em médias móveis de 3 meses, em mil por mês. A distância vertical entre as linhas é o saldo do CAGED."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Admissões e desligamentos: consolidado oficial MTE via IPEADATA, mm3 p/ tirar o serrilhado sazonal. Desligamentos a pedido: microdados PDET (cobertura parcial, só meses reprocessados). Isto NÃO é a 'taxa de rotatividade' oficial — a fórmula MTE/DIEESE é outra."
      stampGiro={geradoEm}
      stampDado={total.serie.length > 0 ? mesIso(total.serie[total.serie.length - 1].mes) : null}
    >
      {aPedido ? (
        <div className="mb-3 inline-flex flex-wrap items-baseline gap-x-2 rounded-lg bg-zinc-50 px-3 py-1.5">
          <span className="text-sm font-bold tabular-nums text-[#132960]">{fmtPct(aPedido.valor, 1)}</span>
          <span className="text-xs text-zinc-600">
            dos desligamentos de {fmtMesCurto(aPedido.mes)} foram <strong>a pedido</strong> — proxy do quits rate: mercado
            aquecido é gente pedindo demissão
          </span>
        </div>
      ) : null}
      <AzTimeSeriesChart
        series={[
          { id: "adm", label: "Admissões (mm3)", color: AZ_BRAND.azure, data: admPts },
          { id: "dem", label: "Desligamentos (mm3)", color: AZ_BRAND.rust, data: demPts },
        ]}
        unit="none"
        period={period}
        height={300}
        xRefAreas={faixas}
        yAxisLabel="mil por mês"
      />
    </ChartCard>
  );
}
