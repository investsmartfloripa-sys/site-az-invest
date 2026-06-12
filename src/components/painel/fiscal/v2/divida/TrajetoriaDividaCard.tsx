"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { FiscalClassicosData, PontoMensal } from "@/lib/painel-fiscal";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { codaceAreas, dataIso, deltaDozeMeses, maximoPonto, toPoints } from "./shared";

/**
 * ÂNCORA do Painel Dívida v2 — "para onde a dívida pública está indo?".
 *
 * DBGG e DLSP em % do PIB com recessões CODACE e DUAS réguas honestas:
 * a referência ~70% do FMI p/ emergentes (Fiscal Monitor/DSA — com fonte no
 * footer) e o MÁXIMO HISTÓRICO da própria DBGG, calculado da série. Os
 * limiares "80% atenção FMI" (sem fonte) e "100% Reinhart-Rogoff" (o paper
 * usava 90% e foi contestado — Herndon et al. 2013) foram REMOVIDOS.
 *
 * DLSP do governo central e o "colchão" DBGG−DLSP entram por toggle — o
 * wedge mistura perímetros e carrega nota própria no footer.
 */

const COR_DBGG = AZ_BRAND.azure;
const COR_DLSP = AZ_BRAND.navy;
const COR_CENTRAL = "#0891B2"; // ciano AZ_SERIES
const COR_WEDGE = "#7C3AED"; // violeta AZ_SERIES

function ToggleChip({ ativo, cor, label, onClick }: { ativo: boolean; cor: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
        ativo ? "border-transparent text-white" : "border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
      }`}
      style={ativo ? { background: cor } : undefined}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: ativo ? "#fff" : cor }}
        aria-hidden
      />
      {label}
    </button>
  );
}

export function TrajetoriaDividaCard({
  divida,
  codaceMensal,
  geradoEm,
}: {
  divida: FiscalClassicosData["divida"];
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const [mostraCentral, setMostraCentral] = useState(false);
  const [mostraWedge, setMostraWedge] = useState(false);

  const dbggPts = useMemo(() => toPoints(divida.dbgg_pct_pib), [divida.dbgg_pct_pib]);
  const dlspPts = useMemo(() => toPoints(divida.dlsp_total_pct_pib), [divida.dlsp_total_pct_pib]);
  const centralPts = useMemo(() => toPoints(divida.dlsp_gov_central_pct_pib), [divida.dlsp_gov_central_pct_pib]);

  // Wedge DBGG − DLSP (meses em que AMBAS existem) — aproximação dos ativos públicos.
  const wedgePts = useMemo(() => {
    const dlspMap = new Map(divida.dlsp_total_pct_pib.map((p: PontoMensal) => [dataIso(p.data), p.valor]));
    const out: [string, number][] = [];
    for (const [iso, v] of dbggPts) {
      const d = dlspMap.get(iso);
      if (d != null && Number.isFinite(d)) out.push([iso, +(v - d).toFixed(2)]);
    }
    return out;
  }, [divida.dlsp_total_pct_pib, dbggPts]);

  // Máximo histórico da DBGG — CALCULADO da série, nunca hardcode.
  const maxDbgg = useMemo(() => maximoPonto(divida.dbgg_pct_pib), [divida.dbgg_pct_pib]);
  const dbggInfo = useMemo(() => deltaDozeMeses(divida.dbgg_pct_pib), [divida.dbgg_pct_pib]);

  const faixas = useMemo(() => codaceAreas(codaceMensal), [codaceMensal]);

  const series = useMemo(() => {
    const out: AzTimeSeries[] = [
      { id: "dbgg", label: "DBGG (bruta)", color: COR_DBGG, data: dbggPts },
      { id: "dlsp", label: "DLSP (líquida)", color: COR_DLSP, data: dlspPts },
    ];
    if (mostraCentral) out.push({ id: "central", label: "DLSP gov. central", color: COR_CENTRAL, data: centralPts });
    if (mostraWedge) out.push({ id: "wedge", label: "DBGG − DLSP (ativos)", color: COR_WEDGE, data: wedgePts });
    return out;
  }, [dbggPts, dlspPts, centralPts, wedgePts, mostraCentral, mostraWedge]);

  const refLines = useMemo(() => {
    const out: AzRefLine[] = [{ y: 70, label: "FMI ~70% (emergentes)", color: AZ_BRAND.rust }];
    if (maxDbgg) {
      out.push({
        y: maxDbgg.valor,
        label: `máx. ${fmtPct(maxDbgg.valor, 1)} · ${fmtMesCurto(dataIso(maxDbgg.data))}`,
        color: "#94A3B8",
      });
    }
    return out;
  }, [maxDbgg]);

  // Título afirmativo VERIFICADO contra o dado: direção dos últimos 12 meses da DBGG.
  const titulo = (() => {
    if (!dbggInfo) return "Dívida pública em % do PIB — trajetória";
    const nivel = `Dívida bruta em ${fmtPct(dbggInfo.valor, 1)} do PIB`;
    if (dbggInfo.delta12m == null) return nivel;
    if (dbggInfo.delta12m > 0.1) return `${nivel} — alta de ${fmtNum(dbggInfo.delta12m, 1)} p.p. em 12 meses`;
    if (dbggInfo.delta12m < -0.1) return `${nivel} — queda de ${fmtNum(Math.abs(dbggInfo.delta12m), 1)} p.p. em 12 meses`;
    return `${nivel} — praticamente estável em 12 meses`;
  })();

  return (
    <ChartCard
      title={titulo}
      subtitle="DBGG (métrica de comparação internacional) e DLSP (desconta os ativos do setor público), em % do PIB. As réguas: ~70% do PIB, referência do FMI para emergentes, e o máximo histórico da própria DBGG — calculado da série."
      toolbar={
        <>
          <ToggleChip
            ativo={mostraCentral}
            cor={COR_CENTRAL}
            label="DLSP gov. central"
            onClick={() => setMostraCentral((v) => !v)}
          />
          <ToggleChip
            ativo={mostraWedge}
            cor={COR_WEDGE}
            label="DBGG − DLSP (ativos)"
            onClick={() => setMostraWedge((v) => !v)}
          />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={dbggPts.length > 0 ? dbggPts[0][0] : undefined}
            max={dbggPts.length > 0 ? dbggPts[dbggPts.length - 1][0] : undefined}
            periods={["1y", "5y", "max"]}
          />
        </>
      }
      footer={
        <>
          DBGG (SGS 13762): governo geral — União, estados e municípios, padrão FMI. DLSP (SGS 4513): setor público
          consolidado, líquida de ativos (reservas internacionais, créditos ao BNDES). A régua de ~70% do PIB é a
          referência indicativa do FMI p/ emergentes (Fiscal Monitor/DSA) — limiar de atenção, não gatilho mecânico.
          Faixas cinzas: recessões CODACE/FGV (última datação: 2020).
          {mostraWedge ? (
            <>
              {" "}
              <strong>Nota de perímetro:</strong> DBGG − DLSP mistura perímetros (bruta: governo geral; líquida: setor
              público consolidado, inclui BCB e estatais) — leia como aproximação do colchão de ativos públicos, não
              como métrica oficial.
            </>
          ) : null}
        </>
      }
      stampGiro={geradoEm}
      stampDado={dbggInfo ? dataIso(dbggInfo.data) : null}
    >
      <AzTimeSeriesChart
        series={series}
        unit="%"
        period={period}
        height={380}
        xRefAreas={faixas}
        refLines={refLines}
        yAxisLabel="% do PIB"
      />
    </ChartCard>
  );
}
