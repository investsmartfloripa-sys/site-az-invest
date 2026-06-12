"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import type { HiatoData } from "@/lib/painel-visao-geral";
import { formatMes, formatPct } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";

type PontoRelogio = {
  mes: string;
  x: number; // gap_hp_pct (nível)
  y: number; // Δ3m do gap_hp_pct (direção)
  op: number; // opacidade da cauda (0..1, esmaece para trás)
  isLast: boolean;
  anguloSeta: number; // graus, espaço de tela aproximado
};

const JANELA_MESES = 24;

// Props injetadas pelo Recharts no componente `content` (padrão AzTooltip do repo)
type TooltipRelogioProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: PontoRelogio }>;
};

function TooltipRelogio({ active, payload }: TooltipRelogioProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] shadow-sm">
      <div className="font-semibold text-zinc-800">{formatMes(p.mes)}</div>
      <div className="text-zinc-600">Hiato HP: {formatPct(p.x, 2)}</div>
      <div className="text-zinc-600">Direção 3m: {`${p.y >= 0 ? "+" : ""}${p.y.toFixed(2)} pp`}</div>
    </div>
  );
}

/**
 * Relógio do ciclo: X = nível do hiato HP, Y = variação do hiato em 3 meses
 * (gap[t] − gap[t−3], mesma decomposição — não a var_3m do IBC-Br).
 * Últimos 24 meses conectados, cauda esmaecida, seta no ponto atual.
 */
export function RelogioCicloCard({ hiato }: { hiato: HiatoData | null }) {
  const dados: PontoRelogio[] = useMemo(() => {
    const gaps = (hiato?.serie ?? [])
      .filter((p) => p.gap_hp_pct !== null && p.gap_hp_pct !== undefined)
      .map((p) => ({ mes: p.mes, gap: p.gap_hp_pct as number }));
    const pontos: { mes: string; x: number; y: number }[] = [];
    for (let i = 3; i < gaps.length; i++) {
      pontos.push({ mes: gaps[i].mes, x: gaps[i].gap, y: gaps[i].gap - gaps[i - 3].gap });
    }
    const janela = pontos.slice(-JANELA_MESES);
    const n = janela.length;
    if (n === 0) return [];
    // Limites simétricos para normalizar o ângulo da seta (aproximação do espaço de tela)
    const mx = Math.max(0.1, ...janela.map((p) => Math.abs(p.x))) * 1.15;
    const my = Math.max(0.1, ...janela.map((p) => Math.abs(p.y))) * 1.15;
    return janela.map((p, i) => {
      const isLast = i === n - 1;
      let anguloSeta = 0;
      if (isLast && n >= 2) {
        const prev = janela[n - 2];
        const dxn = (p.x - prev.x) / mx;
        const dyn = (p.y - prev.y) / my;
        // tela: y cresce para baixo -> inverter dy
        anguloSeta = (Math.atan2(-dyn, dxn) * 180) / Math.PI;
      }
      return { ...p, op: n === 1 ? 1 : 0.15 + 0.85 * (i / (n - 1)), isLast, anguloSeta };
    });
  }, [hiato]);

  if (dados.length < 4) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
        <h3 className="text-base font-semibold text-zinc-500">Relógio do ciclo</h3>
        <p className="mt-2 text-xs text-zinc-400">Pipeline rodando — dados aparecerão na próxima atualização.</p>
      </div>
    );
  }

  const mx = Math.max(0.1, ...dados.map((p) => Math.abs(p.x))) * 1.15;
  const my = Math.max(0.1, ...dados.map((p) => Math.abs(p.y))) * 1.15;
  const atual = dados[dados.length - 1];
  const quadranteAtual =
    atual.x >= 0 && atual.y >= 0
      ? "expansão"
      : atual.x >= 0 && atual.y < 0
        ? "desaceleração"
        : atual.x < 0 && atual.y < 0
          ? "recessão"
          : "recuperação";

  const renderPonto = (props: unknown) => {
    const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: PontoRelogio };
    if (cx === undefined || cy === undefined || !payload) return <g />;
    if (payload.isLast) {
      return (
        <g transform={`translate(${cx},${cy}) rotate(${payload.anguloSeta})`}>
          <circle cx={0} cy={0} r={5.5} fill="#132960" />
          <polygon points="14,0 4,5.5 4,-5.5" fill="#132960" />
        </g>
      );
    }
    return <circle cx={cx} cy={cy} r={3} fill="#132960" fillOpacity={payload.op} />;
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Relógio do ciclo — nível × direção do hiato</h3>
          <p className="text-xs text-zinc-500">
            Como ler: cada ponto é um mês (últimos {JANELA_MESES}). Direita = atividade acima da tendência; metade de cima =
            hiato abrindo. O ciclo típico gira em sentido horário: recuperação → expansão → desaceleração → recessão.
          </p>
        </div>
        <span className="rounded bg-[#132960]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#132960]">
          Agora: {quadranteAtual}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={dados} margin={{ top: 10, right: 16, bottom: 14, left: 0 }}>
          <CartesianGrid stroke="#f1f1f1" strokeDasharray="3 3" />
          {/* Quadrantes com cores suaves */}
          <ReferenceArea x1={0} x2={mx} y1={0} y2={my} fill="#10B981" fillOpacity={0.06} label={{ value: "EXPANSÃO", position: "insideTopRight", fontSize: 9, fill: "#059669", fontWeight: 700 }} />
          <ReferenceArea x1={0} x2={mx} y1={-my} y2={0} fill="#F59E0B" fillOpacity={0.06} label={{ value: "DESACELERAÇÃO", position: "insideBottomRight", fontSize: 9, fill: "#B45309", fontWeight: 700 }} />
          <ReferenceArea x1={-mx} x2={0} y1={-my} y2={0} fill="#DC2626" fillOpacity={0.06} label={{ value: "RECESSÃO", position: "insideBottomLeft", fontSize: 9, fill: "#B91C1C", fontWeight: 700 }} />
          <ReferenceArea x1={-mx} x2={0} y1={0} y2={my} fill="#3B82F6" fillOpacity={0.06} label={{ value: "RECUPERAÇÃO", position: "insideTopLeft", fontSize: 9, fill: "#1D4ED8", fontWeight: 700 }} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[-mx, mx]}
            tick={{ fontSize: 9 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            label={{ value: "Hiato HP (% da tendência)", position: "insideBottom", offset: -8, fontSize: 10, fill: "#71717a" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[-my, my]}
            tick={{ fontSize: 9 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
            label={{ value: "Δ 3m do hiato (pp)", angle: -90, position: "insideLeft", fontSize: 10, fill: "#71717a" }}
          />
          <Tooltip content={<TooltipRelogio />} />
          <ReferenceLine x={0} stroke="#a1a1aa" strokeWidth={1} />
          <ReferenceLine y={0} stroke="#a1a1aa" strokeWidth={1} />
          {/* Cauda conectada (esmaecida) */}
          <Line type="linear" dataKey="y" stroke="#94A3B8" strokeWidth={1.2} strokeOpacity={0.45} dot={false} isAnimationActive={false} legendType="none" />
          {/* Pontos com opacidade crescente + seta no ponto atual */}
          <Scatter dataKey="y" shape={renderPonto} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-zinc-400">
        Δ3m usa a mesma decomposição do hiato (gap HP em t menos t−3), não a variação 3m do IBC-Br. Ponto cheio com seta = {formatMes(atual.mes)}.
      </p>
      <p className="mt-2"><DataStamp giro={hiato?.gerado_em} dado={atual.mes} /></p>
    </div>
  );
}
