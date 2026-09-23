"use client";

import { useMemo, useState } from "react";

import type { ContasExternasData, PiiPonto } from "@/lib/painel-contas-externas";
import { AzSegmented, ChartCard, CockpitChip, tomPorSinal } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtNum, fmtSignedPct } from "@/lib/format-br";
import { fmtSinal, fmtTrimPii, fmtUsBi, fmtUsBiSigned, isoMes, ultimoDe } from "./cockpit-shared";

type LenteLiq = "reservas" | "meses" | "guidotti";
const OPCOES_LIQ = [
  { id: "reservas", label: "Reservas" },
  { id: "meses", label: "Meses de importação" },
  { id: "guidotti", label: "Reservas ÷ dívida CP" },
];

/** Card — liquidez externa: reservas (diária/mensal), meses de importação e Guidotti-Greenspan aproximado. */
export function LiquidezExternaCard({ data }: { data: ContasExternasData }) {
  const [lente, setLente] = useState<LenteLiq>("reservas");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const { bloco_c } = data;
  const pii = useMemo(() => data.pii?.serie ?? [], [data.pii]);

  const series = useMemo(() => {
    const mensal = (bloco_c.reservas_mensal ?? [])
      .filter((r) => r.reservas_us_bi != null && r.mes >= "1995-01-01")
      .map((r) => [isoMes(r.mes), r.reservas_us_bi as number] as const);
    const diaria = bloco_c.reservas_diaria.map((r) => [r.data, r.reservas_us_bi] as const);
    // mensal até o início da diária + diária (a diária cobre só 5 anos)
    const iniDiaria = diaria[0]?.[0] ?? "9999";
    const reservas = [...mensal.filter((p) => p[0] < iniDiaria), ...diaria];
    const meses = (bloco_c.meses_importacao_serie ?? [])
      .filter((r) => r.meses_bens_servicos != null)
      .map((r) => [isoMes(r.mes), r.meses_bens_servicos as number] as const);
    const guid = pii.filter((p) => p.guidotti != null).map((p) => [p.mes_fim, p.guidotti as number] as const);
    return { reservas, meses, guid };
  }, [bloco_c, pii]);

  const pts = lente === "reservas" ? series.reservas : lente === "meses" ? series.meses : series.guid;
  const resU = data.hero.reservas_us_bi;
  const r12 = series.reservas.length > 260 ? series.reservas[series.reservas.length - 253] : undefined;
  const mesesU = ultimoDe(series.meses);
  const piiU = ultimoDe(pii);

  return (
    <ChartCard
      id="liquidez-externa"
      title={
        lente === "reservas"
          ? "Reservas internacionais — conceito liquidez"
          : lente === "meses"
            ? "Reservas em meses de importação de bens e serviços"
            : "Reservas ÷ dívida externa de curto prazo (prazo original)"
      }
      subtitle={
        lente === "reservas"
          ? "BCB/SGS 13982 (diária, 5 anos) · 3546 (mensal, antes) · US$ bi"
          : lente === "meses"
            ? "Reservas 3546 ÷ (importações de bens 12m + despesa de serviços 22721 12m) ÷ 12 · régua FMI 3 meses"
            : "PII trimestral: reservas 24039 ÷ (24053 + 24058 + 24061 + 24064 + 24066) · régua Guidotti-Greenspan = 1"
      }
      toolbar={
        <>
          <AzSegmented ariaLabel="Métrica" options={OPCOES_LIQ} value={lente} onChange={(id) => setLente(id as LenteLiq)} />
          <AzPeriodSelector value={period} onChange={setPeriod} min={pts[0]?.[0]} max={pts[pts.length - 1]?.[0]} periods={["1y", "5y", "10y", "max"]} />
        </>
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <b>Réguas.</b> Três meses de importação é a regra de bolso do FMI; o Brasil opera muito acima, e a métrica que
            discrimina é a cobertura da dívida de curto prazo. Guidotti-Greenspan: reservas ≥ dívida externa que vence em 12
            meses (razão ≥ 1).
          </p>
          <p>
            <b>Aproximação declarada.</b> O SGS não publica a dívida por prazo RESIDUAL; aqui o denominador é a dívida de curto
            prazo por prazo ORIGINAL montada dos passivos da PII (moeda e depósitos, empréstimos de curto prazo de bancos,
            governo e demais setores, créditos comerciais). Como não inclui as amortizações de longo prazo que vencem em 12
            meses, a razão é um teto do indicador oficial — leia a tendência, não o nível.
          </p>
        </div>
      }
      stampGiro={data.gerado_em}
      stampDado={lente === "reservas" ? data.ultima_referencia_diaria : lente === "meses" ? mesesU?.[0].slice(0, 7) : piiU?.trim}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(r12 && resU.valor != null ? resU.valor - r12[1] : null)}>
          reservas {fmtUsBi(resU.valor, 1)} {resU.data ? `em ${fmtDataBR(resU.data)}` : ""}
          {r12 && resU.valor != null ? ` · ${fmtSinal(resU.valor - r12[1], 1)} bi em ~12m` : ""}
        </CockpitChip>
        <CockpitChip tom="navy">{mesesU ? `${fmtNum(mesesU[1], 1)} meses de importação` : "—"}</CockpitChip>
        <CockpitChip tom={piiU?.guidotti != null && piiU.guidotti >= 1 ? "pos" : "neg"}>
          reservas ÷ dívida CP {piiU?.guidotti != null ? fmtNum(piiU.guidotti, 2) : "—"}× {piiU ? `(${fmtTrimPii(piiU.trim)})` : ""}
        </CockpitChip>
      </div>
      <AzTimeSeriesChart        niceYTicks        series={[{ id: lente, label: OPCOES_LIQ.find((o) => o.id === lente)?.label ?? lente, color: AZ_BRAND.azure, data: pts }]}
        yAxisLabel={lente === "reservas" ? "US$ bi" : lente === "meses" ? "meses" : "vezes"}
        period={period}
        height={260}
        showLegend={false}
        dots={lente === "guidotti" ? 2 : false}
        refLines={
          lente === "meses"
            ? [{ y: 3, color: AZ_CHART.neg, label: "3 meses (FMI)" }]
            : lente === "guidotti"
              ? [{ y: 1, color: AZ_CHART.neg, label: "1× (Guidotti-Greenspan)" }]
              : undefined
        }
      />
    </ChartCard>
  );
}

type LentePii = "pib" | "usd";
const OPCOES_PII = [
  { id: "pib", label: "% PIB" },
  { id: "usd", label: "US$ bi" },
];

/** Card — posição de investimento internacional (estoques trimestrais). */
export function PiiCard({ pii, geradoEm }: { pii: PiiPonto[]; geradoEm: string }) {
  const [lente, setLente] = useState<LentePii>("pib");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const emPib = lente === "pib";
  const s = useMemo(() => {
    const f = (k: keyof PiiPonto) =>
      pii
        .map((p) => {
          const v = p[k] as number | null;
          if (v == null) return null;
          if (!emPib) return [p.mes_fim, v] as const;
          return p.pib_12m ? ([p.mes_fim, +((v / p.pib_12m) * 100).toFixed(2)] as const) : null;
        })
        .filter((x): x is readonly [string, number] => x != null);
    return { liquida: f("liquida"), ativos: f("ativos"), passivos: f("passivos"), idp: f("idp"), carteira: f("carteira_passivos") };
  }, [pii, emPib]);
  const u = ultimoDe(pii);
  const a = pii.length > 4 ? pii[pii.length - 5] : undefined;
  const liqPib = u?.liquida != null && u.pib_12m ? (u.liquida / u.pib_12m) * 100 : null;
  const liqPibA = a?.liquida != null && a.pib_12m ? (a.liquida / a.pib_12m) * 100 : null;

  return (
    <ChartCard
      id="pii"
      title="Posição de investimento internacional — estoques"
      subtitle="BCB/SGS 24010 (líquida) · 24011 (ativos) · 24040 (passivos) · 24041 (IDP) · 24044 (carteira) · trimestral"
      toolbar={
        <>
          <AzSegmented ariaLabel="Unidade" options={OPCOES_PII} value={lente} onChange={(id) => setLente(id as LentePii)} />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={s.liquida[0]?.[0]}
            max={s.liquida[s.liquida.length - 1]?.[0]}
            periods={["5y", "10y", "max"]}
          />
        </>
      }
      footer={
        <p>
          A PII é o balanço patrimonial externo do país: ativos (IDE, carteira, outros investimentos e reservas) menos passivos
          (IDP, carteira, outros investimentos). Muda por fluxos do BP e por variação de preços e câmbio — uma depreciação do
          real reduz o valor em dólar dos passivos em reais (ações e títulos domésticos) e melhora a posição líquida sem
          nenhum fluxo. % do PIB sobre o PIB 12m em US$ do fim do trimestre.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={u?.trim}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(liqPib != null && liqPibA != null ? liqPib - liqPibA : null)}>
          {u ? fmtTrimPii(u.trim) : "—"} · PII líquida {fmtUsBiSigned(u?.liquida ?? null, 0)} · {fmtSignedPct(liqPib, 1)} PIB
          {liqPib != null && liqPibA != null ? ` · ${fmtSinal(liqPib - liqPibA, 1)} p.p. em 4T` : ""}
        </CockpitChip>
        <CockpitChip tom="navy">
          passivos {fmtUsBi(u?.passivos ?? null, 0)} · dos quais IDP {fmtUsBi(u?.idp ?? null, 0)}
        </CockpitChip>
      </div>
      <AzTimeSeriesChart        niceYTicks        series={[
          { id: "liq", label: "PII líquida", color: AZ_BRAND.navy, data: s.liquida },
          { id: "at", label: "Ativos", color: AZ_SERIES[3], data: s.ativos },
          { id: "pa", label: "Passivos", color: AZ_SERIES[2], data: s.passivos },
          { id: "idp", label: "IDP (estoque)", color: AZ_SERIES[6], data: s.idp },
          { id: "cart", label: "Carteira (passivos)", color: AZ_SERIES[0], data: s.carteira },
        ]}
        unit={emPib ? "%" : "none"}
        yAxisLabel={emPib ? "% do PIB" : "US$ bi"}
        period={period}
        height={260}
        dots={2}
        refLines={[{ y: 0, color: AZ_CHART.zero, dashed: false }]}
      />
    </ChartCard>
  );
}
