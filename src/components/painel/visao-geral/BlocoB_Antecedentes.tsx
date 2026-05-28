"use client";

import {
  ComposedChart,
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

import type { CodaceFaixa, OecdCliData, FgvAntecedentesData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

function CardOecdCli({ data, codace }: { data: OecdCliData | null; codace: CodaceFaixa[] }) {
  if (!data || !data.serie || data.serie.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
        <h3 className="text-base font-semibold text-zinc-500">B1 — OECD CLI Brasil</h3>
        <p className="mt-2 text-xs text-zinc-400">Aguardando pipeline.</p>
      </div>
    );
  }

  const dados = data.serie.map((p) => ({ mes: p.mes, nivel: p.nivel, var6: p.var_6m_anualizada }));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">
          Indicador antecedente OECD — Brasil
        </h3>
        <p className="text-xs text-zinc-500">
          Linha 100 = tendência. Quadrante atual: <strong>{data.destaques?.quadrante_recente ?? "—"}</strong>. Adianta
          viradas em 6-9 meses.
        </p>
        {data.mes_recente && new Date(data.mes_recente + "-01").getTime() < Date.now() - 1000*60*60*24*365 && (
          <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-800 border border-amber-200">
            ⚠ Série OECD com defasagem &gt;12 meses (último ponto: {data.mes_recente}). Tratar como contexto histórico.
            Para sinal corrente use o card de Confiança Empresarial FGV no Bloco C.
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis yAxisId="lvl" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
          <YAxis yAxisId="var" orientation="right" tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {codace.map((f, i) => (
            <ReferenceArea
              key={`${f.pico}-${i}`}
              x1={f.pico}
              x2={f.vale}
              fill="#9CA3AF"
              fillOpacity={0.12}
              yAxisId="lvl"
            />
          ))}
          <ReferenceLine yAxisId="lvl" y={100} stroke="#000" strokeDasharray="2 4" />
          <Line yAxisId="lvl" type="monotone" dataKey="nivel" stroke="#132960" strokeWidth={2} dot={false} name="CLI (nível)" />
          <Line
            yAxisId="var"
            type="monotone"
            dataKey="var6"
            stroke="#DC2626"
            strokeWidth={1.5}
            dot={false}
            name="Var. 6m anualizada (%)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardFgvAntecedentes({ data }: { data: FgvAntecedentesData | null }) {
  if (!data || data.freshness_status === "missing") {
    return null; // esconder até o scraper FGV ser ativado
  }

  const status = data.freshness_status;
  const iace = data.iace?.serie ?? [];
  const icce = data.icce?.serie ?? [];
  const iaemp = data.iaemp?.serie ?? [];
  const iiebr = data.iie_br?.serie ?? [];

  // Junta por mês
  const todosMeses = new Set<string>();
  for (const arr of [iace, icce, iaemp, iiebr]) {
    for (const p of arr) todosMeses.add(p.mes);
  }
  const dados = Array.from(todosMeses)
    .sort()
    .map((mes) => ({
      mes,
      iace: iace.find((p) => p.mes === mes)?.valor ?? null,
      icce: icce.find((p) => p.mes === mes)?.valor ?? null,
      iaemp: iaemp.find((p) => p.mes === mes)?.valor ?? null,
      iie_br: iiebr.find((p) => p.mes === mes)?.valor ?? null,
    }));

  if (dados.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">Antecedentes FGV-IBRE</h3>
        <p className="text-xs text-zinc-500">
          IACE (antecedente composto), ICCE (coincidente), IAEmp (antecedente de emprego), IIE-Br (incerteza
          econômica).
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="iace" stroke="#DC2626" dot={false} strokeWidth={2} name="IACE" connectNulls />
          <Line type="monotone" dataKey="icce" stroke="#2563EB" dot={false} strokeWidth={1.5} name="ICCE" connectNulls />
          <Line type="monotone" dataKey="iaemp" stroke="#059669" dot={false} strokeWidth={1.5} name="IAEmp" connectNulls />
          <Line type="monotone" dataKey="iie_br" stroke="#7C3AED" dot={false} strokeWidth={1.5} name="IIE-Br" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BlocoBAntecedentes({
  oecdCli,
  fgvAntecedentes,
  codace,
}: {
  oecdCli: OecdCliData | null;
  fgvAntecedentes: FgvAntecedentesData | null;
  codace: CodaceFaixa[];
}) {
  // OECD CLI permanentemente em rodapé -- portal IBRE publica com defasagem &gt;12m,
  // então tratamos como contexto histórico em todas as renderizacoes (decisão loop 11)
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#132960]">2. Sondagens antecedentes (FGV-IBRE)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Indicadores antecedentes que historicamente lideram viradas de ciclo em 6-9 meses. O IACE composto da FGV agrega expectativas de empresários e consumidores. OECD CLI publica com defasagem &gt;12m e foi movido para nota de rodapé.
        </p>
      </header>
      <CardFgvAntecedentes data={fgvAntecedentes} />
      <details className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-600">Nota de rodapé: OECD CLI (contexto histórico — publicação defasada)</summary>
        <div className="mt-3">
          <CardOecdCli data={oecdCli} codace={codace} />
        </div>
      </details>
    </section>
  );
}
