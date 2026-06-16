"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { codaceAreas, num, trimIsoCentral } from "../shared";

/**
 * O tamanho real da economia — âncora da face Produção. Três séries no mesmo
 * eixo (índice de volume SA, base 1995 = 100): PIB, PIB POTENCIAL (tendência por
 * filtro Hodrick-Prescott, λ=1600, sobre o log) e INVESTIMENTO (FBCF). Crises
 * sombreadas pela cronologia CODACE/FGV-IBRE — a MESMA metodologia da aba
 * Termômetro de ciclo. (O toggle "PIB em US$ corrigido pelo CPI dos EUA" entra
 * quando a pipeline passar a coletar CPI/FX.)
 */

/** Resolve A·x = b por eliminação de Gauss com pivô parcial (denso, n pequeno). */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c];
    if (Math.abs(piv) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      if (f !== 0) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (M[i][i] || 1));
}

/** Tendência de Hodrick-Prescott: minimiza Σ(y−τ)² + λΣ(Δ²τ)². */
function hpTrend(y: number[], lambda = 1600): number[] {
  const n = y.length;
  if (n < 5) return [...y];
  const A: number[][] = Array.from({ length: n }, (_, i) => {
    const r = new Array(n).fill(0);
    r[i] = 1;
    return r;
  });
  for (let i = 0; i < n - 2; i++) {
    const idx = [i, i + 1, i + 2];
    const co = [1, -2, 1];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) A[idx[a]][idx[b]] += lambda * co[a] * co[b];
  }
  return solveLinear(A, y);
}

export function TamanhoEconomiaPib({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const { pibPts, potPts, fbcPts, minIso, maxIso } = useMemo(() => {
    const pibPts: AzSeriesPoint[] = [];
    const fbcPts: AzSeriesPoint[] = [];
    const logPib: number[] = [];
    const datasPib: string[] = [];
    for (const r of pib.indice_volume.serie) {
      const d = trimIsoCentral(String(r.trim));
      const p = num(r, "sa_pib");
      const f = num(r, "sa_fbcf");
      if (p != null && p > 0) {
        pibPts.push([d, p]);
        logPib.push(Math.log(p));
        datasPib.push(d);
      }
      if (f != null) fbcPts.push([d, f]);
    }
    const tend = hpTrend(logPib, 1600);
    const potPts: AzSeriesPoint[] = datasPib.map((d, i) => [d, +Math.exp(tend[i]).toFixed(2)]);
    const minIso = pibPts.length ? pibPts[0][0] : "";
    const maxIso = pibPts.length ? pibPts[pibPts.length - 1][0] : "";
    return { pibPts, potPts, fbcPts, minIso, maxIso };
  }, [pib.indice_volume.serie]);

  const faixas = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  return (
    <ChartCard
      title="O tamanho real da economia"
      subtitle="Índice de volume com ajuste sazonal (base 1995 = 100): o PIB, sua tendência (PIB potencial, filtro HP) e o investimento (FBCF). Faixas cinzas = recessões CODACE/FGV-IBRE."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais (1621, índice de volume dessazonalizado). PIB potencial: tendência de Hodrick-Prescott (λ=1600) sobre o log do PIB — o hiato (PIB acima/abaixo da linha) mede a posição no ciclo. FBCF = Formação Bruta de Capital Fixo. Recessões: cronologia CODACE/FGV-IBRE."
      stampGiro={geradoEm}
      stampDado={pib.trim_recente}
    >
      <AzTimeSeriesChart
        series={[
          { id: "pib", label: "PIB (volume, SA)", color: AZ_BRAND.navy, data: pibPts },
          { id: "potencial", label: "PIB potencial (HP)", color: "#94A3B8", data: potPts },
          { id: "fbcf", label: "Investimento (FBCF)", color: AZ_BRAND.azure, data: fbcPts },
        ]}
        unit="index"
        period={period}
        height={360}
        variant="hero"
        xRefAreas={faixas}
      />
    </ChartCard>
  );
}
