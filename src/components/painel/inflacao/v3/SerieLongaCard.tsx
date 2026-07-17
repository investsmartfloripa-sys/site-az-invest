"use client";

import { useMemo, useState } from "react";

import type { SerieLongaBlock } from "@/lib/painel-ipca";
import { AzSegmented, ChartCard } from "@/components/painel/core";
import { AzTimeSeriesChart, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import {
  AzPeriodSelector,
  type AzPeriodId,
  type AzPeriodValue,
} from "@/components/painel/charts/AzPeriodSelector";
import { mesIso } from "../v2/shared";

/**
 * Tendência desde 1999: IPCA acumulado 12m contra a META ESCALONADA do CMN
 * (centro/piso/teto vigentes em cada mês, em degraus). Abaixo, a fita de
 * cumprimento anual — fechamento de cada ano-calendário dentro/acima/abaixo da
 * banda — que incorpora o "ano a ano vs meta" à própria série longa.
 */

type Modo = "12m" | "mensal";

const MODOS = [
  { id: "12m", label: "Acumulado 12m" },
  { id: "mensal", label: "Variação mensal" },
];

const PERIODOS: Exclude<AzPeriodId, "custom">[] = ["5y", "max"];

type Compliance = "dentro" | "acima" | "abaixo";
const CUMPRIMENTO: Record<Compliance, { cor: string; rotulo: string }> = {
  dentro: { cor: "#1E8A5C", rotulo: "dentro da banda" },
  acima: { cor: "#BE3B33", rotulo: "acima do teto" },
  abaixo: { cor: "#027DFC", rotulo: "abaixo do piso" },
};

export function SerieLongaCard({ longa, geradoEm }: { longa: SerieLongaBlock; geradoEm: string }) {
  const [modo, setModo] = useState<Modo>("12m");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const { principais, referencias } = useMemo(() => {
    const s12: Array<[string, number]> = [];
    const sMensal: Array<[string, number]> = [];
    const meta: Array<[string, number]> = [];
    const piso: Array<[string, number]> = [];
    const teto: Array<[string, number]> = [];
    for (const p of longa.serie) {
      const iso = mesIso(p.mes);
      if (p.acum_12m != null) s12.push([iso, p.acum_12m]);
      if (p.var != null) sMensal.push([iso, p.var]);
      meta.push([iso, p.meta]);
      piso.push([iso, p.piso]);
      teto.push([iso, p.teto]);
    }
    const principais: AzTimeSeries[] =
      modo === "12m"
        ? [{ id: "ipca12m", label: "IPCA 12m", color: "#132960", data: s12 }]
        : [{ id: "ipcaMensal", label: "IPCA mensal", color: "#132960", data: sMensal }];
    const referencias: AzTimeSeries[] =
      modo === "12m"
        ? [
            { id: "meta", label: "Meta CMN", color: "#BE3B33", type: "stepAfter", data: meta },
            { id: "teto", label: "Teto", color: "#94A3B8", type: "stepAfter", data: teto },
            { id: "piso", label: "Piso", color: "#94A3B8", type: "stepAfter", data: piso },
          ]
        : [];
    return { principais, referencias };
  }, [longa, modo]);

  // Fita de cumprimento anual: fechamento (dez, ou último mês do ano corrente)
  // de cada ano-calendário classificado contra a banda vigente.
  const anos = useMemo(() => {
    const porAno = new Map<string, (typeof longa.serie)[number]>();
    for (const p of longa.serie) {
      if (p.acum_12m == null) continue;
      porAno.set(p.mes.slice(0, 4), p);
    }
    const anoUltimo = longa.serie.at(-1)?.mes.slice(0, 4);
    return [...porAno.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ano, p]) => {
        const valor = p.acum_12m as number;
        const status: Compliance = valor > p.teto ? "acima" : valor < p.piso ? "abaixo" : "dentro";
        return { ano, valor, status, parcial: ano === anoUltimo && !p.mes.endsWith("-12") };
      });
  }, [longa]);

  return (
    <ChartCard
      title={`IPCA desde ${longa.desde.slice(0, 4)}`}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <AzSegmented options={MODOS} value={modo} onChange={(id) => setModo(id as Modo)} ariaLabel="Transformação da série longa" />
          <AzPeriodSelector value={period} onChange={setPeriod} periods={PERIODOS} />
        </div>
      }
      stampGiro={geradoEm}
      stampDado={longa.serie.at(-1)?.mes ?? null}
    >
      <AzTimeSeriesChart series={principais} benchmarks={referencias} unit="%" period={period} height={340} showLegend />
      {anos.length > 0 ? (
        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
            <span className="font-semibold text-zinc-600">Fechamento anual vs banda</span>
            {(Object.keys(CUMPRIMENTO) as Compliance[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: CUMPRIMENTO[k].cor }} />
                {CUMPRIMENTO[k].rotulo}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {anos.map((a) => (
              <div
                key={a.ano}
                title={`${a.ano}: ${a.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%${a.parcial ? " (parcial)" : ""} — ${CUMPRIMENTO[a.status].rotulo}`}
                className="flex min-w-[3.1rem] flex-col items-center rounded-md border px-1.5 py-1"
                style={{ borderColor: `${CUMPRIMENTO[a.status].cor}55`, background: `${CUMPRIMENTO[a.status].cor}0f` }}
              >
                <span className="text-[10px] font-medium text-zinc-500">{a.ano}</span>
                <span className="text-xs font-semibold tabular-nums" style={{ color: CUMPRIMENTO[a.status].cor }}>
                  {a.valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  {a.parcial ? "*" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </ChartCard>
  );
}
