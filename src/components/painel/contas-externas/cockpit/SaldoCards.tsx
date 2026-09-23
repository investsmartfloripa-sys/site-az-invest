"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { BpMestre } from "@/lib/painel-contas-externas";
import { AzSegmented, ChartCard, CockpitChip, tomPorSinal } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART, AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedPct } from "@/lib/format-br";
import { StackedBpChart } from "./StackedBpChart";
import {
  BTN_CSV_CLASS,
  baixarCsv,
  codaceAreas,
  fmtSinal,
  fmtUsBiSigned,
  isoMes,
  pctPib,
  percentil,
  recorta,
  serieBp,
  ultimoDe,
  val,
} from "./cockpit-shared";

type Lente = "pib" | "usd";
const OPCOES_LENTE = [
  { id: "pib", label: "% PIB" },
  { id: "usd", label: "US$ bi" },
];

/** Card 1 — saldo em transações correntes 12m, série longa com as réguas assimétricas. */
export function TcSaldoCard({
  bp,
  codace,
  geradoEm,
}: {
  bp: BpMestre;
  codace: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [lente, setLente] = useState<Lente>("pib");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const rows = bp.acum_12m;
  const emPib = lente === "pib";
  const pontos = useMemo(() => serieBp(rows, "tc", emPib), [rows, emPib]);
  const ult = ultimoDe(rows);
  const ant = rows.length > 12 ? rows[rows.length - 13] : undefined;
  const tcPib = pctPib(ult, "tc");
  const dPib = tcPib != null && pctPib(ant, "tc") != null ? tcPib - (pctPib(ant, "tc") as number) : null;
  const hist = rows.filter((r) => r.mes >= "2005-01-01").map((r) => pctPib(r, "tc")).filter((v): v is number => v != null);
  const pct = tcPib != null ? percentil(hist, tcPib) : null;
  const xRef = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  return (
    <ChartCard
      id="tc-saldo"
      title="Transações correntes — saldo acumulado em 12 meses"
      subtitle="BCB/SGS 22701 ÷ PIB 12m em US$ (4192) · desde dez/1996 · réguas: 0 e −4% do PIB · recessões CODACE"
      toolbar={
        <>
          <AzSegmented ariaLabel="Unidade" options={OPCOES_LENTE} value={lente} onChange={(id) => setLente(id as Lente)} />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={pontos[0]?.[0]}
            max={pontos[pontos.length - 1]?.[0]}
            periods={["5y", "10y", "max"]}
          />
        </>
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <b>O que é.</b> Soma dos últimos 12 meses do saldo em transações correntes (bens + serviços + renda
            primária + renda secundária). Em % do PIB, o denominador é o PIB acumulado em 12 meses em dólares (SGS
            4192) do mesmo mês.
          </p>
          <p>
            <b>Réguas.</b> A referência de risco é assimétrica: déficits acima de 4% do PIB precederam as paradas
            bruscas de financiamento dos emergentes. Não há banda simétrica de conforto na literatura. O percentil do
            chip é calculado sobre a série desde jan/2005 (mesma janela dos tiles de estado no tempo) (quanto maior, mais superavitário que o histórico).
          </p>
        </div>
      }
      stampGiro={geradoEm}
      stampDado={ult?.mes.slice(0, 7)}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomPorSinal(dPib)}>
          {ult ? fmtMesCurto(isoMes(ult.mes)) : "—"} · {fmtSignedPct(tcPib, 2)} do PIB · {fmtUsBiSigned(val(ult, "tc"), 1)} ·{" "}
          {fmtSinal(dPib, 2)} p.p. em 12m
        </CockpitChip>
        {pct != null ? <CockpitChip tom="navy">percentil {pct} desde 2005</CockpitChip> : null}
      </div>
      <AzTimeSeriesChart        niceYTicks        series={[{ id: "tc", label: "Transações correntes 12m", color: AZ_BRAND.azure, data: pontos }]}
        unit={emPib ? "%" : "none"}
        yAxisLabel={emPib ? "% do PIB" : "US$ bi"}
        period={period}
        height={260}
        showLegend={false}
        xRefAreas={xRef}
        refLines={
          emPib
            ? [
                { y: 0, color: AZ_CHART.zero, dashed: false },
                { y: -4, color: AZ_CHART.neg, label: "−4% PIB (risco)" },
              ]
            : [{ y: 0, color: AZ_CHART.zero, dashed: false }]
        }
      />
    </ChartCard>
  );
}

const STACKS_TC = [
  { key: "bens", label: "Bens", color: AZ_SERIES[3] },
  { key: "servicos", label: "Serviços", color: AZ_SERIES[2] },
  { key: "renda_primaria", label: "Renda primária", color: AZ_SERIES[5] },
  { key: "renda_secundaria", label: "Renda secundária", color: AZ_SERIES[6] },
];

/** Card 2 — decomposição da TC 12m por conta. */
export function DecomposicaoTcCard({ bp, geradoEm }: { bp: BpMestre; geradoEm: string }) {
  const [lente, setLente] = useState<Lente>("usd");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const emPib = lente === "pib";
  const rows = useMemo(() => {
    const base = recorta(bp.acum_12m, period);
    return base.map((r) => {
      const o: Record<string, number | string | null> = { mes: r.mes };
      for (const k of [...STACKS_TC.map((s) => s.key), "tc"]) o[k] = emPib ? pctPib(r, k) : val(r, k);
      return o as { mes: string };
    });
  }, [bp.acum_12m, period, emPib]);
  const ult = ultimoDe(bp.acum_12m);
  const fmt = (v: number) => (emPib ? fmtSignedPct(v, 2) : fmtUsBiSigned(v, 1));

  const csv = () =>
    baixarCsv(
      "bp-transacoes-correntes-12m.csv",
      ["mes", "tc", "bens", "servicos", "renda_primaria", "renda_secundaria", "pib_12m"],
      bp.acum_12m.map((r) => [r.mes, val(r, "tc"), val(r, "bens"), val(r, "servicos"), val(r, "renda_primaria"), val(r, "renda_secundaria"), val(r, "pib")]),
    );

  return (
    <ChartCard
      id="tc-decomposicao"
      title="Transações correntes — decomposição 12m"
      subtitle="Bens 22707 · serviços 22719 · renda primária 22800 · renda secundária 22838 · linha navy = saldo (22701)"
      toolbar={
        <>
          <AzSegmented ariaLabel="Unidade" options={OPCOES_LENTE} value={lente} onChange={(id) => setLente(id as Lente)} />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={isoMes(bp.acum_12m[0]?.mes ?? "1996-12-01")}
            max={isoMes(ult?.mes ?? "2026-01-01")}
            periods={["5y", "10y", "max"]}
          />
          <button type="button" onClick={csv} className={BTN_CSV_CLASS}>
            CSV
          </button>
        </>
      }
      footer={
        <p>
          Barras empilhadas por sinal: componentes positivos acima do zero, negativos abaixo; a soma é o saldo (linha
          navy). A identidade TC = bens + serviços + renda primária + renda secundária é auditada no builder mês a mês.
        </p>
      }
      stampGiro={geradoEm}
      stampDado={ult?.mes.slice(0, 7)}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {STACKS_TC.map((s) => (
          <CockpitChip key={s.key} cor={s.color}>
            {s.label} {emPib ? fmtSignedPct(pctPib(ult, s.key), 2) : fmtUsBiSigned(val(ult, s.key), 1)}
          </CockpitChip>
        ))}
      </div>
      <StackedBpChart
        rows={rows}
        stacks={STACKS_TC}
        totalKey="tc"
        totalLabel="Saldo TC"
        valueFmt={(v) => fmt(v)}
        yTickFmt={(v) => (emPib ? fmtNum(v, 1) : fmtNum(v, 0))}
      />
    </ChartCard>
  );
}

