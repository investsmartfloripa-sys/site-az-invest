"use client";

import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { BpMestre, FluxoCambial, FocusExterno } from "@/lib/painel-contas-externas";
import { AzSegmented, AzTooltip, ChartCard, CockpitChip, azGridProps, azXAxisProps, azYAxisProps, tomPorSinal } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_CHART, AZ_SERIES, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtMesCurto, fmtNum } from "@/lib/format-br";
import { StackedBpChart } from "./StackedBpChart";
import { fmtSinal, fmtUsBiSigned, isoMes, recorta, ultimoDe, val } from "./cockpit-shared";

type LenteFluxo = "mensal" | "12m" | "diario";
const OPCOES_FLUXO = [
  { id: "mensal", label: "Mensal" },
  { id: "12m", label: "12 meses" },
  { id: "diario", label: "Diário (90d)" },
];
const STACKS_FLUXO = [
  { key: "comercial", label: "Comercial", color: AZ_SERIES[3] },
  { key: "financeiro", label: "Financeiro", color: AZ_SERIES[0] },
];

/** Card — fluxo cambial contratado (comercial × financeiro). */
export function FluxoCambialCard({ fluxo, geradoEm }: { fluxo: FluxoCambial; geradoEm: string }) {
  const [lente, setLente] = useState<LenteFluxo>("mensal");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const rows = useMemo(() => {
    if (lente === "diario") return [];
    const base =
      lente === "mensal"
        ? fluxo.mensal
        : fluxo.mensal.map((r) => ({ mes: r.mes, comercial: r.comercial_12m, financeiro: r.financeiro_12m, total: r.total_12m }));
    return recorta(base, period);
  }, [fluxo.mensal, lente, period]);

  const ult = ultimoDe(fluxo.mensal);
  const ano = fluxo.ano_corrente;
  const ultMesFechado = fluxo.mes_corrente_parcial ? fluxo.mensal[fluxo.mensal.length - 2] : ult;

  return (
    <ChartCard
      id="fluxo-cambial"
      title="Fluxo cambial contratado — comercial e financeiro"
      subtitle="BCB/SGS 13961 (total) · 13967 (comercial) · 13970 (financeiro) · diário agregado · US$ bi · + = entrada"
      toolbar={
        <>
          <AzSegmented ariaLabel="Janela" options={OPCOES_FLUXO} value={lente} onChange={(id) => setLente(id as LenteFluxo)} />
          {lente !== "diario" ? (
            <AzPeriodSelector
              value={period}
              onChange={setPeriod}
              min={isoMes(fluxo.mensal[0]?.mes ?? "2009-01-01")}
              max={isoMes(ult?.mes ?? "2026-01-01")}
              periods={["1y", "5y", "10y", "max"]}
            />
          ) : null}
        </>
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <b>O que é.</b> Contratos de câmbio fechados no mercado primário: o segmento comercial (exportação −
            importação) e o financeiro (investimentos, empréstimos, remessas de lucros, turismo etc.). É o dado externo mais
            frequente do BCB — sai com ~3 dias úteis de defasagem.
          </p>
          <p>
            <b>Não é o balanço de pagamentos.</b> Registra contratação (não a liquidação) e só o que passa pelo mercado de
            câmbio: IDP em ativos, lucros reinvestidos e financiamentos que não trocam moeda ficam de fora. O mês corrente é
            parcial até o último dia útil.
          </p>
        </div>
      }
      stampGiro={geradoEm}
      stampDado={fluxo.ultimo_dia}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(ano.total)}>
          {ano.ano} até {fmtDataBR(fluxo.ultimo_dia)} · total {fmtUsBiSigned(ano.total, 1)} · comercial {fmtUsBiSigned(ano.comercial, 1)} ·
          financeiro {fmtUsBiSigned(ano.financeiro, 1)}
        </CockpitChip>
        {ultMesFechado ? (
          <CockpitChip tom={tomPorSinal(ultMesFechado.total_12m)}>12m até {fmtMesCurto(isoMes(ultMesFechado.mes))} {fmtUsBiSigned(ultMesFechado.total_12m, 1)}</CockpitChip>
        ) : null}
        {fluxo.mes_corrente_parcial && ult ? (
          <CockpitChip tom="navy">
            {fmtMesCurto(isoMes(ult.mes))} parcial ({ult.dias_uteis} dias) {fmtUsBiSigned(ult.total, 1)}
          </CockpitChip>
        ) : null}
      </div>
      {lente === "diario" ? (
        <FluxoDiarioChart dias={fluxo.diario_90d} />
      ) : (
        <StackedBpChart rows={rows} stacks={STACKS_FLUXO} totalKey="total" totalLabel="Total" valueFmt={(v) => fmtUsBiSigned(v, 2)} />
      )}
    </ChartCard>
  );
}

function FluxoDiarioChart({ dias }: { dias: FluxoCambial["diario_90d"] }) {
  const rows = dias.map((d) => ({ data: d.data, comercial: d.comercial, financeiro: d.financeiro }));
  return (
    <div className="w-full" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} stackOffset="sign" margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid {...azGridProps()} />
          <XAxis {...azXAxisProps()} dataKey="data" tickFormatter={(d: string) => fmtDataBR(d).slice(0, 5)} minTickGap={24} />
          <YAxis {...azYAxisProps()} width={52} tickFormatter={(v: number) => fmtNum(v, 0)} />
          <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} />
          <Tooltip
            content={<AzTooltip labelFmt={(l) => fmtDataBR(String(l))} valueFmt={(v: number) => `${fmtSinal(v, 0)} US$ mi`} />}
            cursor={AZ_TOOLTIP_PROPS.cursor}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {STACKS_FLUXO.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={`${s.label} (US$ mi)`} stackId="d" fill={s.color} isAnimationActive={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type IndFocus = "conta_corrente" | "balanca" | "idp" | "cambio";
const OPCOES_FOCUS = [
  { id: "conta_corrente", label: "Conta corrente" },
  { id: "balanca", label: "Balança" },
  { id: "idp", label: "IDP" },
  { id: "cambio", label: "Câmbio" },
];
/** Linha realizada (12m, US$ bi) que ancora cada indicador do Focus. */
const REALIZADO_KEY: Record<Exclude<IndFocus, "cambio">, string> = { conta_corrente: "tc", balanca: "bens", idp: "idp" };

/** Card — Focus anual (mediana por coleta) para as grandezas externas. */
export function FocusExternoCard({
  focus,
  bp,
  ptax,
  geradoEm,
}: {
  focus: FocusExterno;
  bp: BpMestre;
  ptax: { data: string; valor: number } | null;
  geradoEm: string;
}) {
  const [ind, setInd] = useState<IndFocus>("conta_corrente");
  const porAno = focus[ind] ?? {};
  const anos = Object.keys(porAno).sort();
  const anoDado = anos.length ? anos[anos.length - 2] ?? anos[0] : null; // ano corrente = penúltimo (ano−1, ano, ano+1)
  const series = anos.map((a, i) => ({
    id: `a${a}`,
    label: `${a}`,
    color: [AZ_SERIES[7], AZ_SERIES[0], AZ_SERIES[2]][i % 3],
    data: (porAno[a] ?? []).filter((c) => c.mediana != null).map((c) => [c.data, c.mediana as number] as const),
  }));
  const ultBp = ultimoDe(bp.acum_12m);
  const realizado = ind === "cambio" ? ptax?.valor ?? null : val(ultBp, REALIZADO_KEY[ind]);
  const refLines: AzRefLine[] =
    realizado != null
      ? [{ y: realizado, color: AZ_CHART.zero, label: ind === "cambio" ? `PTAX ${fmtNum(realizado, 2)}` : `realizado 12m ${fmtNum(realizado, 1)}` }]
      : [];
  const chips = anos.slice(1).map((a) => {
    const arr = (porAno[a] ?? []).filter((c) => c.mediana != null);
    const u = arr[arr.length - 1];
    const q = arr.length > 4 ? arr[arr.length - 5] : undefined;
    const d = u?.mediana != null && q?.mediana != null ? u.mediana - q.mediana : null;
    return { a, u, d };
  });
  const unidade = ind === "cambio" ? "R$/US$" : "US$ bi";
  const dec = ind === "cambio" ? 2 : 1;

  return (
    <ChartCard
      id="focus-externo"
      title="Focus — expectativas anuais do setor externo"
      subtitle="BCB/Olinda ExpectativasMercadoAnuais · mediana por coleta (última da semana) · 3 anos de referência · linha = realizado"
      toolbar={<AzSegmented ariaLabel="Indicador" options={OPCOES_FOCUS} value={ind} onChange={(id) => setInd(id as IndFocus)} />}
      footer={
        <p>
          Mediana das projeções do Focus para o ano-calendário, uma coleta por semana. Conta corrente, balança comercial
          (saldo) e IDP em US$ bi; câmbio em R$/US$ de fim de ano. A linha de referência é o realizado mais recente: o
          acumulado de 12 meses do BP (não o ano-calendário) ou a PTAX do último dia. O chip mostra a mediana atual e a
          revisão em ~4 semanas.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={chips[0]?.u?.data ?? anoDado}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <CockpitChip key={c.a} tom={tomPorSinal(c.d)}>
            {c.a}: {c.u?.mediana != null ? (c.u.mediana < 0 ? `−${fmtNum(-c.u.mediana, dec)}` : fmtNum(c.u.mediana, dec)) : "—"} {unidade}
            {c.d != null ? ` · ${fmtSinal(c.d, dec)} em 4 sem.` : ""}
            {c.u?.n ? ` · n=${c.u.n}` : ""}
          </CockpitChip>
        ))}
      </div>
      <AzTimeSeriesChart series={series} yAxisLabel={unidade} height={250} dots={false} refLines={refLines} niceYTicks />
    </ChartCard>
  );
}
