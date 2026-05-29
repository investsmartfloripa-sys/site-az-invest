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

// Mediana estatística correta: array par = média dos 2 centrais
function medianaEstatistica(vs: number[]): number | null {
  if (vs.length === 0) return null;
  const ordenados = vs.slice().sort((a, b) => a - b);
  const m = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 0) {
    return (ordenados[m - 1] + ordenados[m]) / 2;
  }
  return ordenados[m];
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

  // FONTE CANÔNICA ÚNICA: probit_az.json. 4 modelos (MS-AR fica fora até statsmodels carregar).
  const diffusion = ultimaAz?.diffusion ?? null;
  const gapHp = ultimaAz?.gap_hp ?? null;
  const probitFin = ultimaAz?.probit_fin ?? null;
  const probAz = ultimaAz?.probit_az ?? null;

  // Mediana estatisticamente correta
  const valores = [diffusion, gapHp, probitFin, probAz].filter((v): v is number => v !== null && v !== undefined);
  const mediana = medianaEstatistica(valores);
  const corMediana = corPara(mediana);
  const nModelos = valores.length;

  // Histerese Hamilton 2011 sobre a mediana
  // Recalcular mediana mês a mês (estatística correta)
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

  const borderColor = corMediana;

  const modelos: Modelo[] = [
    { key: "diffusion", label: "Diffusion", color: "#F59E0B", valor: diffusion },
    { key: "gap_hp", label: "Gap Hamilton 2018", color: "#10B981", valor: gapHp },
    { key: "probit_fin", label: "Probit Financeiro", color: "#3B82F6", valor: probitFin },
    { key: "probit_az", label: "Probit Misto AZ", color: "#DC2626", valor: probAz },
  ];

  // Hachura pós CODACE oficial (jun/2020) — sem datação oficial
  const hachuraStart = "2020-06";
  const ultimoMes = serieFinal[serieFinal.length - 1]?.mes ?? "2026-12";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm border-l-4" style={{ borderLeftColor: borderColor }}>
      {/* Header: Mediana destaque + título */}
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h3 className="text-sm font-semibold text-zinc-900">
            Probabilidade de recessão — ensemble de {nModelos} modelos causais
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
            Mediana de 4 metodologias da literatura (Moore 1950, Hamilton 2018, Estrella-Mishkin 1998, Issler-Vahid 2006). Backtest causal OOS 1996-2026: AUC mediana <strong>0.86</strong>.
            <span className="ml-1 text-amber-700">⚠ MS-AR Hamilton 1989 aguardando statsmodels carregar no pipeline.</span>
          </p>
        </div>
        {mediana !== null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Mediana {nModelos} modelos</div>
            <div className="flex items-baseline gap-2 justify-end">
              <span className="text-4xl font-bold" style={{ color: corMediana }}>
                {Math.round(mediana * 100)}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: corHist + "22", color: corHist }}>
                {estadoHist}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500">{formatMes(ultimaAz?.mes ?? "")}</div>
            <div className="text-[9px] text-zinc-400">Histerese Hamilton 2011 · 65% entra · 35% sai · 2m persist.</div>
          </div>
        )}
      </div>

      {/* Gráfico grande */}
      <div className="mb-2 h-[260px] rounded border border-zinc-100 bg-zinc-50 p-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serieFinal} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(serieFinal.length / 12))} />
            <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—")} labelFormatter={(l: unknown) => formatMes(String(l ?? ""))} />
            {/* Linhas referência histerese */}
            <ReferenceLine y={0.65} stroke="#DC2626" strokeDasharray="4 4" opacity={0.4} />
            <ReferenceLine y={0.35} stroke="#10B981" strokeDasharray="4 4" opacity={0.4} />
            {/* Faixas CODACE oficial */}
            {codace.map((f, i) => (
              <ReferenceArea key={`cod-${i}`} x1={f.pico} x2={f.vale} fill="#9CA3AF" fillOpacity={0.22} />
            ))}
            {/* Hachura pós-2020 (sem datação CODACE) */}
            <ReferenceArea x1={hachuraStart} x2={ultimoMes} fill="#9CA3AF" fillOpacity={0.06} strokeOpacity={0} />
            {/* 4 linhas dos modelos */}
            <Line type="monotone" dataKey="diffusion" stroke="#F59E0B" strokeWidth={0.8} dot={false} connectNulls opacity={0.55} name="Diffusion" />
            <Line type="monotone" dataKey="gap_hp" stroke="#10B981" strokeWidth={0.8} dot={false} connectNulls opacity={0.55} name="Gap" />
            <Line type="monotone" dataKey="probit_fin" stroke="#3B82F6" strokeWidth={0.8} dot={false} connectNulls opacity={0.55} name="Probit Fin" />
            <Line type="monotone" dataKey="probit_az" stroke="#DC2626" strokeWidth={0.9} dot={false} connectNulls opacity={0.65} name="Probit AZ" />
            {/* Mediana destacada */}
            <Line type="monotone" dataKey="mediana" stroke="#132960" strokeWidth={2.4} dot={false} connectNulls name="Mediana" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 4 chips dos modelos empilhados ABAIXO do gráfico */}
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        {modelos.map((m) => (
          <div key={m.key} className="rounded border bg-white px-2 py-1.5 border-l-[3px]" style={{ borderLeftColor: m.color }}>
            <div className="text-[9px] uppercase tracking-wider font-bold leading-none" style={{ color: m.color }}>
              {m.label}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-base font-bold text-zinc-900">
                {m.valor !== null && m.valor !== undefined ? `${Math.round(m.valor * 100)}%` : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Legenda compacta */}
      <div className="flex items-center gap-2 text-[9px] text-zinc-500 mb-2 flex-wrap">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-[2px]" style={{ backgroundColor: "#132960" }}></span><strong className="text-zinc-700">Mediana</strong></span>
        <span>·</span>
        <span>linhas finas = 4 modelos individuais</span>
        <span>·</span>
        <span>faixas cinza = recessões CODACE oficiais</span>
        <span>·</span>
        <span>hachura pós-jun/2020 = sem datação CODACE</span>
      </div>

      {/* Contribuições do Probit AZ */}
      {data.contribuicoes_top15 && data.contribuicoes_top15.length > 0 && (
        <>
          <button
            onClick={() => setShowContribs((o) => !o)}
            className="w-full text-left text-[10px] text-[#132960] hover:underline flex items-center gap-1 mt-1"
          >
            <span>{showContribs ? "▼" : "▶"}</span>
            <span>Top 15 features do Probit AZ (β · x_std) em {formatMes(ultimaAz?.mes ?? "")}</span>
          </button>
          {showContribs && (
            <table className="mt-2 w-full text-[10px]">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="text-left py-1">Feature</th>
                  <th className="text-right">β</th>
                  <th className="text-right">x (std)</th>
                  <th className="text-right">β·x</th>
                </tr>
              </thead>
              <tbody>
                {data.contribuicoes_top15.slice(0, 10).map((c, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1 font-mono text-[9px]">{c.feature}</td>
                    <td className="text-right">{c.beta.toFixed(2)}</td>
                    <td className="text-right">{c.x_std.toFixed(2)}</td>
                    <td className="text-right font-semibold" style={{ color: c.contrib_z >= 0 ? "#DC2626" : "#10B981" }}>
                      {c.contrib_z >= 0 ? "+" : ""}{c.contrib_z.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <p className="mt-2 text-[9px] text-zinc-500 leading-tight">
        <strong>Refs:</strong> Moore 1950 (Diffusion) · Hodrick-Prescott 1997 / Ravn-Uhlig 2002 + Hamilton 2018 (Gap) · Estrella-Mishkin 1998 + Wright 2006 + Mendonça-Galvão-Lima 2018 (Probit Fin) · Issler-Vahid 2006 (Probit AZ) · Bates-Granger 1969 (ensembles).
      </p>
    </section>
  );
}
