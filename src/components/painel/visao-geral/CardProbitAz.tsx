"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CodaceFaixa, ProbitAzData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

type Modelo = {
  key: string;
  label: string;
  color: string;
  valor: number | null | undefined;
};

function corPara(p: number | null | undefined) {
  if (p === null || p === undefined) return "#71717a";
  return p >= 0.65 ? "#DC2626" : p >= 0.35 ? "#F59E0B" : "#10B981";
}

function medianaEstatistica(vs: number[]): number | null {
  if (vs.length === 0) return null;
  const ord = vs.slice().sort((a, b) => a - b);
  const m = Math.floor(ord.length / 2);
  return ord.length % 2 === 0 ? (ord[m - 1] + ord[m]) / 2 : ord[m];
}

// Gauge semicircular SVG (speedometer Hamilton 2011)
function GaugeSpeedometer({ valor, label }: { valor: number; label: string }) {
  // valor 0-1, mapeia para ângulo -90° (esquerda) a +90° (direita) = 180° total
  const v = Math.max(0, Math.min(1, valor));
  const ang = -90 + v * 180; // em graus
  const angRad = (ang * Math.PI) / 180;

  // Geometria
  const cx = 110;
  const cy = 110;
  const rOut = 96;
  const rIn = 68;

  // Helper: arc path
  function arcPath(startDeg: number, endDeg: number, radius: number, innerRadius: number) {
    const startRad = ((startDeg - 90) * Math.PI) / 180;
    const endRad = ((endDeg - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const x3 = cx + innerRadius * Math.cos(endRad);
    const y3 = cy + innerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(startRad);
    const y4 = cy + innerRadius * Math.sin(startRad);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  }

  // 3 faixas: 0-35% verde, 35-65% âmbar, 65-100% vermelho
  // Mapeando 0% → 0°, 100% → 180°
  // 35% → 63°, 65% → 117°
  const ponteiroX = cx + (rIn + 20) * Math.cos(angRad);
  const ponteiroY = cy + (rIn + 20) * Math.sin(angRad);
  const corPonteiro = corPara(v);

  return (
    <svg viewBox="0 0 220 145" className="w-full max-w-[280px]">
      {/* Arco verde 0-35% */}
      <path d={arcPath(0, 63, rOut, rIn)} fill="#10B981" opacity={0.85} />
      {/* Arco âmbar 35-65% */}
      <path d={arcPath(63, 117, rOut, rIn)} fill="#F59E0B" opacity={0.85} />
      {/* Arco vermelho 65-100% */}
      <path d={arcPath(117, 180, rOut, rIn)} fill="#DC2626" opacity={0.85} />
      {/* Linhas dos limites Hamilton 35/65 */}
      <line x1={cx + rIn * Math.cos(((-90 + 63) * Math.PI) / 180)} y1={cy + rIn * Math.sin(((-90 + 63) * Math.PI) / 180)} x2={cx + (rOut + 4) * Math.cos(((-90 + 63) * Math.PI) / 180)} y2={cy + (rOut + 4) * Math.sin(((-90 + 63) * Math.PI) / 180)} stroke="#27272a" strokeWidth={1} />
      <line x1={cx + rIn * Math.cos(((-90 + 117) * Math.PI) / 180)} y1={cy + rIn * Math.sin(((-90 + 117) * Math.PI) / 180)} x2={cx + (rOut + 4) * Math.cos(((-90 + 117) * Math.PI) / 180)} y2={cy + (rOut + 4) * Math.sin(((-90 + 117) * Math.PI) / 180)} stroke="#27272a" strokeWidth={1} />

      {/* Labels 0%, 35%, 65%, 100% */}
      <text x={cx + (rOut + 10) * Math.cos((-90 * Math.PI) / 180)} y={cy + (rOut + 10) * Math.sin((-90 * Math.PI) / 180) + 4} fontSize={9} fill="#71717a" textAnchor="middle">0%</text>
      <text x={cx + (rOut + 10) * Math.cos((-27 * Math.PI) / 180)} y={cy + (rOut + 10) * Math.sin((-27 * Math.PI) / 180) + 4} fontSize={9} fill="#71717a" textAnchor="middle">35%</text>
      <text x={cx + (rOut + 10) * Math.cos((27 * Math.PI) / 180)} y={cy + (rOut + 10) * Math.sin((27 * Math.PI) / 180) + 4} fontSize={9} fill="#71717a" textAnchor="middle">65%</text>
      <text x={cx + (rOut + 10) * Math.cos((90 * Math.PI) / 180)} y={cy + (rOut + 10) * Math.sin((90 * Math.PI) / 180) + 4} fontSize={9} fill="#71717a" textAnchor="middle">100%</text>

      {/* Ponteiro */}
      <line x1={cx} y1={cy} x2={ponteiroX} y2={ponteiroY} stroke={corPonteiro} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill={corPonteiro} />

      {/* Valor central */}
      <text x={cx} y={cy + 30} fontSize={24} fontWeight={700} fill={corPonteiro} textAnchor="middle">{Math.round(v * 100)}%</text>
      <text x={cx} y={cy + 42} fontSize={9} fill="#71717a" textAnchor="middle">{label}</text>
    </svg>
  );
}

export function CardProbitAz({
  data,
  codace = [],
}: {
  data: ProbitAzData | null;
  codace?: CodaceFaixa[];
}) {
  const [showContribs, setShowContribs] = useState(false);

  if (!data || !data.serie || data.serie.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Probabilidade de recessão — ensemble</h3>
        <p className="mt-2 text-sm text-zinc-500">Aguardando pipeline gerar dados...</p>
      </div>
    );
  }

  const ultimaAz = data.probabilidades;
  const diffusion = ultimaAz?.diffusion ?? null;
  const gapHp = ultimaAz?.gap_hp ?? null;
  const probitFin = ultimaAz?.probit_fin ?? null;
  const probAz = ultimaAz?.probit_az ?? null;

  const valores = [diffusion, gapHp, probitFin, probAz].filter((v): v is number => v !== null && v !== undefined);
  const mediana = medianaEstatistica(valores);
  const corMediana = corPara(mediana);
  const nModelos = valores.length;

  const serieFinal = (data.serie ?? []).map((p) => {
    const vs = [p.diffusion, p.gap_hp, p.probit_fin, p.probit_az].filter((v): v is number => typeof v === "number");
    return {
      mes: p.mes,
      diffusion: p.diffusion ?? undefined,
      gap_hp: p.gap_hp ?? undefined,
      probit_fin: p.probit_fin ?? undefined,
      probit_az: p.probit_az ?? undefined,
      mediana: medianaEstatistica(vs),
    };
  });

  const ultimas2 = serieFinal.filter((p) => p.mediana !== null && p.mediana !== undefined).slice(-2);
  const todasAlerta = ultimas2.length >= 2 && ultimas2.every((p) => (p.mediana ?? 0) >= 0.65);
  const todasCalmas = ultimas2.length >= 2 && ultimas2.every((p) => (p.mediana ?? 1) < 0.35);
  const estadoHist = todasAlerta ? "ALERTA" : todasCalmas ? "ESTÁVEL" : "CAUTELA";
  const corHist = estadoHist === "ALERTA" ? "#DC2626" : estadoHist === "ESTÁVEL" ? "#10B981" : "#F59E0B";

  const modelos: Modelo[] = [
    { key: "diffusion", label: "Diffusion", color: "#F59E0B", valor: diffusion },
    { key: "gap_hp", label: "Gap Hamilton 2018", color: "#10B981", valor: gapHp },
    { key: "probit_fin", label: "Probit Financeiro", color: "#3B82F6", valor: probitFin },
    { key: "probit_az", label: "Probit Misto AZ", color: "#DC2626", valor: probAz },
  ];

  const hachuraStart = "2020-06";
  const ultimoMes = serieFinal[serieFinal.length - 1]?.mes ?? "2026-12";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm border-l-4" style={{ borderLeftColor: corMediana }}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h3 className="text-base font-bold text-[#132960]">
            Termômetro de recessão — ensemble de {nModelos} modelos causais
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
            Mediana de 4 metodologias (Moore 1950, Hamilton 2018, Estrella-Mishkin 1998, Issler-Vahid 2006). Backtest causal OOS 1996-2026: AUC <strong>0.86</strong>.
            <span className="ml-1 text-amber-700">⚠ MS-AR Hamilton 1989 aguardando statsmodels carregar.</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded" style={{ backgroundColor: corHist + "22", color: corHist }}>
            HISTERESE: {estadoHist}
          </span>
          <div className="text-[9px] text-zinc-400 mt-1">Hamilton 2011 · 65/35 · 2m persist.</div>
        </div>
      </div>

      {/* GRID 2 colunas: Gauge à esquerda + Fan chart à direita */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
        {/* Coluna esquerda: Gauge */}
        <div className="flex flex-col items-center bg-zinc-50 rounded-lg p-3 border border-zinc-100">
          {mediana !== null && <GaugeSpeedometer valor={mediana} label={`Mediana · ${formatMes(ultimaAz?.mes ?? "")}`} />}
          <div className="mt-2 grid grid-cols-2 gap-1.5 w-full">
            {modelos.map((m) => (
              <div key={m.key} className="rounded border bg-white px-2 py-1 border-l-[3px]" style={{ borderLeftColor: m.color }}>
                <div className="text-[8px] uppercase tracking-wider font-bold leading-none" style={{ color: m.color }}>
                  {m.label}
                </div>
                <div className="text-sm font-bold text-zinc-900">
                  {m.valor !== null && m.valor !== undefined ? `${Math.round(m.valor * 100)}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita: Fan chart histórico */}
        <div className="h-[300px] rounded border border-zinc-100 bg-zinc-50 p-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serieFinal} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(serieFinal.length / 12))} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—")} labelFormatter={(l: unknown) => formatMes(