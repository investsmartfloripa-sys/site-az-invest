"use client";

import { useMemo, useState } from "react";

import type { AtividadeIbcBrData, AtividadePibData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtSignedPct } from "@/lib/format-br";
import { codaceAreas, mesIso, num, trimIsoCentral } from "../shared";

/**
 * IBC-Br × PIB — a única razão de existir do IBC-Br é antecipar o PIB, e os
 * dois nunca eram confrontados. Ambos rebasados para MÉDIA DE 2019 = 100
 * (pré-pandemia, ano cheio); o PIB trimestral entra em degraus (stepAfter)
 * ancorado no mês central do trimestre.
 *
 * O momentum mensal (YoY mm3 e 3m/3m SAAR) vem como chips — número de índice
 * cru base 2002=100 não comunica nada (removido conforme o plano).
 */

function mediaDe2019(pontos: ReadonlyArray<AzSeriesPoint>): number | null {
  const ano = pontos.filter(([d]) => d >= "2019-01-01" && d <= "2019-12-31").map(([, v]) => v);
  if (ano.length === 0) return null;
  return ano.reduce((a, b) => a + b, 0) / ano.length;
}

function rebaseMedia2019(pontos: ReadonlyArray<AzSeriesPoint>): AzSeriesPoint[] {
  const base = mediaDe2019(pontos);
  if (!base || base <= 0) return [];
  return pontos.map(([d, v]) => [d, +((100 * v) / base).toFixed(3)] as const);
}

function Chip({ label, valor, hint }: { label: string; valor: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-sm font-bold tabular-nums text-[#132960]">{valor}</p>
      {hint ? <p className="text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function IbcBrPibCard({
  ibcbr,
  pib,
  codaceMensal,
  geradoEm,
}: {
  ibcbr: AtividadeIbcBrData;
  pib: AtividadePibData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const ibcbrPts = useMemo(() => {
    const brutos: AzSeriesPoint[] = [];
    for (const r of ibcbr.serie) {
      const v = r.indice_sa;
      if (v != null) brutos.push([mesIso(r.mes), v]);
    }
    return rebaseMedia2019(brutos);
  }, [ibcbr.serie]);

  const pibPts = useMemo(() => {
    const brutos: AzSeriesPoint[] = [];
    for (const r of pib.indice_volume.serie) {
      const v = num(r, "sa_pib");
      if (v != null) brutos.push([trimIsoCentral(r.trim), v]);
    }
    return rebaseMedia2019(brutos);
  }, [pib.indice_volume.serie]);

  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const ult = ibcbr.serie[ibcbr.serie.length - 1];
  const minIso = ibcbrPts.length > 0 ? ibcbrPts[0][0] : "";
  const maxIso = ibcbrPts.length > 0 ? ibcbrPts[ibcbrPts.length - 1][0] : "";

  return (
    <ChartCard
      title="O que a prévia mensal indica para o PIB do trimestre corrente?"
      subtitle="IBC-Br (proxy mensal do BCB) e PIB oficial, ambos com ajuste sazonal e rebasados para média de 2019 = 100. O PIB entra em degraus no mês central de cada trimestre."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="IBC-Br: BCB SGS 24364 (SA). PIB: SIDRA 1621 (SA), em degraus. Atenção: o trimestre corrente do IBC-Br é PARCIAL — o degrau do PIB só fecha com a divulgação oficial (~60 dias de defasagem). YoY do IBC-Br calculada sobre o índice sem ajuste (convenção oficial); 3m/3m SAAR = média móvel de 3m vs 3m anterior, anualizada."
      stampGiro={geradoEm}
      stampDado={ult ? mesIso(ult.mes) : null}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip
          label={`IBC-Br ${ult ? fmtMesCurto(ult.mes) : ""} (MoM SA)`}
          valor={fmtSignedPct(ult?.var_mom ?? null, 2)}
          hint="vs mês anterior"
        />
        <Chip label="YoY (mm3)" valor={fmtSignedPct(ult?.var_yoy_mm3 ?? null, 1)} hint="tendência interanual suavizada" />
        <Chip label="3m/3m anualizada" valor={fmtSignedPct(ult?.var_3m3m_saar ?? null, 1)} hint="ritmo trimestralizado (SAAR)" />
      </div>
      <AzTimeSeriesChart
        series={[
          { id: "ibcbr", label: "IBC-Br (mensal, SA)", color: AZ_BRAND.azure, data: ibcbrPts },
          { id: "pib", label: "PIB (trimestral, SA)", color: AZ_BRAND.navy, type: "stepAfter", data: pibPts },
        ]}
        unit="index"
        period={period}
        height={300}
        xRefAreas={faixas}
        refLines={[{ y: 100, label: "média 2019", color: "#94A3B8" }]}
      />
    </ChartCard>
  );
}
