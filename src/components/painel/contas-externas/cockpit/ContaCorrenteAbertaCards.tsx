"use client";

import { useMemo, useState } from "react";

import type { BpMestre, Renda12mPonto, Servicos12mPonto } from "@/lib/painel-contas-externas";
import { AzSegmented, ChartCard, CockpitChip, tomPorSinal } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_CHART, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtSignedPct } from "@/lib/format-br";
import { StackedBpChart } from "./StackedBpChart";
import { fmtSinal, fmtUsBi, fmtUsBiSigned, isoMes, num, recorta, serieBp, ultimoDe, val } from "./cockpit-shared";

/** Card — comércio de bens (BPM6): exportações, importações e saldo 12m. */
export function BensCard({ bp, geradoEm }: { bp: BpMestre; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const x = useMemo(() => serieBp(bp.acum_12m, "bens_x"), [bp.acum_12m]);
  const mm = useMemo(() => serieBp(bp.acum_12m, "bens_m"), [bp.acum_12m]);
  const s = useMemo(() => serieBp(bp.acum_12m, "bens"), [bp.acum_12m]);
  const ult = ultimoDe(bp.acum_12m);
  const ant = bp.acum_12m.length > 12 ? bp.acum_12m[bp.acum_12m.length - 13] : undefined;
  const varPct = (k: string) => {
    const a = val(ult, k);
    const b = val(ant, k);
    return a != null && b != null && b !== 0 ? (a / b - 1) * 100 : null;
  };
  // recorde do saldo 12m na série
  const recorde = s.reduce<[string, number] | null>((best, p) => (best == null || p[1] > best[1] ? [p[0], p[1]] : best), null);

  return (
    <ChartCard
      id="bens"
      title="Bens — exportações, importações e saldo 12m"
      subtitle="BCB/SGS 22711 (exportações) · 22707 (saldo) · importações = exportações − saldo · US$ bi, BPM6"
      toolbar={
        <AzPeriodSelector value={period} onChange={setPeriod} min={x[0]?.[0]} max={x[x.length - 1]?.[0]} periods={["5y", "10y", "max"]} />
      }
      footer={
        <p>
          Comércio de bens no conceito do balanço de pagamentos (BPM6: mudança de propriedade, inclui mercadorias sob
          merchanting e ouro não monetário). Difere do saldo aduaneiro da SECEX por desenho. Variações do chip: 12m contra
          os 12m encerrados um ano antes.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={ult?.mes.slice(0, 7)}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(varPct("bens_x"))}>
          exportações {fmtUsBi(val(ult, "bens_x"), 1)} · {fmtSignedPct(varPct("bens_x"), 1)} a/a
        </CockpitChip>
        <CockpitChip tom={tomPorSinal(varPct("bens_m"))}>
          importações {fmtUsBi(val(ult, "bens_m"), 1)} · {fmtSignedPct(varPct("bens_m"), 1)} a/a
        </CockpitChip>
        <CockpitChip tom="navy">
          saldo {fmtUsBiSigned(val(ult, "bens"), 1)}
          {recorde ? ` · recorde ${fmtUsBi(recorde[1], 1)} (${fmtMesCurto(recorde[0])})` : ""}
        </CockpitChip>
      </div>
      <AzTimeSeriesChart        niceYTicks        series={[
          { id: "x", label: "Exportações 12m", color: AZ_SERIES[3], data: x },
          { id: "m", label: "Importações 12m", color: AZ_SERIES[2], data: mm },
          { id: "s", label: "Saldo 12m", color: AZ_SERIES[1], data: s },
        ]}
        yAxisLabel="US$ bi"
        period={period}
        height={260}
        refLines={[{ y: 0, color: AZ_CHART.zero, dashed: false }]}
      />
    </ChartCard>
  );
}

type LenteRendas = "servicos" | "renda";
const OPCOES_RENDAS = [
  { id: "servicos", label: "Serviços" },
  { id: "renda", label: "Renda primária" },
];
const STACKS_SERV = [
  { key: "transportes", label: "Transportes", color: AZ_SERIES[0] },
  { key: "viagens", label: "Viagens", color: AZ_SERIES[2] },
  { key: "telecom_informatica", label: "Telecom/informática", color: AZ_SERIES[4] },
  { key: "propriedade_intelectual", label: "Prop. intelectual", color: AZ_SERIES[5] },
  { key: "demais", label: "Demais", color: AZ_SERIES[7] },
];
const STACKS_RENDA = [
  { key: "lucros_dividendos_idp", label: "Lucros e dividendos (IDP)", color: AZ_SERIES[2] },
  { key: "lucros_reinvestidos", label: "Lucros reinvestidos", color: AZ_SERIES[5] },
  { key: "juros_e_demais", label: "Juros e demais", color: AZ_SERIES[4] },
  { key: "salarios", label: "Salários", color: AZ_SERIES[6] },
];

/** Card — serviços por conta e renda primária por componente (12m). */
export function ServicosRendaCard({
  servicos,
  renda,
  geradoEm,
}: {
  servicos: Servicos12mPonto[];
  renda: Renda12mPonto[];
  geradoEm: string;
}) {
  const [lente, setLente] = useState<LenteRendas>("servicos");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const ehServ = lente === "servicos";
  const base = (ehServ ? servicos : renda) as ReadonlyArray<{ mes: string } & Record<string, unknown>>;
  const stacks = ehServ ? STACKS_SERV : STACKS_RENDA;
  const rows = useMemo(() => recorta(base, period), [base, period]);
  const ult = ultimoDe(base);
  const ant = base.length > 12 ? base[base.length - 13] : undefined;
  const tot = num(ult, "total");
  const dTot = tot != null && num(ant, "total") != null ? tot - (num(ant, "total") as number) : null;

  return (
    <ChartCard
      id="servicos-renda"
      title={ehServ ? "Serviços — saldo 12m por conta" : "Renda primária — saldo 12m por componente"}
      subtitle={
        ehServ
          ? "BCB/SGS 22728 · 22740 · 22776 · 22779 · demais = residual de 22719 · linha navy = total · US$ bi"
          : "BCB/SGS 22812 · 22815 · 22803 · juros e demais = 22806 − 22812 − 22815 · linha navy = 22800 · US$ bi"
      }
      toolbar={
        <>
          <AzSegmented ariaLabel="Conta" options={OPCOES_RENDAS} value={lente} onChange={(id) => setLente(id as LenteRendas)} />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={base[0] ? isoMes(base[0].mes) : undefined}
            max={ult ? isoMes(ult.mes) : undefined}
            periods={["5y", "10y", "max"]}
          />
        </>
      }
      footer={
        <p>
          Serviços: déficit estrutural concentrado em transportes (fretes), viagens, telecom/computação e propriedade
          intelectual (royalties); &ldquo;demais&rdquo; é o residual auditado. Renda primária: remuneração do capital
          estrangeiro instalado — lucros e dividendos de investimento direto, lucros reinvestidos (contrapartida do
          reinvestimento no IDP) e juros de carteira/empréstimos.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={ult?.mes.slice(0, 7)}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(dTot)}>
          {ult ? fmtMesCurto(isoMes(ult.mes)) : "—"} · total {fmtUsBiSigned(tot, 1)} · {fmtSinal(dTot, 1)} bi em 12m
        </CockpitChip>
      </div>
      <StackedBpChart
        rows={rows as { mes: string }[]}
        stacks={stacks}
        totalKey="total"
        totalLabel="Total"
        valueFmt={(v) => fmtUsBiSigned(v, 1)}
      />
    </ChartCard>
  );
}
