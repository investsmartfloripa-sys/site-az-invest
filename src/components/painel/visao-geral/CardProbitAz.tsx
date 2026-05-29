"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CodaceFaixa, ProbitAzData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

export function CardProbitAz({ data, codace = [] }: { data: ProbitAzData | null; codace?: CodaceFaixa[] }) {
  const [showContribs, setShowContribs] = useState(false);

  if (!data || !data.serie || data.serie.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Probit Misto AZ — sinal de recessão</h3>
        <p className="mt-1 text-xs text-zinc-500">Aguardando pipeline gerar dados...</p>
      </div>
    );
  }

  const ultima = data.probabilidades;
  const mediana = ultima?.mediana ?? data.sinal_principal ?? null;
  const probAz = ultima?.probit_az;
<<<<<<< Updated upstream

  // Histerese Hamilton 2011: declarar alerta com p>=0.65 por 2m, sair com p<0.35 por 2m
  const serie = data.serie ?? [];
  const ultimas3 = serie.filter((p) => p.probit_az !== null && p.probit_az !== undefined).slice(-3);
  const todasAlerta = ultimas3.length >= 2 && ultimas3.slice(-2).every((p) => (p.probit_az ?? 0) >= 0.65);
  const todasCalmas = ultimas3.length >= 2 && ultimas3.slice(-2).every((p) => (p.probit_az ?? 1) < 0.35);
  const estadoHist = todasAlerta ? "ALERTA" : todasCalmas ? "ESTÁVEL" : "CAUTELA";

  const corVal = probAz !== null && probAz !== undefined ? (probAz >= 0.65 ? "#DC2626" : probAz >= 0.35 ? "#F59E0B" : "#10B981") : "#71717a";

  return (
    <section className="rounded-2xl border-2 border-[#132960]/30 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-[#132960]">Probit Misto AZ Híbrido</h3>
          <p className="text-xs text-zinc-600">
            Probit Ridge L2 sobre 3 modelos base (lag 1m) + ~30 antecedentes brutas. Backtest OOS HONESTO AUC=0.85 (Loop 28 causal), Brier=0.07. Refs: Moore 1950 (Diffusion), Hodrick-Prescott 1997/Ravn-Uhlig 2002 (Gap), Estrella-Mishkin 1998 + Wright 2006 + Mendonça-Galvão-Lima 2018 (Probit Fin), Issler-Vahid 2006 (estrutura).
          </p>
        </div>
        {probAz !== null && probAz !== undefined && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">P(recessão)</div>
            <div className="text-4xl font-bold" style={{ color: corVal }}>{Math.round(probAz * 100)}%</div>
            <div className="text-[10px] text-zinc-500">{formatMes(ultima?.mes ?? "")}</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: corVal }}>
              Histerese: {estadoHist}
            </div>
            <div className="text-[9px] text-zinc-400">Hamilton 2011 (entra 65%, sai 35%, 2m persist.)</div>
=======
  const diffusion = ultima?.diffusion;
  const gapHp = ultima?.gap_hp;
  const probitFin = ultima?.probit_fin;

  const corPara = (p: number | null | undefined) =>
    p !== null && p !== undefined ? (p >= 0.65 ? "#DC2626" : p >= 0.35 ? "#F59E0B" : "#10B981") : "#71717a";
  const corMediana = corPara(mediana);

  // Histerese Hamilton 2011 aplicada à mediana (sinal principal)
  const serie = data.serie ?? [];
  const ultimas2 = serie.filter((p) => p.mediana !== null && p.mediana !== undefined).slice(-2);
  const todasAlerta = ultimas2.length >= 2 && ultimas2.every((p) => (p.mediana ?? 0) >= 0.65);
  const todasCalmas = ultimas2.length >= 2 && ultimas2.every((p) => (p.mediana ?? 1) < 0.35);
  const estadoHist = todasAlerta ? "ALERTA" : todasCalmas ? "ESTÁVEL" : "CAUTELA";
  const corHist = estadoHist === "ALERTA" ? "#DC2626" : estadoHist === "ESTÁVEL" ? "#10B981" : "#F59E0B";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {/* Header compacto: mediana em destaque + 4 chips */}
      <div className="mb-2 flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-end gap-3 flex-wrap">
          {mediana !== null && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#132960]">
                Sinal principal · Mediana 4 modelos
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold" style={{ color: corMediana }}>
                  {Math.round(mediana * 100)}%
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: corHist + "22", color: corHist }}>
                  {estadoHist}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500">{formatMes(ultima?.mes ?? "")}</div>
            </div>
          )}
          {/* 4 modelos individuais como mini-chips */}
          <div className="flex gap-1.5 self-center">
            {[
              { v: diffusion, l: "Diff", c: "#F59E0B" },
              { v: gapHp, l: "Gap", c: "#10B981" },
              { v: probitFin, l: "Fin", c: "#3B82F6" },
              { v: probAz, l: "AZ", c: "#DC2626" },
            ].map((m) => (
              <div key={m.l} className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-center min-w-[36px]">
                <div className="font-bold leading-none" style={{ color: m.c }}>{m.l}</div>
                <div className="text-zinc-700 font-mono leading-tight">{m.v !== null && m.v !== undefined ? `${Math.round(m.v * 100)}%` : "—"}</div>
              </div>
            ))}
>>>>>>> Stashed changes
          </div>
        </div>
        <div className="text-right text-[9px] text-zinc-500 max-w-[180px] leading-tight">
          Hamilton 2011: entra ≥65% por 2m, sai &lt;35% por 2m
        </div>
      </div>

      {/* Gráfico compacto */}
      <div className="h-[150px] rounded border border-zinc-100 bg-zinc-50 p-1 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.serie} margin={{ top: 4, right: 6, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#e4e4e7" strokeDasharray="2 3" />
            <XAxis dataKey="mes" tick={{ fontSize: 8 }} interval={Math.max(1, Math.floor(data.serie.length / 10))} />
            <YAxis tick={{ fontSize: 8 }} domain={[0, 1]} />
            <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—")} labelFormatter={(l: unknown) => formatMes(String(l ?? ""))} />
            <ReferenceLine y={0.65} stroke="#DC2626" strokeDasharray="3 3" opacity={0.5} />
            <ReferenceLine y={0.35} stroke="#10B981" strokeDasharray="3 3" opacity={0.5} />
            {codace.map((f, i) => (
              <ReferenceArea key={`paz-${i}`} x1={f.pico} x2={f.vale} fill="#9CA3AF" fillOpacity={0.18} />
            ))}
            <Line type="monotone" dataKey="diffusion" stroke="#F59E0B" strokeWidth={0.7} dot={false} connectNulls opacity={0.45} />
            <Line type="monotone" dataKey="gap_hp" stroke="#10B981" strokeWidth={0.7} dot={false} connectNulls opacity={0.45} />
            <Line type="monotone" dataKey="probit_fin" stroke="#3B82F6" strokeWidth={0.7} dot={false} connectNulls opacity={0.45} />
            <Line type="monotone" dataKey="probit_az" stroke="#DC2626" strokeWidth={0.9} dot={false} connectNulls opacity={0.55} />
            <Line type="monotone" dataKey="mediana" stroke="#132960" strokeWidth={2.2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer: contribuições do Probit AZ - expansível */}
      {data.contribuicoes_top15 && data.contribuicoes_top15.length > 0 && (
        <button
          onClick={() => setShowContribs((o) => !o)}
          className="w-full text-left text-[10px] text-[#132960] hover:underline flex items-center gap-1"
        >
          <span>{showContribs ? "▼" : "▶"}</span>
          <span>Top features do Probit AZ experimental (β · x_std) em {formatMes(ultima?.mes ?? "")}</span>
        </button>
      )}
      {showContribs && data.contribuicoes_top15 && (
        <table className="mt-2 w-full text-[10px]">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="text-left py-1">Feature</th>
              <th className="text-right">β</th>
              <th className="text-right">x_std</th>
              <th className="text-right">β·x</th>
            </tr>
          </thead>
          <tbody>
            {data.contribuicoes_top15.slice(0, 10).map((c, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="py-1 font-mono text-[9px]">{c.feature}</td>
                <td className="text-right">{c.beta.toFixed(2)}</td>
                <td className="text-right">{c.x_std.toFixed(2)}</td>
                <td className="text-right font-semibold" style={{ color: c.contrib_z >= 0 ? "#DC2626" : "#10B981" }}>{c.contrib_z >= 0 ? "+" : ""}{c.contrib_z.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-2 text-[9px] text-zinc-500 leading-tight">
        <span className="font-semibold">Mediana</span> de 4 modelos: Diffusion (Moore 1950), Gap Hamilton (2018), Probit Financeiro (Estrella-Mishkin 1998 + Wright 2006 + Mendonça-Galvão-Lima 2018), Probit Misto AZ (Issler-Vahid 2006). Backtest causal OOS 1996-2026: AUC mediana <strong>0.86</strong> · AUC Probit AZ 0.85. Em emergentes, ensembles simples competem com stacking complexo (Bates-Granger 1969). Faixas cinza = recessões CODACE oficiais.
      </p>
    </section>
  );
}
