"use client";

import { useMemo, useState } from "react";

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { FiscalClassicosData, PontoMensal } from "@/lib/painel-fiscal";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import { CockpitChip, codaceAreas, dataIso, deltaDozeMeses, maximoPonto, toPoints } from "./shared";

/**
 * ÂNCORA do Painel Dívida v2 — padrão cockpit: título FIXO técnico
 * ("DBGG × DLSP") com o nível e a direção 12m da DBGG num chip navy ao lado;
 * a leitura interpretativa vive no footer (?).
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

/**
 * Série opcional como caixa de marcar (revisão 12/11/2026): antes eram pílulas iguais ao chip de
 * valor e ao seletor de período, e não dava para saber o que era filtro e o que era informação.
 */
function ToggleSerie({ ativo, cor, label, onClick }: { ativo: boolean; cor: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ativo}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50"
    >
      <span
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border text-[10px] leading-none text-white"
        style={ativo ? { background: cor, borderColor: cor } : { borderColor: "#94A3B8", background: "#fff" }}
        aria-hidden
      >
        {ativo ? "✓" : ""}
      </span>
      <span className="inline-block h-0.5 w-3 rounded" style={{ background: cor }} aria-hidden />
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

  // Leitura interpretativa (direção 12m da DBGG) — vai para o footer (?), nunca para o título.
  const leitura = (() => {
    if (!dbggInfo) return null;
    const nivel = `Dívida bruta em ${fmtPct(dbggInfo.valor, 1)} do PIB`;
    if (dbggInfo.delta12m == null) return `${nivel}.`;
    if (dbggInfo.delta12m > 0.1) return `${nivel}, em alta de ${fmtNum(dbggInfo.delta12m, 1)} p.p. em 12 meses.`;
    if (dbggInfo.delta12m < -0.1)
      return `${nivel}, em queda de ${fmtNum(Math.abs(dbggInfo.delta12m), 1)} p.p. em 12 meses.`;
    return `${nivel}, praticamente estável em 12 meses.`;
  })();

  return (
    <ChartCard
      title="DBGG × DLSP (% do PIB)"
      subtitle="DBGG (métrica de comparação internacional) e DLSP (desconta os ativos do setor público), em % do PIB. As réguas: ~70% do PIB, referência do FMI para emergentes, e o máximo histórico da própria DBGG — calculado da série."
      toolbar={
        <>
          {dbggInfo ? (
            <CockpitChip>
              DBGG {fmtPct(dbggInfo.valor, 1)}
              {dbggInfo.delta12m != null ? ` · ${fmtSignedNum(dbggInfo.delta12m, 1)} p.p. 12m` : ""}
            </CockpitChip>
          ) : null}
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={dbggPts.length > 0 ? dbggPts[0][0] : undefined}
            max={dbggPts.length > 0 ? dbggPts[dbggPts.length - 1][0] : undefined}
            periods={["ytd", "1y", "5y", "max"]}
          />
        </>
      }
      footer={
        <>
          {leitura ? (
            <>
              <strong>Leitura.</strong> {leitura}{" "}
            </>
          ) : null}
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
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs text-zinc-500">Mostrar também:</span>
        <ToggleSerie
          ativo={mostraCentral}
          cor={COR_CENTRAL}
          label="DLSP do governo central"
          onClick={() => setMostraCentral((v) => !v)}
        />
        <ToggleSerie
          ativo={mostraWedge}
          cor={COR_WEDGE}
          label="DBGG − DLSP (ativos)"
          onClick={() => setMostraWedge((v) => !v)}
        />
      </div>
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
