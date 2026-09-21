"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadeIbcBrData, AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, CockpitChip, tomPorSinal } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtSignedPct } from "@/lib/format-br";
import { codaceAreas, fmtTrimCurto, mesIso, num } from "../../shared";
import { nowcastQtd, rebaseMedia, trimIsoInicio } from "../cockpit-shared";

/**
 * COCKPIT · IBC-Br SA × PIB SA, ambos rebasados para média de 2019 = 100.
 * IBC-Br mensal (BCB SGS 24364) em linha; PIB trimestral (SIDRA 1621) em
 * degraus ancorados no 1º mês de cada trimestre-calendário. Chips: nowcast QTD
 * do trimestre corrente (CALCULADO no site via `nowcastQtd`), MoM, 3m/3m SAAR
 * e YoY mm3 do último mês divulgado. Adapta o antigo IbcBrPibCard.
 */

/** "2026-T02" → ISO do TERCEIRO mês do trimestre ("2026-06-01") — fecha o último degrau. */
function trimIsoFim(trim: string): string | null {
  const m = trim.match(/^(\d{4})-T(\d{1,2})$/);
  if (!m) return null;
  const mes = (parseInt(m[2], 10) - 1) * 3 + 3;
  return `${m[1]}-${String(mes).padStart(2, "0")}-01`;
}

export function IbcBrNowcastCard({
  ibcbr,
  pib,
  codace,
  geradoEm,
}: {
  ibcbr: AtividadeIbcBrData;
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  // IBC-Br SA mensal → média 2019 = 100.
  const ibcbrPts = useMemo(() => {
    const brutos: AzSeriesPoint[] = [];
    for (const r of ibcbr.serie) {
      if (r.indice_sa != null && Number.isFinite(r.indice_sa)) brutos.push([mesIso(r.mes), r.indice_sa]);
    }
    return rebaseMedia(brutos);
  }, [ibcbr.serie]);

  // PIB SA trimestral → média 2019 = 100, ancorado no 1º mês do trimestre
  // (stepAfter segura o valor pelos 3 meses). O último trimestre ganha um
  // ponto de fechamento no 3º mês (mesmo valor) só para o degrau cobrir o
  // trimestre inteiro — não é observação nova.
  const pibPts = useMemo(() => {
    const brutos: AzSeriesPoint[] = [];
    let ultimoTrim: string | null = null;
    for (const r of pib.indice_volume.serie) {
      const v = num(r, "sa_pib");
      if (v != null) {
        brutos.push([trimIsoInicio(r.trim), v]);
        ultimoTrim = r.trim;
      }
    }
    const rebasado = rebaseMedia(brutos);
    if (rebasado.length === 0 || !ultimoTrim) return rebasado;
    const fim = trimIsoFim(ultimoTrim);
    const ult = rebasado[rebasado.length - 1];
    if (fim && fim > ult[0]) return [...rebasado, [fim, ult[1]] as const];
    return rebasado;
  }, [pib.indice_volume.serie]);

  const faixas = useMemo(() => codaceAreas(codace?.mensal), [codace]);

  // Último mês divulgado do IBC-Br (mes_recente; fallback = última linha).
  const ult = useMemo(
    () => ibcbr.serie.find((r) => r.mes === ibcbr.mes_recente) ?? ibcbr.serie[ibcbr.serie.length - 1],
    [ibcbr.serie, ibcbr.mes_recente],
  );
  const nc = useMemo(() => nowcastQtd(ibcbr), [ibcbr]);

  const mesUlt = ult ? fmtMesCurto(ult.mes) : "—";
  const varMom = ult?.var_mom ?? null;
  const varSaar = ult?.var_3m3m_saar ?? null;
  const varYoyMm3 = ult?.var_yoy_mm3 ?? null;
  const ritmoBuilder = ult?.var_ritmo_trimestral ?? null;

  // Range do seletor = união das duas séries (IBC-Br desde 2003, PIB desde 2006-T03).
  const { minIso, maxIso } = useMemo(() => {
    const isos = [...ibcbrPts, ...pibPts].map(([d]) => d).sort();
    return { minIso: isos[0] ?? "", maxIso: isos[isos.length - 1] ?? "" };
  }, [ibcbrPts, pibPts]);

  const rotuloNowcast = nc
    ? `prévia ${fmtTrimCurto(nc.trimCorrente)} (${nc.mesesDivulgados} de 3 meses): ${fmtSignedPct(nc.valor, 1)}`
    : "prévia QTD: —";

  return (
    <ChartCard
      id="ibcbr-nowcast"
      title="IBC-Br × PIB — índice SA, média 2019 = 100"
      subtitle="BCB SGS 24364 · SIDRA 1621 · prévia mensal do trimestre corrente · nowcast QTD = média SA dos meses divulgados do trimestre ÷ média do trimestre anterior − 1 · PIB em degraus por trimestre-calendário"
      toolbar={
        <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
      }
      footer={
        <span>
          <span className="mb-1 block">
            <b>Prévia QTD</b> (quarter-to-date, trimestre-calendário) é CALCULADA no site: média do índice SA dos meses já
            divulgados do trimestre corrente ÷ média SA dos 3 meses do trimestre anterior − 1. Difere do{" "}
            <b>ritmo trimestral</b> gravado pelo builder (<i>var_ritmo_trimestral</i>), que é a média móvel ROLANTE de 3
            meses vs os 3 meses anteriores (ex.: mai–jul vs fev–abr){ritmoBuilder != null ? ` — ${mesUlt}: ${fmtSignedPct(ritmoBuilder, 1)}` : ""}.
            O trimestre corrente do IBC-Br é PARCIAL: a prévia muda a cada mês novo.
          </span>
          <span className="mb-1 block">
            <b>MoM</b> = variação vs mês anterior (índice SA). <b>3m/3m SAAR</b> = média móvel de 3 meses do índice SA vs
            os 3 meses anteriores, anualizada. <b>YoY mm3</b> = variação vs mesmo mês do ano anterior calculada sobre o
            índice SEM ajuste sazonal (convenção oficial do BCB), suavizada em média móvel de 3 meses.
          </span>
          <span className="mb-1 block">
            <b>SA</b> = com ajuste sazonal; <b>NS</b> = sem ajuste sazonal. IBC-Br: BCB SGS 24364 (índice SA). PIB:
            SIDRA 1621 (índice de volume SA, média 1995 = 100). Ambos
            rebasados para MÉDIA DE 2019 = 100 no site (ano cheio pré-pandemia). O degrau do PIB começa no 1º mês do
            trimestre e cobre os 3 meses; o último degrau só fecha com a divulgação oficial do IBGE (~60 dias após o fim
            do trimestre) — até lá o trimestre corrente só existe no IBC-Br. A linha &ldquo;média 2019&rdquo; aparece
            quando a janela inclui valores próximos de 100.
          </span>
          <span className="block">Faixas sombreadas = recessões da cronologia mensal do CODACE/FGV (contexto histórico).</span>
        </span>
      }
      stampGiro={geradoEm}
      stampDado={ibcbr.mes_recente}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip
          tom={nc ? tomPorSinal(nc.valor) : "navy"}
          title="Nowcast QTD do trimestre-calendário corrente (calculado no site)"
        >
          {rotuloNowcast}
        </CockpitChip>
        <CockpitChip tom={tomPorSinal(varMom)} title="Variação mensal do índice SA vs mês anterior">
          MoM {mesUlt} {fmtSignedPct(varMom, 1)}
        </CockpitChip>
        <CockpitChip tom={tomPorSinal(varSaar)} title="Média móvel 3m vs 3m anteriores, anualizada">
          3m/3m SAAR {fmtSignedPct(varSaar, 1)}
        </CockpitChip>
        <CockpitChip tom={tomPorSinal(varYoyMm3)} title="Variação interanual (índice NS), média móvel de 3 meses">
          YoY mm3 {fmtSignedPct(varYoyMm3, 1)}
        </CockpitChip>
      </div>
      <AzTimeSeriesChart
        series={[
          { id: "ibcbr", label: "IBC-Br SA (mensal)", color: AZ_BRAND.azure, data: ibcbrPts },
          { id: "pib", label: "PIB SA (trimestral, degraus)", color: AZ_BRAND.navy, type: "stepAfter", data: pibPts },
        ]}
        unit="index"
        period={period}
        height={240}
        xRefAreas={faixas}
        refLines={[{ y: 100, label: "média 2019", color: AZ_CHART.ticks }]}
        variant="default"
      />
    </ChartCard>
  );
}
