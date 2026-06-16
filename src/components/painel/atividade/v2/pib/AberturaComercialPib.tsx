"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, AzSegmented } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { num, trimIsoCentral } from "../shared";

/**
 * Abertura comercial — o tamanho do setor externo dentro do PIB. Exportações e
 * importações lado a lado e o SALDO comercial entre eles (X − M), na ótica da
 * despesa das Contas Nacionais. Duas lentes:
 *   - "% do PIB" (default): exportações e importações como fração do PIB nominal
 *     (estrutura_nominal, 1846) e o saldo = exp − imp em p.p. do PIB. A linha do
 *     zero no saldo separa superávit (X > M) de déficit (X < M) da conta de bens
 *     e serviços das Contas Nacionais — leitura de grau de abertura/dependência.
 *   - "nível real": exportações e importações em R$ encadeados a preços de 1995
 *     com ajuste sazonal (valores_reais_sa, 6613) e o saldo em R$ reais.
 * Importações entram como vazamento da demanda interna: alta = mais consumo de
 * bens de fora; por isso o saldo (X − M) é o que de fato soma ao PIB. Sem faixas
 * CODACE — a leitura aqui é de composição/saldo, não de posição no ciclo.
 */

type LenteId = "pct_pib" | "real";

export function AberturaComercialPib({
  pib,
  codace: _codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [lente, setLente] = useState<LenteId>("pct_pib");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  // Cada lente lê um bloco OPCIONAL do JSON (estrutura_nominal / valores_reais_sa)
  // e monta exportações, importações e o saldo (X − M) ponto a ponto pelo trim.
  const { series, minIso, maxIso, unit, temDados } = useMemo<{
    series: AzTimeSeries[];
    minIso: string;
    maxIso: string;
    unit: "%" | "R$";
    temDados: boolean;
  }>(() => {
    const ehPct = lente === "pct_pib";
    const rows = ehPct ? pib.estrutura_nominal?.serie ?? [] : pib.valores_reais_sa?.serie ?? [];
    const campoExp = ehPct ? "exportacoes_pct_pib" : "exportacoes";
    const campoImp = ehPct ? "importacoes_pct_pib" : "importacoes";

    const exp: AzSeriesPoint[] = [];
    const imp: AzSeriesPoint[] = [];
    const saldo: AzSeriesPoint[] = [];
    for (const r of rows as unknown as ReadonlyArray<Record<string, unknown> & { trim: string }>) {
      const iso = trimIsoCentral(String(r.trim));
      const x = num(r, campoExp);
      const m = num(r, campoImp);
      if (x != null) exp.push([iso, x]);
      if (m != null) imp.push([iso, m]);
      if (x != null && m != null) saldo.push([iso, +(x - m).toFixed(3)]);
    }

    const series: AzTimeSeries[] = [
      { id: "exportacoes", label: "Exportações", color: AZ_BRAND.azure, data: exp },
      { id: "importacoes", label: "Importações", color: AZ_BRAND.rust, data: imp },
      { id: "saldo", label: "Saldo (X − M)", color: AZ_BRAND.navy, data: saldo },
    ];

    let lo = "";
    let hi = "";
    for (const s of series) {
      for (const [d] of s.data) {
        if (!lo || d < lo) lo = d;
        if (!hi || d > hi) hi = d;
      }
    }

    return {
      series,
      minIso: lo,
      maxIso: hi,
      unit: ehPct ? "%" : "R$",
      temDados: exp.length > 0 || imp.length > 0,
    };
  }, [lente, pib.estrutura_nominal?.serie, pib.valores_reais_sa?.serie]);

  return (
    <ChartCard
      title="Abertura comercial: exportações, importações e saldo externo"
      subtitle={
        lente === "pct_pib"
          ? "Exportações e importações como % do PIB nominal e o saldo (X − M) em pontos percentuais do PIB. Saldo acima de zero = superávit comercial de bens e serviços nas Contas Nacionais."
          : "Exportações e importações em R$ a preços de 1995 (encadeados, com ajuste sazonal) e o saldo (X − M) em R$ reais. Saldo acima de zero = exportações superam importações."
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <AzSegmented
            ariaLabel="Lente"
            options={[
              { id: "pct_pib", label: "% do PIB" },
              { id: "real", label: "Nível real" },
            ]}
            value={lente}
            onChange={(id) => setLente(id === "real" ? "real" : "pct_pib")}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </div>
      }
      footer={
        lente === "pct_pib"
          ? "Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, ótica da despesa. Exportações e importações em % do PIB nominal (1846); saldo = exportações − importações, em p.p. do PIB. Importações são vazamento da demanda interna; só o saldo (X − M) soma ao PIB."
          : "Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais, ótica da despesa. Exportações e importações em valores encadeados a preços de 1995, com ajuste sazonal (6613); saldo = exportações − importações, em R$ reais. Importações são vazamento da demanda interna; só o saldo (X − M) soma ao PIB."
      }
      stampGiro={geradoEm}
      stampDado={pib.trim_recente}
    >
      {temDados ? (
        <AzTimeSeriesChart
          series={series}
          unit={unit}
          period={period}
          height={340}
          refLines={[{ y: 0, label: "saldo zero", color: "#94A3B8", dashed: false }]}
        />
      ) : (
        <div className="flex w-full items-center justify-center" style={{ height: 340 }}>
          <p className="text-sm text-zinc-400">
            Sem série de {lente === "pct_pib" ? "estrutura nominal (% do PIB)" : "valores reais (R$ de 1995)"} para o setor externo neste payload.
          </p>
        </div>
      )}
    </ChartCard>
  );
}
