"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

import type {
  CodaceFaixa,
  HiatoPonto,
  IbcBrPonto,
  RecessaoPonto,
  VisaoGeralPayload,
} from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

function CardIbcBrCodace({ serie, codace }: { serie: IbcBrPonto[]; codace: CodaceFaixa[] }) {
  const dados = useMemo(
    () =>
      serie
        .filter((p) => p.indice_sa !== null)
        .map((p) => ({ mes: p.mes, indice_sa: p.indice_sa })),
    [serie],
  );

  if (dados.length === 0) {
    return <PlaceholderCard titulo="A1 — IBC-Br com cronologia CODACE" />;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">Atividade mensal e cronologia de recessões</h3>
        <p className="text-xs text-zinc-500">
          IBC-Br dessazonalizado (BCB, base 2002=100). Faixas cinzas = recessões oficiais CODACE/FGV-IBRE.
          <span className="ml-1 text-zinc-400">⚠ CODACE não datou eventos posteriores a jun/2020; ausência de faixas após essa data não significa ausência de ciclo.</span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          {codace.map((faixa, i) => (
            <ReferenceArea
              key={faixa.pico + "-" + i}
              x1={faixa.pico}
              x2={faixa.vale}
              fill="#9CA3AF"
              fillOpacity={0.15}
              ifOverflow="visible"
            />
          ))}
          {/* Faixa hachurada pos jun/2020: periodo sem datacao oficial CODACE */}
          {dados.length > 0 && dados[dados.length-1].mes > "2020-06" && (
            <ReferenceArea
              x1="2020-06"
              x2={dados[dados.length-1].mes}
              fill="url(#hachuraSemDatacao)"
              fillOpacity={1}
              ifOverflow="visible"
            />
          )}
          <defs>
            <pattern id="hachuraSemDatacao" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#CBD5E1" strokeWidth="1" />
            </pattern>
          </defs>
          <Line type="monotone" dataKey="indice_sa" stroke="#132960" dot={false} strokeWidth={2} name="IBC-Br SA" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Bry-Boschan removido da linha do grafico (e binario 0/100, polui visual).
// E renderizado separadamente como faixas verticais marcando picos detectados.
const MODELOS_COR: Record<string, { cor: string; label: string }> = {
  msdfm: { cor: "#DC2626", label: "MS-AR*" },
  probit_financeiro: { cor: "#2563EB", label: "Probit fin." },
  gap_threshold: { cor: "#059669", label: "Gap HP" },
  diffusion: { cor: "#F59E0B", label: "Diffusion" },
};

function CardRecessaoMultiModelos({
  serie,
  codace,
}: {
  serie: RecessaoPonto[];
  codace: CodaceFaixa[];
}) {
  if (!serie || serie.length === 0) {
    return <PlaceholderCard titulo="A2 — Probabilidade de recessão (5 modelos)" />;
  }

  const ultimo = serie[serie.length - 1];

  // Mediana ALINHADA com hero: prioriza mediana real, depois parcial com asterisco
  const sensiveisPresentes = ultimo.sensiveis_presentes ?? 0;
  const amostraInsuficiente = sensiveisPresentes === 0;
  const medValor =
    !amostraInsuficiente && ultimo.mediana !== null && ultimo.mediana !== undefined
      ? `${ultimo.mediana.toFixed(0)}%`
      : ultimo.mediana_parcial !== null && ultimo.mediana_parcial !== undefined
        ? `${ultimo.mediana_parcial.toFixed(0)}%*`
        : "n/d";
  const medSubtitulo = amostraInsuficiente
    ? `Parcial — ${ultimo.n_modelos} de 4 modelos rodaram`
    : `${ultimo.n_acima_50} de ${ultimo.n_modelos} acima de 50%${ultimo.n_modelos < 4 ? " (parcial)" : ""}`;

  // Mini-cards laterais: valor atual de cada modelo + descrição curta
  const MODELOS_INFO: { key: keyof typeof MODELOS_COR; descr: string }[] = [
    { key: "diffusion", descr: "Difusão de sinais negativos no hard data físico (ANFAVEA, EPE, ANP, OECD CLI)." },
    { key: "gap_threshold", descr: "Logística sobre o hiato HP. Negativo profundo eleva risco." },
    { key: "msdfm", descr: "Markov-Switching no IBC-Br MoM (fallback discreto enquanto statsmodels não carrega)." },
    { key: "probit_financeiro", descr: "Probit Estrella-Mishkin sobre slope DI + ICF z-score." },
  ];

  return (
    <div className="rounded-2xl border-2 border-[#132960]/30 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Probabilidade de recessão — 5 modelos comparados</h3>
          <p className="text-xs text-zinc-500">Cada modelo reproduz uma metodologia da literatura. Sinalização do hero usa contagem de modelos acima de 50%.</p>
        </div>
        <div className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Mediana ({formatMes(ultimo.mes)})</div>
          <div className={`text-2xl font-bold ${amostraInsuficiente ? "text-zinc-500" : "text-[#132960]"}`}>{medValor}</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">{medSubtitulo}</div>
          {ultimo.min_val !== undefined && ultimo.max_val !== undefined && ultimo.min_val !== null && ultimo.max_val !== null && (
            <div className="mt-1 text-[10px] text-zinc-400">Faixa: {ultimo.min_val.toFixed(0)}% – {ultimo.max_val.toFixed(0)}%</div>
          )}
          {ultimo.carry_forward_modelos && ultimo.carry_forward_modelos.length > 0 && (
            <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-800">
              <svg viewBox="0 0 12 12" className="h-2 w-2 fill-current"><circle cx="6" cy="6" r="5" /></svg>
              carry-forward
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={serie} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(serie.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v: number) => v + "%"} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) + "%" : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {codace.map((f, i) => (
            <ReferenceArea key={f.pico + "-" + i} x1={f.pico} x2={f.vale} fill="#9CA3AF" fillOpacity={0.12} />
          ))}
          <ReferenceLine y={50} stroke="#000" strokeDasharray="2 4" />
          {/* Bry-Boschan como pequenas faixas verticais tracejadas onde =100 (pico detectado retroativo) */}
          {serie.map((p, i) => (
            p.bry_boschan === 100 ? (
              <ReferenceLine
                key={`bb-${p.mes}-${i}`}
                x={p.mes}
                stroke="#7C3AED"
                strokeDasharray="3 3"
                strokeOpacity={0.35}
              />
            ) : null
          ))}
          {Object.entries(MODELOS_COR).map(([key, { cor, label }]) => (
            <Line key={key} type="monotone" dataKey={key} stroke={cor} strokeWidth={1.5} dot={false} name={label} connectNulls />
          ))}
              <Line type="monotone" dataKey="mediana" stroke="#000" strokeWidth={3} dot={false} name="Mediana dos modelos" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Coluna direita FINA: mini-cards com valor atual de cada modelo */}
        <div className="lg:col-span-1 flex flex-col gap-1.5">
          {MODELOS_INFO.map((m) => {
            const valor = (ultimo as Record<string, unknown>)[m.key];
            const info = MODELOS_COR[m.key];
            const valorNum = typeof valor === "number" ? valor : null;
            const ehNull = valorNum === null;
            return (
              <div key={m.key} className={`rounded-lg border bg-white p-2 ${ehNull ? "border-dashed border-zinc-300 opacity-60" : "border-zinc-200"}`}>
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: info.cor }} />
                    <span className="text-[10px] font-semibold text-zinc-800 truncate">{info.label}</span>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${ehNull ? "text-zinc-300" : valorNum > 50 ? "text-rose-700" : "text-zinc-700"}`}>
                    {ehNull ? "n/d" : `${valorNum.toFixed(0)}%`}
                  </span>
                </div>
                <p className="mt-0.5 text-[9px] leading-tight text-zinc-500">{m.descr}</p>
                {ehNull && (
                  <p className="mt-0.5 text-[9px] italic text-amber-700">Aguardando próxima rodada</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-zinc-500">
        * <strong>MS-AR</strong>: implementação atual usa fallback discreto (quintis sobre média móvel 6m do IBC-Br MoM) porque a biblioteca <code>statsmodels</code> não está carregada no pipeline. Próximo loop: instalar statsmodels e obter probabilidade contínua via Hamilton filter.
        Linhas verticais tracejadas roxas marcam <strong>picos detectados pelo Bry-Boschan</strong> (datador retroativo, não-probabilístico).
        Probit financeiro e Diffusion estão retornando null nos últimos meses (Newton-Raphson divergindo / ANFAVEA YoY null). Mediana usa só os modelos disponíveis em cada mês.
      </p>
    </div>
  );
}

function CardHiatoLeque({ serie, codace }: { serie: HiatoPonto[]; codace: CodaceFaixa[] }) {
  if (!serie || serie.length === 0) {
    return <PlaceholderCard titulo="A3 — Hiato do produto (leque HP + Hamilton)" />;
  }
  const dados = serie.map((p) => ({
    mes: p.mes,
    gap_hp: p.gap_hp_pct,
    gap_hamilton: p.gap_hamilton_pct,
    leque_alto: p.gap_max_pct,
    leque_baixo: p.gap_min_pct,
  }));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">Hiato do produto — leque de métodos</h3>
        <p className="text-xs text-zinc-500">HP (λ=129.600) e Hamilton (h=24m, p=4). Área cinza = leque min-max. Acima de 0 = aquecimento; abaixo = ociosidade.</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(1) + "%"} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) + "%" : String(v ?? ""))}
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
          <Area type="monotone" dataKey="leque_alto" stroke="none" fill="#9CA3AF" fillOpacity={0.18} name="Máximo" />
          <Area type="monotone" dataKey="leque_baixo" stroke="none" fill="#fff" fillOpacity={1} name="Mínimo" />
          <Line type="monotone" dataKey="gap_hp" stroke="#DC2626" dot={false} strokeWidth={1.5} name="HP" />
          <Line type="monotone" dataKey="gap_hamilton" stroke="#2563EB" dot={false} strokeWidth={1.5} name="Hamilton" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlaceholderCard({ titulo }: { titulo: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
      <h3 className="text-base font-semibold text-zinc-500">{titulo}</h3>
      <p className="mt-2 text-xs text-zinc-400">Pipeline rodando — dados aparecerão na próxima atualização.</p>
    </div>
  );
}

export function BlocoACicloAtual({ payload }: { payload: VisaoGeralPayload }) {
  const codaceMensal = payload.codace?.mensal ?? [];

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#132960]">1. Onde estamos no ciclo</h2>
        <p className="mt-1 text-xs text-zinc-600">Comparação visual da atividade mensal (IBC-Br) com a cronologia oficial CODACE/FGV, leitura prospectiva via cinco modelos de probabilidade de recessão e medida de hiato do produto.</p>
      </header>
      <CardRecessaoMultiModelos serie={payload.recessao?.serie ?? []} codace={codaceMensal} />
      <CardHiatoLeque serie={payload.hiato?.serie ?? []} codace={codaceMensal} />
    </section>
  );
}
