"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  ReferenceArea,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import type { CodaceFaixa, HiatoData, IbcBrData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";

import { rotuloFaixaCodace } from "./codace-rotulos";

/**
 * Nível dessazonalizado do IBC-Br com cronologia oficial CODACE e tendência
 * implícita do hiato HP: tendencia = indice_sa / exp(gap_hp/100).
 * O gap é log×100, por isso exp — NÃO (1 + g/100).
 */
export function CardIbcBrCodace({
  ibcbr,
  hiato,
  codace = [],
}: {
  ibcbr: IbcBrData | null;
  hiato: HiatoData | null;
  codace?: CodaceFaixa[];
}) {
  const dados = useMemo(() => {
    const serie = ibcbr?.serie ?? [];
    const gapPorMes = new Map<string, number>();
    for (const p of hiato?.serie ?? []) {
      if (p.gap_hp_pct !== null && p.gap_hp_pct !== undefined) gapPorMes.set(p.mes, p.gap_hp_pct);
    }
    return serie
      .filter((p) => p.indice_sa !== null && p.indice_sa !== undefined)
      .map((p) => {
        const gap = gapPorMes.get(p.mes);
        const tendencia =
          gap !== undefined && p.indice_sa !== null && p.indice_sa !== undefined
            ? p.indice_sa / Math.exp(gap / 100)
            : null;
        return { mes: p.mes, indice_sa: p.indice_sa, tendencia };
      });
  }, [ibcbr, hiato]);

  if (dados.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
        <h3 className="text-base font-semibold text-zinc-500">IBC-Br com cronologia CODACE</h3>
        <p className="mt-2 text-xs text-zinc-400">Pipeline rodando — dados aparecerão na próxima atualização.</p>
      </div>
    );
  }

  const primeiroMes = dados[0].mes;
  const ultimoMes = dados[dados.length - 1].mes;
  const faixasVisiveis = codace.filter((f) => f.vale >= primeiroMes);
  const temTendencia = dados.some((d) => d.tendencia !== null);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">Atividade mensal e cronologia de recessões</h3>
        <p className="text-xs text-zinc-500">
          IBC-Br dessazonalizado (BCB, base 2002=100). Faixas cinzas = recessões oficiais CODACE/FGV-IBRE.
          {temTendencia && " Linha tracejada = tendência implícita no hiato HP."}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dados} margin={{ top: 14, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          {faixasVisiveis.map((faixa, i) => (
            <ReferenceArea
              key={faixa.pico + "-" + i}
              x1={faixa.pico > primeiroMes ? faixa.pico : primeiroMes}
              x2={faixa.vale}
              fill="#9CA3AF"
              fillOpacity={0.15}
              ifOverflow="visible"
              label={{ value: rotuloFaixaCodace(faixa.pico), position: "insideTop", fontSize: 9, fill: "#6B7280" }}
            />
          ))}
          {/* Faixa hachurada pós jun/2020: período sem datação oficial CODACE */}
          {ultimoMes > "2020-06" && (
            <ReferenceArea
              x1="2020-06"
              x2={ultimoMes}
              fill="url(#hachuraSemDatacaoIbc)"
              fillOpacity={1}
              ifOverflow="visible"
            />
          )}
          <defs>
            <pattern id="hachuraSemDatacaoIbc" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#CBD5E1" strokeWidth="1" />
            </pattern>
          </defs>
          {temTendencia && (
            <Line
              type="monotone"
              dataKey="tendencia"
              stroke="#9CA3AF"
              strokeDasharray="6 4"
              dot={false}
              strokeWidth={1.5}
              name="Tendência (HP)"
              connectNulls
            />
          )}
          <Line type="monotone" dataKey="indice_sa" stroke="#132960" dot={false} strokeWidth={2} name="IBC-Br SA" />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-zinc-400">
        Hachura pós-jun/2020 = sem datação oficial CODACE; ausência de faixas após essa data não significa ausência de ciclo.
      </p>
      <p className="mt-2"><DataStamp giro={ibcbr?.gerado_em} dado={ultimoMes} /></p>
    </div>
  );
}
