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

// Gauge semicircular SVG (speedometer Hamilton 2011) - Loop 33 #6
function GaugeSpeedometer({ valor, label }: { valor: number; label: string }) {
  // valor 0-1, semicirculo de -90 (esquerda) a +90 (direita) - 180 total
  const v = Math.max(0, Math.min(1, valor));
  const corPonteiro = corPara(v);

  // Geometria - viewBox amplo o suficiente pra TUDO caber
  const W = 280;
  const H = 220;
  const cx = W / 2; // 140
  const cy = 150;   // base do semicirculo - deixa espaco em baixo pro texto
  const rOut = 110;
  const rIn = 78;

  // Helper: arc path - startDeg/endDeg em graus desde topo (12h), sentido horario
  function arcPath(startDeg: number, endDeg: number, radius: number, innerRadius: number) {
    // semicirculo do topo: 0deg = 12h = (cx, cy-r); 90deg = 3h; -90deg = 9h
    // Para gauge horizontal queremos -90 (esq) -> +90 (dir)
    // Convertendo: gauge angle (0..180 da esq pra dir) - 90 = SVG angle
    const sa = ((startDeg - 90) * Math.PI) / 180;
    const ea = ((endDeg - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(sa);
    const y1 = cy + radius * Math.sin(sa);
    const x2 = cx + radius * Math.cos(ea);
    const y2 = cy + radius * Math.sin(ea);
    const x3 = cx + innerRadius * Math.cos(ea);
    const y3 = cy + innerRadius * Math.sin(ea);
    const x4 = cx + innerRadius * Math.cos(sa);
    const y4 = cy + innerRadius * Math.sin(sa);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  }

  // Mapeando gauge: 0% -> 0deg (esq), 100% -> 180deg (dir)
  // 35% -> 63deg, 65% -> 117deg
  const angDeg = v * 180; // 0..180
  const angSvgRad = ((angDeg - 90) * Math.PI) / 180; // -90 (esq) a +90 (dir)

  // Ponta do ponteiro a 90% do raio externo
  const pX = cx + (rOut - 8) * Math.cos(angSvgRad);
  const pY = cy + (rOut - 8) * Math.sin(angSvgRad);

  // Helper pra posicionar texto em um angulo
  function posAt(deg: number, r: number) {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  const lbl0 = posAt(0, rOut + 14);
  const lbl35 = posAt(63, rOut + 14);
  const lbl65 = posAt(117, rOut + 14);
  const lbl100 = posAt(180, rOut + 14);

  // Tick marks pra cada 10%
  const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[300px]">
      {/* Sombra do gauge (fundo cinza claro) */}
      <path d={arcPath(0, 180, rOut + 2, rIn - 2)} fill="#f4f4f5" />

      {/* 3 faixas Hamilton 2011 */}
      <path d={arcPath(0, 63, rOut, rIn)} fill="#10B981" />
      <path d={arcPath(63, 117, rOut, rIn)} fill="#F59E0B" />
      <path d={arcPath(117, 180, rOut, rIn)} fill="#DC2626" />

      {/* Linhas brancas entre faixas pra dar definicao */}
      {[63, 117].map((d) => {
        const p1 = posAt(d, rIn);
        const p2 = posAt(d, rOut);
        return <line key={d} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="white" strokeWidth={2} />;
      })}

      {/* Tick marks pequenos */}
      {ticks.map((pct) => {
        const d = (pct / 100) * 180;
        const t1 = posAt(d, rOut - 4);
        const t2 = posAt(d, rOut + 2);
        return <line key={pct} x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke="#ffffff" strokeWidth={1} opacity={0.6} />;
      })}

      {/* Labels 0%, 35%, 65%, 100% */}
      <text x={lbl0.x} y={lbl0.y + 3} fontSize={11} fontWeight={600} fill="#52525b" textAnchor="middle">0%</text>
      <text x={lbl35.x} y={lbl35.y + 3} fontSize={11} fontWeight={600} fill="#10B981" textAnchor="middle">35%</text>
      <text x={lbl65.x} y={lbl65.y + 3} fontSize={11} fontWeight={600} fill="#F59E0B" textAnchor="middle">65%</text>
      <text x={lbl100.x} y={lbl100.y + 3} fontSize={11} fontWeight={600} fill="#52525b" textAnchor="middle">100%</text>

      {/* Ponteiro */}
      <line x1={cx} y1={cy} x2={pX} y2={pY} stroke={corPonteiro} strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={8} fill="white" stroke={corPonteiro} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={3} fill={corPonteiro} />

      {/* Valor central GRANDE - bem abaixo do pivot pra nao colidir com ponteiro */}
      <text x={cx} y={cy + 42} fontSize={32} fontWeight={800} fill={corPonteiro} textAnchor="middle">{Math.round(v * 100)}%</text>
      {/* Label embaixo */}
      <text x={cx} y={cy + 60} fontSize={11} fill="#71717a" textAnchor="middle" fontWeight={500}>{label}</text>
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

    