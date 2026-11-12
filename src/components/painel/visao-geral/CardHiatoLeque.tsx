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
} from "recharts";

import type { CodaceFaixa, HiatoPonto } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";
import { fmtNum } from "@/lib/format-br";
import { ticksRedondos } from "@/components/painel/core";

import { rotuloAno, ticksAnuais, useTelaEstreita } from "./uteis-grafico";

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
export function CardHiatoLeque({
  serie,
  codace = [],
  giro,
}: {
  serie: HiatoPonto[];
  codace?: CodaceFaixa[];
  /** Quando o pipeline gravou o JSON do hiato (carimbo "Giro", igual aos outros cartões). */
  giro?: string | null;
}) {
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
  const estreito = useTelaEstreita();

  if (dados.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
        <h3 className="text-base font-semibold text-zinc-500">Hiato do produto — leque de métodos</h3>
        <p className="mt-2 text-xs text-zinc-500">Pipeline rodando — dados aparecerão na próxima atualização.</p>
      </div>
    );
  }

  const temQuadratico = dados.some((d) => d.quadratico !== null);
  const nMetodos = temQuadratico ? 3 : 2;
  const ticksX = ticksAnuais(dados.map((d) => d.mes), estreito ? 5 : 10);
  // Eixo Y com marcas redondas que incluem o zero e cobrem o tombo de 2020.
  const valoresY = dados.flatMap((d) => [d.banda?.[0], d.banda?.[1], d.mediana, d.hp, d.hamilton, d.quadratico]);
  const finitos = valoresY.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const eixoY = finitos.length > 0 ? ticksRedondos(Math.min(0, ...finitos), Math.max(0, ...finitos), 5) : null;
  const passoY = eixoY && eixoY.ticks.length > 1 ? eixoY.ticks[1] - eixoY.ticks[0] : 1;
  const decY = passoY >= 1 ? 0 : 1;
  // Legenda própria: a do Recharts dava o mesmo ícone marinho à faixa e à mediana.
  const legenda: { nome: string; tipo: "faixa" | "linha"; cor: string; grossa?: boolean }[] = [
    { nome: "Faixa mín–máx", tipo: "faixa", cor: "rgba(19,41,96,0.18)" },
    { nome: `Mediana (${nMetodos} métodos)`, tipo: "linha", cor: "#132960", grossa: true },
    { nome: "HP", tipo: "linha", cor: "#DC2626" },
    { nome: "Hamilton", tipo: "linha", cor: "#2563EB" },
    ...(temQuadratico ? [{ nome: "Quadrático", tipo: "linha" as const, cor: "#059669" }] : []),
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">Hiato do produto — leque de métodos</h3>
        <p className="text-xs text-zinc-500">
          HP (λ=129.600), Hamilton (h=24m, p=4){temQuadratico ? " e tendência quadrática" : ""}. Banda translúcida = faixa
          mín–máx dos {nMetodos} métodos; linha grossa = mediana. Acima de 0 = aquecimento; abaixo = ociosidade.
        </p>
        <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 border border-amber-200">
          ⚠ <strong>O método de Hamilton superestima o hiato depois da pandemia</strong>{" "}
          (Quast &amp; Wolters, 2020): a quebra de 2020 na série do IBC-Br infla o hiato em cerca de 3 a 5 pontos. Os
          métodos divergem — por isso mostramos a faixa, não um número único.
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 10 }}
            ticks={ticksX}
            interval={ticksX ? 0 : Math.max(1, Math.floor(dados.length / 12))}
            tickFormatter={(v) => (ticksX ? rotuloAno(v) : formatMes(String(v)))}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            ticks={eixoY?.ticks}
            domain={eixoY?.domain ?? ["auto", "auto"]}
            tickFormatter={(v: number) => fmtNum(v, decY) + "%"}
          />
          <Tooltip
            formatter={(v: unknown) => {
              if (typeof v === "number") return fmtNum(v, 2) + "%";
              if (Array.isArray(v)) return v.map((x) => (typeof x === "number" ? fmtNum(x, 2) + "%" : "—")).join(" a ");
              return String(v ?? "");
            }}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
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
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
        {legenda.map((l) => (
          <span key={l.nome} className="inline-flex items-center gap-1.5">
            {l.tipo === "faixa" ? (
              <span className="h-3 w-4 rounded-sm" style={{ backgroundColor: l.cor }} aria-hidden />
            ) : (
              <span className={`w-4 ${l.grossa ? "h-[3px]" : "h-[1.5px]"}`} style={{ backgroundColor: l.cor }} aria-hidden />
            )}
            {l.nome}
          </span>
        ))}
      </div>
      <p className="mt-2"><DataStamp giro={giro} dado={dados[dados.length - 1]?.mes} /></p>
    </div>
  );
}
