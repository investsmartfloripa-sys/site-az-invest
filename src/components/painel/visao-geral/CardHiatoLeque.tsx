"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

import type { CodaceFaixa, HiatoPonto } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";

type PontoLeque = {
  mes: string;
  banda: [number, number] | null;
  mediana: number | null;
  hp: number | null;
  hamilton: number | null;
  quadratico: number | null;
};

/**
 * Hiato do produto — leque de métodos. Banda mín–máx desenhada como Area de
 * range ([low, high]) translúcida — sem a antiga área branca opaca que
 * encobria o grid e as faixas CODACE.
 */
export function CardHiatoLeque({ serie, codace = [] }: { serie: HiatoPonto[]; codace?: CodaceFaixa[] }) {
  const dados: PontoLeque[] = useMemo(
    () =>
      (serie ?? []).map((p) => ({
        mes: p.mes,
        banda:
          p.gap_min_pct !== null && p.gap_min_pct !== undefined && p.gap_max_pct !== null && p.gap_max_pct !== undefined
            ? ([p.gap_min_pct, p.gap_max_pct] as [number, number])
            : null,
        mediana: p.gap_mediana_pct ?? null,
        hp: p.gap_hp_pct ?? null,
        hamilton: p.gap_hamilton_pct ?? null,
        quadratico: p.gap_quadratico_pct ?? null,
      })),
    [serie],
  );

  if (dados.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
        <h3 className="text-base font-semibold text-zinc-500">Hiato do produto — leque de métodos</h3>
        <p className="mt-2 text-xs text-zinc-400">Pipeline rodando — dados aparecerão na próxima atualização.</p>
      </div>
    );
  }

  const temQuadratico = dados.some((d) => d.quadratico !== null);
  const nMetodos = temQuadratico ? 3 : 2;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">Hiato do produto — leque de métodos</h3>
        <p className="text-xs text-zinc-500">
          HP (λ=129.600), Hamilton (h=24m, p=4){temQuadratico ? " e tendência quadrática" : ""}. Banda translúcida = faixa
          mín–máx dos {nMetodos} métodos; linha grossa = mediana. Acima de 0 = aquecimento; abaixo = ociosidade.
        </p>
        <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-800 border border-amber-200">
          ⚠ <strong>Hamilton tem viés positivo pós-COVID</strong> (Quast &amp; Wolters 2020): regressão sobre log(IBC-Br) com break estrutural em 2020 superestima o hiato em ~3-5pp. Os métodos divergem — por isso mostramos a faixa, não um número único.
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(1) + "%"} />
          <Tooltip
            formatter={(v: unknown) => {
              if (typeof v === "number") return v.toFixed(2) + "%";
              if (Array.isArray(v)) return v.map((x) => (typeof x === "number" ? x.toFixed(2) + "%" : "—")).join(" a ");
              return String(v ?? "");
            }}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#000" strokeDasharray="2 4" />
          {codace.map((f, i) => (
            <ReferenceArea
              key={`hiato-codace-${f.pico}-${i}`}
              x1={f.pico}
              x2={f.vale}
              fill="#9CA3AF"
              fillOpacity={0.12}
              ifOverflow="visible"
            />
          ))}
          <Area
            type="monotone"
            dataKey="banda"
            stroke="none"
            fill="#132960"
            fillOpacity={0.12}
            name="Faixa mín–máx"
            connectNulls
            isAnimationActive={false}
          />
          <Line type="monotone" dataKey="hp" stroke="#DC2626" dot={false} strokeWidth={1} name="HP" connectNulls />
          <Line type="monotone" dataKey="hamilton" stroke="#2563EB" dot={false} strokeWidth={1} name="Hamilton" connectNulls />
          {temQuadratico && (
            <Line type="monotone" dataKey="quadratico" stroke="#059669" dot={false} strokeWidth={1} name="Quadrático" connectNulls />
          )}
          <Line type="monotone" dataKey="mediana" stroke="#132960" dot={false} strokeWidth={2.4} name={`Mediana (${nMetodos} métodos)`} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2"><DataStamp dado={dados[dados.length - 1]?.mes} /></p>
    </div>
  );
}
