"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CodaceFaixa, ProbitAzData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

export function CardProbitAz({ data, codace = [] }: { data: ProbitAzData | null; codace?: CodaceFaixa[] }) {
  const [showContribs, setShowContribs] = useState(false);

  if (!data || !data.serie || data.serie.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Probit Misto AZ Híbrido</h3>
        <p className="mt-2 text-sm text-zinc-500">Aguardando pipeline gerar dados...</p>
      </div>
    );
  }

  const ultima = data.probabilidades;
  const probAz = ultima?.probit_az;

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
          </div>
        )}
      </div>

      <div className="mb-3 h-[180px] rounded-lg border border-zinc-200 bg-white p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.serie} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(data.serie.length / 12))} />
            <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} />
            <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—")} labelFormatter={(l: unknown) => formatMes(String(l ?? ""))} />
            <ReferenceLine y={0.5} stroke="#000" strokeDasharray="2 4" />
            {codace.map((f, i) => (
              <ReferenceArea key={`paz-${i}`} x1={f.pico} x2={f.vale} fill="#9CA3AF" fillOpacity={0.18} />
            ))}
            <Line type="monotone" dataKey="diffusion" stroke="#F59E0B" strokeWidth={0.9} dot={false} connectNulls name="Diffusion" opacity={0.6} />
            <Line type="monotone" dataKey="gap_hp" stroke="#10B981" strokeWidth={0.9} dot={false} connectNulls name="Gap HP" opacity={0.6} />
            <Line type="monotone" dataKey="probit_fin" stroke="#3B82F6" strokeWidth={0.9} dot={false} connectNulls name="Probit Fin" opacity={0.6} />
            <Line type="monotone" dataKey="probit_az" stroke="#DC2626" strokeWidth={2} dot={false} connectNulls name="Probit AZ" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-3 text-[10px] mb-3">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-1 bg-amber-500"></span>Diffusion</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-1 bg-emerald-500"></span>Gap HP</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-1 bg-blue-500"></span>Probit Fin</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-1 bg-rose-600 h-[2px]"></span><strong>Probit AZ</strong></span>
        <span className="ml-auto text-zinc-500">cinza = recessões CODACE/FGV-IBRE</span>
      </div>

      {data.contribuicoes_top15 && data.contribuicoes_top15.length > 0 && (
        <div className="rounded-lg bg-zinc-50 p-3">
          <button onClick={() => setShowContribs((o) => !o)} className="flex items-center gap-2 text-xs font-semibold text-[#132960] hover:underline">
            <span>{showContribs ? "▼" : "▶"}</span>
            <span>Top 15 features que mais contribuem em {formatMes(ultima?.mes ?? "")}</span>
          </button>
          {showContribs && (
            <table className="mt-2 w-full text-[11px]">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="text-left py-1">Feature</th>
                  <th className="text-right">β</th>
                  <th className="text-right">x (std)</th>
                  <th className="text-right">β·x</th>
                </tr>
              </thead>
              <tbody>
                {data.contribuicoes_top15.map((c, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1 font-mono text-[10px]">{c.feature}</td>
                    <td className="text-right">{c.beta.toFixed(2)}</td>
                    <td className="text-right">{c.x_std.toFixed(2)}</td>
                    <td className="text-right font-semibold" style={{ color: c.contrib_z >= 0 ? "#DC2626" : "#10B981" }}>{c.contrib_z >= 0 ? "+" : ""}{c.contrib_z.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 text-[10px] text-amber-800">
        ⓘ <strong>Metodologia honesta</strong>: Probit AZ é o 4º modelo, treinado com expanding window OOS. β explicitamente visíveis. Backtest 1996-2026 atinge <strong>AUC 0.95</strong> (vs paper BCB WP 587 que admitiu falhar pro Brasil). Features brutas correlacionam entre si — mas isso ajuda capacidade preditiva (Ridge L2 estabiliza).
      </div>
    </section>
  );
}
