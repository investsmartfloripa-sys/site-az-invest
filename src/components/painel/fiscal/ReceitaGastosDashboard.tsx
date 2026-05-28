"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { FiscalClassicosData, PontoMensalPct } from "@/lib/painel-fiscal";
import { CORES_SERIES, CardHeader, IndicadorBox, Section, Toggle, useHorizonte } from "./FiscalShell";

const HORIZONTES = [
  { value: "5a", label: "5 anos", n: 60 },
  { value: "10a", label: "10 anos", n: 120 },
  { value: "max", label: "Max", n: 9999 },
] as const;

const BASES = [
  { value: "pib", label: "% PIB" },
  { value: "receita", label: "% Receita" },
] as const;
type Base = (typeof BASES)[number]["value"];

function fmtMes(s: string): string {
  if (!s) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
function fmtPct(v: number | null | undefined, casas = 1): string {
  if (v == null) return "—";
  return `${v.toFixed(casas)}%`;
}
function ultPct(s: PontoMensalPct[] | null | undefined): number | null {
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = s[i].valor_pct;
    if (v != null) return v;
  }
  return null;
}
function ultMensal(s: { valor: number | null }[] | null | undefined): number | null {
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = s[i].valor;
    if (v != null) return v;
  }
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipPct = (v: any): string => (typeof v === "number" ? `${v.toFixed(2)}%` : "—");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipLabel = (s: any): string => fmtMes(String(s ?? ""));

function tail<T>(s: T[], n: number): T[] {
  return s.slice(Math.max(0, s.length - n));
}

function mergePct(series: { data: string; valor_pct: number | null }[][], keys: string[]) {
  const mapa = new Map<string, Record<string, number | string | null>>();
  series.forEach((s, idx) => {
    s.forEach((r) => {
      if (!mapa.has(r.data)) mapa.set(r.data, { mes: r.data });
      mapa.get(r.data)![keys[idx]] = r.valor_pct;
    });
  });
  return Array.from(mapa.values()).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
}

function anoAtual(): string {
  return String(new Date().getFullYear());
}

// === Card da Regra Fiscal (meta LDO + arcabouço) ===
function RegraFiscalCard({ data }: { data: FiscalClassicosData }) {
  const ano = anoAtual();
  const meta = data.metas_ldo?.anos?.[ano];
  const primarioAtual = ultPct(data.receita_e_gastos.primario_central_pct_pib);
  if (!meta || primarioAtual == null) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
        Meta LDO {ano}: não disponível.
      </div>
    );
  }
  const dentro = primarioAtual >= meta.banda_inf && primarioAtual <= meta.banda_sup;
  const acima = primarioAtual > meta.banda_sup;
  const statusBg = dentro ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300";
  const statusTxt = dentro ? "text-emerald-900" : "text-rose-900";
  const statusLabel = dentro ? "DENTRO da banda" : acima ? "ACIMA do teto da banda" : "ABAIXO do piso da banda";

  return (
    <div className={`rounded-2xl border-2 ${statusBg} p-5 shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-bold uppercase tracking-wide ${statusTxt}`}>Meta primária LDO {ano} (gov central)</h3>
          <p className="mt-1 text-xs text-zinc-700">Convenção: primário positivo = superávit, em % PIB. Banda ±0,25pp segundo arcabouço fiscal (LC 200/2023).</p>
        </div>
        <span className={`rounded-full border-2 px-3 py-1 text-xs font-bold uppercase ${statusBg} ${statusTxt}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-white/70 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Centro da meta</div>
          <div className="text-xl font-bold text-zinc-700">{fmtPct(meta.centro, 2)}</div>
        </div>
        <div className="rounded-lg bg-white/70 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Banda</div>
          <div className="text-xl font-bold text-zinc-700">
            {fmtPct(meta.banda_inf, 2)} a {fmtPct(meta.banda_sup, 2)}
          </div>
        </div>
        <div className="rounded-lg bg-white/70 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Realizado 12m</div>
          <div className={`text-xl font-bold ${statusTxt}`}>{fmtPct(primarioAtual, 2)}</div>
        </div>
        <div className="rounded-lg bg-white/70 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Gap vs centro</div>
          <div className={`text-xl font-bold ${statusTxt}`}>
            {(primarioAtual - meta.centro >= 0 ? "+" : "") + (primarioAtual - meta.centro).toFixed(2)} pp
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">{data.metas_ldo?._fonte}</p>
    </div>
  );
}

type SerieToggle = {
  id: string;
  label: string;
  cor: string;
  valor: number | null;
  unidade: string;
  fonte?: string;
  formula?: string;
  serieTemporal: PontoMensalPct[];
  ativoInicial?: boolean;
};

export function ReceitaGastosDashboard({ data }: { data: FiscalClassicosData }) {
  const horizonte = useHorizonte(HORIZONTES, "10a");
  const [base, setBase] = useState<Base>("pib");

  // === KPIs (último valor) ===
  const receita_pct = ultPct(data.receita_e_gastos.receita_liquida_pct_pib);
  const despesa_pct = ultPct(data.receita_e_gastos.despesa_total_pct_pib);
  const primario_pct = ultPct(data.receita_e_gastos.primario_central_pct_pib);
  const juros_pct = ultPct(data.receita_e_gastos.juros_central_pct_pib);
  const juros_pct_rec = ultPct(data.receita_e_gastos.juros_pct_receita);
  const nfsp_pct_serie = data.receita_e_gastos.nfsp_sp_12m_pct_pib;
  const nfsp_pct = ultMensal(nfsp_pct_serie);

  // NFSP como PontoMensalPct (converter de {valor} para {valor_pct})
  const nfspSerieToggle: PontoMensalPct[] = useMemo(
    () => nfsp_pct_serie.map((r) => ({ data: r.data, valor_pct: r.valor })),
    [nfsp_pct_serie],
  );

  // KPIs decomposição (último ponto)
  const ult = (key: string) => {
    const s = (data.receita_e_gastos as unknown as Record<string, PontoMensalPct[] | undefined>)[key];
    return ultPct(s);
  };
  const getSerie = (key: string): PontoMensalPct[] => {
    return (data.receita_e_gastos as unknown as Record<string, PontoMensalPct[] | undefined>)[key] ?? [];
  };
  const previdencia_pct = ult("previdencia_12m_pct_pib");
  const pessoal_pct_kpi = ult("pessoal_12m_pct_pib");
  const bpc_pct = ult("bpc_loas_12m_pct_pib");
  const abono_pct = ult("abono_seguro_12m_pct_pib");

  // === Definição das 6 séries com toggle (% PIB) ===
  const seriesPossiveis: SerieToggle[] = useMemo(() => [
    {
      id: "receita",
      label: "Receita líquida / PIB",
      cor: CORES_SERIES[2], // verde
      valor: receita_pct,
      unidade: "%",
      fonte: "Tesouro RTN L.38",
      serieTemporal: data.receita_e_gastos.receita_liquida_pct_pib,
      ativoInicial: true,
    },
    {
      id: "despesa",
      label: "Despesa total / PIB",
      cor: "#1e3a8a", // azul-marinho institucional
      valor: despesa_pct,
      unidade: "%",
      fonte: "Tesouro RTN L.39",
      serieTemporal: data.receita_e_gastos.despesa_total_pct_pib,
      ativoInicial: true,
    },
    {
      id: "primario",
      label: "Primário gov central / PIB",
      cor: "#9467bd", // roxo (calculado)
      valor: primario_pct,
      unidade: "%",
      formula: "Receita líquida − Despesa primária",
      serieTemporal: data.receita_e_gastos.primario_central_pct_pib,
      ativoInicial: false,
    },
    {
      id: "juros",
      label: "Juros nominais / PIB",
      cor: "#1f77b4", // azul
      valor: juros_pct,
      unidade: "%",
      fonte: "Tesouro RTN L.74",
      serieTemporal: data.receita_e_gastos.juros_central_pct_pib,
      ativoInicial: false,
    },
    {
      id: "nfsp",
      label: "NFSP setor público / PIB",
      cor: "#17becf", // teal
      valor: nfsp_pct,
      unidade: "%",
      fonte: "BCB SGS 5727",
      serieTemporal: nfspSerieToggle,
      ativoInicial: false,
    },
    {
      id: "previdencia",
      label: "Previdência / PIB",
      cor: "#6a3d9a", // roxo escuro
      valor: previdencia_pct,
      unidade: "%",
      fonte: "Tesouro RTN L.40",
      serieTemporal: getSerie("previdencia_12m_pct_pib"),
      ativoInicial: false,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data, receita_pct, despesa_pct, primario_pct, juros_pct, nfsp_pct, previdencia_pct, nfspSerieToggle]);

  // Estado de quais séries estão ativas
  const [ativas, setAtivas] = useState<Set<string>>(() => {
    return new Set(seriesPossiveis.filter((s) => s.ativoInicial).map((s) => s.id));
  });

  function toggle(id: string) {
    const nova = new Set(ativas);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    setAtivas(nova);
  }

  // Dados do gráfico principal — só séries ativas
  const chartData = useMemo(() => {
    const ativasArr = seriesPossiveis.filter((s) => ativas.has(s.id));
    if (ativasArr.length === 0) return [];
    return mergePct(
      ativasArr.map((s) => tail(s.serieTemporal, horizonte.n)),
      ativasArr.map((s) => s.id),
    );
  }, [seriesPossiveis, ativas, horizonte.n]);

  // Decomposicao COMPLETA de despesa (para bloco mais abaixo)
  const serieDecomp = useMemo(() => {
    const keyBase = base === "pib" ? "pct_pib" : "pct_receita";
    const previdencia = data.receita_e_gastos[`previdencia_12m_${keyBase}` as const];
    const pessoal = data.receita_e_gastos[`pessoal_12m_${keyBase}` as const];
    const bpc = data.receita_e_gastos[`bpc_loas_12m_${keyBase}` as const];
    const abono = data.receita_e_gastos[`abono_seguro_12m_${keyBase}` as const];
    const fundeb = data.receita_e_gastos[`fundeb_12m_${keyBase}` as const];
    const subsidios = data.receita_e_gastos[`subsidios_12m_${keyBase}` as const];
    const discric = data.receita_e_gastos[`discricionarias_12m_${keyBase}` as const];

    const all: Array<{ data: string; valor_pct: number | null }[]> = [];
    const labels: string[] = [];
    if (previdencia) { all.push(tail(previdencia, horizonte.n)); labels.push("Previdência"); }
    if (pessoal) { all.push(tail(pessoal, horizonte.n)); labels.push("Pessoal"); }
    if (bpc) { all.push(tail(bpc, horizonte.n)); labels.push("BPC/LOAS"); }
    if (abono) { all.push(tail(abono, horizonte.n)); labels.push("Abono+seguro"); }
    if (fundeb) { all.push(tail(fundeb, horizonte.n)); labels.push("FUNDEB compl."); }
    if (subsidios) { all.push(tail(subsidios, horizonte.n)); labels.push("Subsídios"); }
    if (discric) { all.push(tail(discric, horizonte.n)); labels.push("Discricionárias"); }
    return { data: mergePct(all, labels), labels };
  }, [data, horizonte.n, base]);

  // Receita decomposta por tributo (% PIB)
  const serieReceitaPorTributo = useMemo(() => {
    const keys = [
      ["imposto_renda_12m_pct_pib", "Imposto de Renda"],
      ["cofins_12m_pct_pib", "Cofins"],
      ["csll_12m_pct_pib", "CSLL"],
      ["pis_pasep_12m_pct_pib", "PIS/Pasep"],
      ["ipi_12m_pct_pib", "IPI"],
      ["iof_12m_pct_pib", "IOF"],
      ["imposto_importacao_12m_pct_pib", "Imp. Importação"],
      ["rgps_arrecadacao_12m_pct_pib", "RGPS"],
      ["dividendos_12m_pct_pib", "Dividendos+Concessões"],
    ] as const;
    const all: { data: string; valor_pct: number | null }[][] = [];
    const labels: string[] = [];
    for (const [k, lbl] of keys) {
      const serie = (data.receita_e_gastos as unknown as Record<string, PontoMensalPct[] | undefined>)[k];
      if (serie?.length) {
        all.push(tail(serie, horizonte.n));
        labels.push(lbl);
      }
    }
    return { data: mergePct(all, labels), labels };
  }, [data, horizonte.n]);

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Receita e gastos do governo central"
        subtitulo="Receita líquida do Tesouro (após transferências constitucionais), despesa primária e juros. Clique nos cards acima do gráfico para adicionar/remover séries. Fonte: Tesouro Nacional/RTN."
        rightSlot={
          <div className="flex gap-2">
            <Toggle value={base} onChange={(v) => setBase(v as Base)} options={[...BASES]} size="sm" />
            <Toggle value={horizonte.horizonte} onChange={horizonte.setHorizonte} options={[...HORIZONTES]} />
          </div>
        }
      />

      {/* === REGRA FISCAL (meta LDO) === */}
      <RegraFiscalCard data={data} />

      {/* === CARDS-TOGGLE HORIZONTAIS ACIMA === */}
      <div>
        <div className="mb-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-700">
          <strong>Tracejado</strong>: clique p/ adicionar série · <strong>Colorido</strong>: ativo (clique p/ remover)
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {seriesPossiveis.map((s) => {
            const ativo = ativas.has(s.id);
            const semDado = s.valor == null;
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => toggle(s.id)}
                disabled={semDado}
                className={`group cursor-pointer rounded-lg p-2 text-left transition ${
                  semDado ? "cursor-not-allowed border-2 border-zinc-200 bg-zinc-50 opacity-60" :
                  ativo
                    ? "border-2 shadow-md hover:shadow-lg hover:scale-[1.02]"
                    : "border-2 border-dashed border-zinc-300 bg-white hover:border-solid hover:scale-[1.02] hover:shadow-md"
                }`}
                style={ativo && !semDado ? { borderColor: s.cor, background: `${s.cor}10` } : {}}
              >
                <div className="flex items-start gap-1.5">
                  <span
                    className="mt-0.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                    style={{ background: ativo ? s.cor : "transparent", border: `2px solid ${s.cor}` }}
                  />
                  <h4 className="flex-1 text-[11.5px] font-bold leading-tight text-[#132960]">{s.label}</h4>
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                  {s.valor != null ? `${s.valor.toFixed(2)}${s.unidade}` : "—"}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  {s.formula && (
                    <span className="rounded bg-violet-100 px-1 py-0.5 text-[9px] font-bold uppercase text-violet-900">calc</span>
                  )}
                  {!semDado && (ativo ? (
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                      style={{ background: s.cor }}
                    >
                      ativo
                    </span>
                  ) : (
                    <span className="rounded border border-dashed border-zinc-400 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-500 group-hover:border-solid group-hover:text-[#132960]">
                      + add
                    </span>
                  ))}
                </div>
                {s.formula && (
                  <p className="mt-1 text-[9.5px] italic leading-tight text-violet-700">{s.formula}</p>
                )}
                {s.fonte && !s.formula && (
                  <p className="mt-1 text-[9.5px] leading-tight text-zinc-500">{s.fonte}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* === GRÁFICO PRINCIPAL EM LARGURA TOTAL === */}
      <Section titulo="Trajetória das séries">
        {chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-sm text-zinc-500">
            Selecione pelo menos uma série nos cards acima.
          </div>
        ) : (
          <div className="h-[32rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  unit="%"
                  domain={[(dataMin: number) => Math.floor(Math.min(dataMin, -2)), (dataMax: number) => Math.ceil(dataMax / 2) * 2]}
                  allowDecimals={false}
                />
                <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {seriesPossiveis.filter((s) => ativas.has(s.id)).map((s) => (
                  <Line key={s.id} type="monotone" dataKey={s.id} name={s.label} stroke={s.cor} strokeWidth={2.75} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[11px] text-zinc-500">
          Todas as séries em % PIB, 12 meses acumulados. Receita e Despesa ativadas por default — clique nos cards acima pra somar primário, juros, NFSP e previdência.
        </p>
      </Section>

      {/* === DEBT SERVICE / RECEITA + GAP BLANCHARD === */}
      <Section titulo="Carga de juros sobre a receita líquida" hint="Quanto da receita do gov central é consumida só para pagar juros. Métrica Dalio (Debt Service/Income).">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-rose-900">Juros / Receita Líquida</div>
            <div className="mt-2 text-4xl font-bold text-rose-900">{fmtPct(juros_pct_rec, 1)}</div>
            <p className="mt-3 text-xs text-rose-900">
              {juros_pct_rec != null && juros_pct_rec > 30
                ? `Acima dos ${fmtPct(30, 0)} considerados zona de alerta por Dalio (cap. The Mechanics). Cada R$ 100 arrecadados, R$ ${juros_pct_rec.toFixed(0)} viram juros antes de qualquer serviço público.`
                : "Patamar Dalio: < 10% verde, 10-20% atenção, 20-30% crítico, > 30% break."}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-amber-900">Carga de juros / Despesa total</div>
            <div className="mt-2 text-4xl font-bold text-amber-900">{
              juros_pct != null && despesa_pct != null && despesa_pct > 0
                ? `${((juros_pct / despesa_pct) * 100).toFixed(1)}%`
                : "—"
            }</div>
            <p className="mt-3 text-xs text-amber-900">
              Quanto da despesa total é só juros — supera previdência+pessoal somados. Dalio: quando juros viram a maior linha do orçamento, espaço fiscal evapora.
            </p>
          </div>
        </div>
      </Section>

      {/* === IndicadorBox detalhados (mantidos como referência expandida abaixo do gráfico) === */}
      <Section titulo="Detalhamento dos indicadores principais" hint="Visão expandida com fonte, fórmula, glossário e narrativa de cada indicador.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <IndicadorBox
            titulo="Receita líquida"
            valor={receita_pct}
            unidade="%"
            fonte="Tesouro RTN, tabela 1.1 linha 38"
            narrativa="Receita do gov central após desconto das transferências constitucionais (FPE, FPM, FUNDEB) — é o que efetivamente fica disponível para gastos federais."
            siglas={[
              { sigla: "RTN", expansao: "Relatório do Tesouro Nacional" },
              { sigla: "FPE/FPM", expansao: "Fundos de Participação dos Estados / Municípios" },
            ]}
          />
          <IndicadorBox
            titulo="Despesa total"
            valor={despesa_pct}
            unidade="%"
            fonte="Tesouro RTN, tabela 1.1 linha 39"
            narrativa="Soma de previdência + pessoal + outras obrigatórias + discricionárias. Limite arcabouço: crescimento real ≤ 70% do crescimento real da receita."
            trend={despesa_pct && despesa_pct > 20 ? "ruim" : "neutra"}
          />
          <IndicadorBox
            titulo="Primário gov central"
            valor={primario_pct}
            unidade="%"
            formula="Receita líquida − Despesa primária (acima da linha)"
            narrativa="Resultado fiscal sem juros. Positivo = superávit. Meta LDO 2026: 0,5% PIB com banda ±0,25pp. Realizado: déficit."
            siglas={[
              { sigla: "LDO", expansao: "Lei de Diretrizes Orçamentárias" },
            ]}
            trend={primario_pct && primario_pct > 0 ? "boa" : "ruim"}
          />
          <IndicadorBox
            titulo="Juros nominais"
            valor={juros_pct}
            unidade="%"
            fonte="Tesouro RTN linha 74"
            narrativa="Despesa anual com juros da dívida federal. Brasil tem juros nominais altos por causa da Selic elevada + estoque DBGG grande."
            trend={juros_pct && juros_pct > 7 ? "ruim" : "neutra"}
          />
          <IndicadorBox
            titulo="Juros / Receita"
            valor={juros_pct_rec}
            unidade="%"
            formula="Juros nominais 12m ÷ Receita líquida 12m"
            narrativa="Métrica Dalio. Quanto da receita evapora em juros antes de qualquer serviço público. Acima de 30% é zona de alerta. Brasil hoje em BREAK (>40%)."
            trend={juros_pct_rec && juros_pct_rec > 30 ? "ruim" : "neutra"}
          />
          <IndicadorBox
            titulo="NFSP setor público"
            valor={nfsp_pct}
            unidade="%"
            fonte="BCB SGS 5727"
            narrativa="Necessidade de financiamento do setor público consolidado (União + estados + municípios + estatais). Soma primário + juros 12m."
            siglas={[
              { sigla: "NFSP", expansao: "Necessidade de Financiamento do Setor Público" },
              { sigla: "SP", expansao: "Setor Público consolidado" },
            ]}
          />
          <IndicadorBox
            titulo="Previdência"
            valor={previdencia_pct}
            unidade="%"
            fonte="Tesouro RTN linha 40"
            narrativa="Benefícios previdenciários do RGPS. Maior linha do orçamento federal — mais que pessoal + discricionárias somados."
            siglas={[
              { sigla: "RGPS", expansao: "Regime Geral de Previdência Social (INSS)" },
            ]}
          />
          <IndicadorBox
            titulo="Pessoal"
            valor={pessoal_pct_kpi}
            unidade="%"
            fonte="Tesouro RTN linha 41"
            narrativa="Folha de pagamento da União (ativos + inativos + pensionistas civis e militares)."
          />
        </div>
      </Section>

      {/* === RECEITA DECOMPOSTA POR TRIBUTO === */}
      {serieReceitaPorTributo.labels.length > 0 && (
        <Section
          titulo="Decomposição da receita do gov central por tributo (% PIB, 12m)"
          hint="Onde vem a receita: tributos administrados pela RFB, contribuição RGPS, receitas não-administradas (dividendos, concessões). Fonte: Tesouro Nacional/RTN, tabela 1.1, linhas 8-24."
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieReceitaPorTributo.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {serieReceitaPorTributo.labels.map((lbl, i) => (
                  <Area key={lbl} type="monotone" dataKey={lbl} stackId="1"
                    stroke={CORES_SERIES[i % CORES_SERIES.length]} fill={CORES_SERIES[i % CORES_SERIES.length]} fillOpacity={0.55} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      <Section
        titulo={`Decomposição da despesa primária (${base === "pib" ? "% PIB" : "% Receita"})`}
        hint="Empilhamento das principais rubricas obrigatórias e discricionárias do gov central. Fonte: Tesouro Nacional/RTN, tabela 1.1."
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serieDecomp.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {serieDecomp.labels.map((lbl, i) => (
                <Area
                  key={lbl}
                  type="monotone"
                  dataKey={lbl}
                  stackId="1"
                  stroke={CORES_SERIES[i % CORES_SERIES.length]}
                  fill={CORES_SERIES[i % CORES_SERIES.length]}
                  fillOpacity={0.45}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-600">
          <span><strong>Previdência:</strong> {fmtPct(previdencia_pct)} PIB</span>
          <span><strong>Pessoal:</strong> {fmtPct(pessoal_pct_kpi)} PIB</span>
          {bpc_pct != null && <span><strong>BPC/LOAS:</strong> {fmtPct(bpc_pct)} PIB</span>}
          {abono_pct != null && <span><strong>Abono+seguro:</strong> {fmtPct(abono_pct)} PIB</span>}
        </div>
      </Section>

      <p className="text-xs text-zinc-500">
        Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}. Pipeline diário 9h BRT.
      </p>
    </div>
  );
}
