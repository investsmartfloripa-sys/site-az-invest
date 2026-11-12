"use client";

import { useMemo, useState } from "react";

import type { BpMestre } from "@/lib/painel-contas-externas";
import { ChartCard, CockpitChip, tomPorSinal } from "@/components/painel/core";
import { SegmentedRolavel } from "@/components/painel/contas-externas/SegmentedRolavel";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { StackedBpChart } from "./StackedBpChart";
import { finsDeTrimestre, fmtUsBiSigned, isoMes, pctPib, recorta, ultimoDe, val } from "./cockpit-shared";

const PERIODOS = ["5y", "10y", "max"] as const;

// Quatro grupos (derivativos, pequenos, somados a outros investimentos) e barras no fim de cada
// trimestre: com cinco cores em barras mensais de 10 anos nenhuma série era legível (revisão 12/11/2026).
const STACKS_CF = [
  { key: "inv_direto", label: "Investimento direto", color: AZ_SERIES[3] },
  { key: "carteira", label: "Carteira", color: AZ_SERIES[0] },
  { key: "outros_deriv", label: "Outros investimentos e derivativos", color: AZ_SERIES[5] },
  { key: "reservas", label: "Ativos de reserva", color: AZ_SERIES[2] },
];

/** Card — conta financeira 12m por função (convenção BPM6: ativos − passivos). */
export function ContaFinanceiraFuncaoCard({ bp, geradoEm }: { bp: BpMestre; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const rows = useMemo(
    () =>
      finsDeTrimestre(recorta(bp.acum_12m, period)).map((r) => {
        const o = val(r, "outros_inv");
        const dv = val(r, "derivativos");
        return { ...r, outros_deriv: o != null || dv != null ? (o ?? 0) + (dv ?? 0) : null };
      }),
    [bp.acum_12m, period],
  );
  const ult = ultimoDe(bp.acum_12m);
  return (
    <ChartCard
      id="conta-financeira"
      title="Conta financeira — 12m por função (ativos − passivos)"
      subtitle="BCB/SGS 22863 = 22864 + 22905 + 22966 + 22969 + 23043 · NEGATIVO = entrada líquida · US$ bi"
      toolbar={
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={isoMes(bp.acum_12m[0]?.mes ?? "1996-12-01")}
          max={isoMes(ult?.mes ?? "2026-01-01")}
          periods={[...PERIODOS]}
        />
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <b>Leitura do sinal.</b> No BPM6 a conta financeira é aquisição líquida de ativos menos incorrência líquida
            de passivos. Um país com déficit em transações correntes tem conta financeira NEGATIVA (recebe recursos do
            exterior): barras abaixo do zero são financiamento, acima são saída de capital. Os ativos de reserva entram
            positivos quando o BC acumula reservas.
          </p>
          <p>
            <b>Fecho.</b> Conta financeira ≈ TC + conta capital + erros e omissões (identidade auditada). A linha navy é a
            conta financeira total. Derivativos, pequenos, aparecem somados a outros investimentos; uma barra por fim de
            trimestre (mais o último mês divulgado).
          </p>
        </div>
      }
      stampGiro={geradoEm}
      stampDado={ult?.mes.slice(0, 7)}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom="navy">
          {ult ? fmtMesCurto(isoMes(ult.mes)) : "—"} · conta financeira {fmtUsBiSigned(val(ult, "conta_financeira"), 1)} ·{" "}
          {fmtSignedPct(pctPib(ult, "conta_financeira"), 2)} PIB
        </CockpitChip>
        <CockpitChip tom="navy">erros e omissões {fmtUsBiSigned(val(ult, "erros_omissoes"), 1)}</CockpitChip>
      </div>
      <StackedBpChart rows={rows} stacks={STACKS_CF} totalKey="conta_financeira" totalLabel="Conta financeira" valueFmt={(v) => fmtUsBiSigned(v, 1)} />
    </ChartCard>
  );
}

type LenteCob = "cobertura" | "nfe";
const OPCOES_COB = [
  { id: "nfe", label: "TC × IDP (% PIB)" },
  { id: "cobertura", label: "Cobertura (%)" },
];

/** Card — cobertura do déficit em TC pelo IDP e necessidade de financiamento externo. */
export function CoberturaIdpCard({ bp, geradoEm }: { bp: BpMestre; geradoEm: string }) {
  const [lente, setLente] = useState<LenteCob>("nfe");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const rows = bp.acum_12m;

  const s = useMemo(() => {
    const tc: [string, number][] = [];
    const idp: [string, number][] = [];
    const nfe: [string, number][] = [];
    const cob: [string, number][] = [];
    for (const r of rows) {
      const t = pctPib(r, "tc");
      const i = pctPib(r, "idp");
      const iso = isoMes(r.mes);
      if (t != null) tc.push([iso, +t.toFixed(2)]);
      if (i != null) idp.push([iso, +i.toFixed(2)]);
      if (t != null && i != null) nfe.push([iso, +(t + i).toFixed(2)]);
      const tv = val(r, "tc");
      const iv = val(r, "idp");
      if (tv != null && iv != null && tv < 0) cob.push([iso, +((iv / -tv) * 100).toFixed(1)]);
    }
    return { tc, idp, nfe, cob };
  }, [rows]);

  const ult = ultimoDe(rows);
  const tcU = pctPib(ult, "tc");
  const idpU = pctPib(ult, "idp");
  const nfeU = tcU != null && idpU != null ? tcU + idpU : null;
  const cobU = val(ult, "tc") != null && (val(ult, "tc") as number) < 0 && val(ult, "idp") != null ? ((val(ult, "idp") as number) / -(val(ult, "tc") as number)) * 100 : null;
  const pts = lente === "nfe" ? s.tc : s.cob;

  return (
    <ChartCard
      id="cobertura-idp"
      title={lente === "nfe" ? "TC, IDP e necessidade de financiamento externo — 12m, % PIB" : "Cobertura do déficit em TC pelo IDP — 12m"}
      subtitle={
        lente === "nfe"
          ? "TC (22701) · IDP (22885) · NFE = TC + IDP (positivo = IDP cobre o déficit) · ÷ PIB 12m US$ (4192)"
          : "IDP 12m ÷ |TC 12m| × 100 · só meses com déficit em TC · régua 100%"
      }
      toolbar={
        <>
          <SegmentedRolavel ariaLabel="Lente" options={OPCOES_COB} value={lente} onChange={(id) => setLente(id as LenteCob)} />
          <AzPeriodSelector value={period} onChange={setPeriod} min={pts[0]?.[0]} max={pts[pts.length - 1]?.[0]} periods={[...PERIODOS]} />
        </>
      }
      footer={
        <p>
          O IDP é a fonte de financiamento mais estável (capital de longo prazo, pouco sensível a choques). Cobertura ≥ 100%
          = o déficit em transações correntes está integralmente financiado por investimento direto; a necessidade de
          financiamento externo (NFE, conceito do BCB) é TC + IDP — positiva quando sobra IDP. Em meses de superávit em TC
          a razão de cobertura não tem leitura e some do gráfico.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={ult?.mes.slice(0, 7)}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={cobU != null && cobU >= 100 ? "pos" : "neg"}>
          cobertura {cobU != null ? fmtPct(cobU, 0) : "— (TC superavitária)"}
        </CockpitChip>
        <CockpitChip tom={tomPorSinal(nfeU)}>
          TC {fmtSignedPct(tcU, 2)} · IDP {fmtSignedPct(idpU, 2)} · NFE {fmtSignedPct(nfeU, 2)} do PIB
        </CockpitChip>
      </div>
      {lente === "nfe" ? (
        <AzTimeSeriesChart          niceYTicks          series={[
            { id: "tc", label: "TC 12m", color: AZ_SERIES[2], data: s.tc },
            { id: "idp", label: "IDP 12m", color: AZ_SERIES[3], data: s.idp },
            { id: "nfe", label: "NFE = TC + IDP", color: AZ_BRAND.navy, data: s.nfe },
          ]}
          unit="%"
          yAxisLabel="% do PIB"
          period={period}
          height={260}
          refLines={[{ y: 0, color: AZ_CHART.zero, dashed: false }]}
        />
      ) : (
        <AzTimeSeriesChart          niceYTicks          series={[{ id: "cob", label: "Cobertura IDP", color: AZ_BRAND.azure, data: s.cob }]}
          unit="%"
          yAxisLabel="% do déficit"
          period={period}
          height={260}
          showLegend={false}
          refLines={[{ y: 100, color: AZ_CHART.pos, label: "100%" }]}
        />
      )}
    </ChartCard>
  );
}

type LentePass = "12m" | "mensal";
const OPCOES_PASS = [
  { id: "12m", label: "12 meses" },
  { id: "mensal", label: "Mensal" },
];
// Instrumentos do passivo (BPM6) somados em quatro grupos para o gráfico: com oito cores empilhadas em
// barras mensais nenhuma série era legível (revisão 12/11/2026).
const INSTRUMENTOS_PASS: ReadonlyArray<{ grupo: string; keys: readonly string[] }> = [
  { grupo: "idp", keys: ["idp_participacao", "idp_reinvestimento", "idp_intercompanhia"] },
  { grupo: "carteira", keys: ["acoes_passivos", "fundos_passivos", "titulos_domesticos", "titulos_externos"] },
  { grupo: "emprestimos", keys: ["emprestimos_passivos"] },
  { grupo: "creditos", keys: ["credito_comercial_passivos"] },
];
const STACKS_PASS = [
  { key: "idp", label: "IDP", color: AZ_SERIES[3] },
  { key: "carteira", label: "Carteira (ações, fundos e títulos)", color: AZ_SERIES[0] },
  { key: "emprestimos", label: "Empréstimos", color: AZ_SERIES[5] },
  { key: "creditos", label: "Créditos comerciais", color: AZ_SERIES[2] },
];

/** Card — ingressos de não residentes (passivos) por instrumento. */
export function NaoResidentesCard({ bp, geradoEm }: { bp: BpMestre; geradoEm: string }) {
  const [lente, setLente] = useState<LentePass>("12m");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const ehMensal = lente === "mensal";
  const base = ehMensal ? bp.mensal : bp.acum_12m;
  const div = ehMensal ? 1000 : 1; // mensal vem em US$ mi
  const all = useMemo(
    () =>
      base.map((r) => {
        const o: Record<string, number | string | null> = { mes: r.mes };
        for (const g of INSTRUMENTOS_PASS) {
          const vs = g.keys.map((k) => val(r, k));
          o[g.grupo] = vs.every((v) => v == null) ? null : vs.reduce<number>((acc, v) => acc + (v ?? 0), 0) / div;
        }
        const soma = STACKS_PASS.reduce((acc, s) => acc + ((o[s.key] as number | null) ?? 0), 0);
        o.total = +soma.toFixed(3);
        return o as { mes: string } & Record<string, number | null>;
      }),
    [base, div],
  );
  const rows = useMemo(() => (ehMensal ? all : finsDeTrimestre(recorta(all, period))), [all, period, ehMensal]);
  const ult = ultimoDe(all);
  const carteira = ult ? (ult.carteira ?? null) : null;

  return (
    <ChartCard
      id="nao-residentes"
      title="Passivos — ingressos líquidos de não residentes por instrumento"
      subtitle="IDP 22891 · 22892 · 22893 · carteira 22927 + 22936 · 22942 · 22945 · empréstimos 22994 · créditos comerciais 23026 · US$ bi"
      toolbar={
        <>
          <SegmentedRolavel ariaLabel="Janela" options={OPCOES_PASS} value={lente} onChange={(id) => setLente(id as LentePass)} />
          {!ehMensal ? (
            <AzPeriodSelector
              value={period}
              onChange={setPeriod}
              min={isoMes(all[0]?.mes ?? "1996-12-01")}
              max={isoMes(ult?.mes ?? "2026-01-01")}
              periods={[...PERIODOS]}
            />
          ) : null}
        </>
      }
      footer={
        <p>
          Lado do passivo da conta financeira: quanto os não residentes aplicaram líquido no país, por instrumento. Separa
          o capital de longo prazo (IDP) do &ldquo;hot money&rdquo; de carteira (ações, fundos e títulos de renda fixa no
          mercado doméstico, sensíveis a juro e câmbio) e do financiamento via empréstimos e créditos comerciais. Positivo =
          entrada. IDP soma participação no capital, reinvestimento de lucros e operações intercompanhia; carteira soma
          ações, fundos e títulos no país e no exterior. Em 12 meses, uma barra por fim de trimestre (mais o último mês);
          mensal: últimos 60 meses, sem acumular — ruidoso por construção.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={ult?.mes.slice(0, 7)}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(ult?.total)}>
          {ult ? fmtMesCurto(isoMes(ult.mes)) : "—"} · total {fmtUsBiSigned(ult?.total ?? null, 1)} {ehMensal ? "no mês" : "em 12m"}
        </CockpitChip>
        <CockpitChip tom={tomPorSinal(carteira)}>carteira (ações + títulos) {fmtUsBiSigned(carteira, 1)}</CockpitChip>
      </div>
      <StackedBpChart rows={rows} stacks={STACKS_PASS} totalKey="total" totalLabel="Total passivos" valueFmt={(v) => fmtUsBiSigned(v, ehMensal ? 2 : 1)} yTickFmt={(v) => fmtNum(v, 0)} />
    </ChartCard>
  );
}

