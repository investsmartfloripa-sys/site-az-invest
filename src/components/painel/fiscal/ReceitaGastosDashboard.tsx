"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { FiscalClassicosData, PontoMensalPct, PontoMensal, PontoMensal12m } from "@/lib/painel-fiscal";
import { CardHeader, Section } from "./FiscalShell";

// ============ HELPERS ============
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
function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)} tri`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)} bi`;
  return `R$ ${v.toFixed(0)} mi`;
}
function fmtPP(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)} pp`;
}
function ultPct(s: PontoMensalPct[] | null | undefined): number | null {
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) if (s[i].valor_pct != null) return s[i].valor_pct;
  return null;
}
function ultBRL12m(s: PontoMensal12m[] | null | undefined): number | null {
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) if (s[i].valor_12m != null) return s[i].valor_12m;
  return null;
}
function ult12mAgo(s: PontoMensal12m[] | null | undefined): number | null {
  if (!s || s.length < 13) return null;
  for (let i = s.length - 13; i >= 0; i--) if (s[i].valor_12m != null) return s[i].valor_12m;
  return null;
}
function ultMensal(s: PontoMensal[] | null | undefined): number | null {
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) if (s[i].valor != null) return s[i].valor;
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

// ============ CONSTANTS ============
// 10 anos full por default (sem toggle no header — visual cleanup)
const N_MESES = 120;

// Cores por família de tributo (3 famílias OFG/STN)
const COR_ADMINISTRADAS = "#1e3a8a"; // azul-marinho institucional
const COR_RGPS = "#9467bd"; // roxo
const COR_NAOADM = "#17becf"; // teal

// 11 tributos agrupados em famílias
type TributoCfg = {
  id: string;
  key: keyof FiscalClassicosData["receita_e_gastos"];
  lbl: string;
  familia: "Administradas RFB" | "RGPS" | "Não-administradas";
  cor: string; // sombra dentro da família
};
const TRIBUTOS: TributoCfg[] = [
  { id: "ir", key: "imposto_renda_12m_pct_pib", lbl: "Imposto de Renda", familia: "Administradas RFB", cor: "#1e3a8a" },
  { id: "cofins", key: "cofins_12m_pct_pib", lbl: "Cofins", familia: "Administradas RFB", cor: "#2050b3" },
  { id: "csll", key: "csll_12m_pct_pib", lbl: "CSLL", familia: "Administradas RFB", cor: "#3667cc" },
  { id: "pis", key: "pis_pasep_12m_pct_pib", lbl: "PIS/Pasep", familia: "Administradas RFB", cor: "#5c8ce0" },
  { id: "ipi", key: "ipi_12m_pct_pib", lbl: "IPI", familia: "Administradas RFB", cor: "#79a4e8" },
  { id: "iof", key: "iof_12m_pct_pib", lbl: "IOF", familia: "Administradas RFB", cor: "#94baf0" },
  { id: "ii", key: "imposto_importacao_12m_pct_pib", lbl: "Imp. Importação", familia: "Administradas RFB", cor: "#b0cef3" },
  { id: "cide", key: "cide_12m_pct_pib", lbl: "CIDE", familia: "Administradas RFB", cor: "#c9def7" },
  { id: "rgps", key: "rgps_arrecadacao_12m_pct_pib", lbl: "RGPS (INSS)", familia: "RGPS", cor: "#9467bd" },
  { id: "dividendos", key: "dividendos_12m_pct_pib", lbl: "Dividendos+Concessões", familia: "Não-administradas", cor: "#17becf" },
  { id: "recursos_nat", key: "recursos_naturais_12m_pct_pib", lbl: "Recursos naturais", familia: "Não-administradas", cor: "#5cd1de" },
];

// 7 rubricas de despesa
type RubricaCfg = {
  id: string;
  key: keyof FiscalClassicosData["receita_e_gastos"];
  lbl: string;
  cor: string;
};
const RUBRICAS: RubricaCfg[] = [
  { id: "previdencia", key: "previdencia_12m_pct_pib", lbl: "Previdência (RGPS)", cor: "#9467bd" },
  { id: "pessoal", key: "pessoal_12m_pct_pib", lbl: "Pessoal", cor: "#1e3a8a" },
  { id: "bpc", key: "bpc_loas_12m_pct_pib", lbl: "BPC/LOAS", cor: "#7e57c2" },
  { id: "abono", key: "abono_seguro_12m_pct_pib", lbl: "Abono+Seguro-Desemprego", cor: "#5c8ce0" },
  { id: "fundeb", key: "fundeb_12m_pct_pib", lbl: "FUNDEB complemento", cor: "#3a7ed4" },
  { id: "subsidios", key: "subsidios_12m_pct_pib", lbl: "Subsídios", cor: "#17becf" },
  { id: "discric", key: "discricionarias_12m_pct_pib", lbl: "Discricionárias", cor: "#5cd1de" },
];

// Regimes históricos para ReferenceArea
const REGIMES = [
  { x1: "2015-01", x2: "2016-08", label: "Recessão 2015-16", fill: "#fecaca" },
  { x1: "2017-01", x2: "2022-12", label: "Teto de gastos", fill: "#dbeafe" },
  { x1: "2020-03", x2: "2020-12", label: "Pandemia", fill: "#fed7aa" },
  { x1: "2023-01", x2: "2026-12", label: "Arcabouço", fill: "#dcfce7" },
];

// ============ COMPONENTES UTILITARIOS ============
function ChipFamilia({ familia, cor }: { familia: string; cor: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{ background: `${cor}1a`, color: cor, border: `1px solid ${cor}40` }}
    >
      {familia}
    </span>
  );
}

function CardKpiCompacto({
  label,
  valor,
  unidade = "%",
  fonte,
  destaque,
}: {
  label: string;
  valor: number | null;
  unidade?: string;
  fonte?: string;
  destaque?: "verde" | "vermelho" | "amarelo";
}) {
  const bg =
    destaque === "verde" ? "border-emerald-300 bg-emerald-50" :
    destaque === "vermelho" ? "border-rose-300 bg-rose-50" :
    destaque === "amarelo" ? "border-amber-300 bg-amber-50" :
    "border-zinc-200 bg-white";
  const txt =
    destaque === "verde" ? "text-emerald-900" :
    destaque === "vermelho" ? "text-rose-900" :
    destaque === "amarelo" ? "text-amber-900" :
    "text-zinc-900";
  return (
    <div className={`rounded-xl border-2 ${bg} p-3`}>
      <div className={`text-[10px] font-bold uppercase tracking-wide ${txt} opacity-80`}>{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${txt}`}>
        {valor != null ? `${valor.toFixed(2)}${unidade}` : "—"}
      </div>
      {fonte && <div className="mt-0.5 text-[9.5px] text-zinc-500">{fonte}</div>}
    </div>
  );
}

// ============ CARD META FISCAL LDO ============
function anoAtual(): string { return String(new Date().getFullYear()); }

function CardMetaLDO({ data, primarioAtual }: { data: FiscalClassicosData; primarioAtual: number | null }) {
  const ano = anoAtual();
  const meta = data.metas_ldo?.anos?.[ano];
  if (!meta || primarioAtual == null) {
    return <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">Meta LDO {ano}: não disponível.</div>;
  }
  const dentro = primarioAtual >= meta.banda_inf && primarioAtual <= meta.banda_sup;
  const acima = primarioAtual > meta.banda_sup;
  const statusBg = dentro ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50";
  const statusTxt = dentro ? "text-emerald-900" : "text-rose-900";
  const statusLabel = dentro ? "DENTRO DA BANDA" : acima ? "ACIMA DO TETO" : "ABAIXO DO PISO";

  return (
    <div className={`rounded-2xl border-2 ${statusBg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wide ${statusTxt}`}>Meta primária LDO {ano}</h3>
          <p className="mt-1 text-[10.5px] text-zinc-700">Convenção: positivo = superávit, em % PIB. Banda ±0,25pp (LC 200/2023).</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBg} ${statusTxt}`}>{statusLabel}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <div className="rounded bg-white/70 p-2">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Centro</div>
          <div className="text-base font-bold text-zinc-700">{fmtPct(meta.centro, 2)}</div>
        </div>
        <div className="rounded bg-white/70 p-2">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Banda</div>
          <div className="text-base font-bold text-zinc-700">{fmtPct(meta.banda_inf, 2)} a {fmtPct(meta.banda_sup, 2)}</div>
        </div>
        <div className="rounded bg-white/70 p-2">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Realizado 12m</div>
          <div className={`text-base font-bold ${statusTxt}`}>{fmtPct(primarioAtual, 2)}</div>
        </div>
        <div className="rounded bg-white/70 p-2">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Gap vs centro</div>
          <div className={`text-base font-bold ${statusTxt}`}>{fmtPP(primarioAtual - meta.centro)}</div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN ============
export function ReceitaGastosDashboard({ data }: { data: FiscalClassicosData }) {
  const rg = data.receita_e_gastos;
  const getSerie = (key: keyof FiscalClassicosData["receita_e_gastos"]): PontoMensalPct[] => {
    const v = (rg as unknown as Record<string, unknown>)[key as string];
    return (Array.isArray(v) ? v : []) as PontoMensalPct[];
  };

  // === KPIs raw ===
  const receita_pct = ultPct(rg.receita_liquida_pct_pib);
  const despesa_pct = ultPct(rg.despesa_total_pct_pib);
  const primario_pct = ultPct(rg.primario_central_pct_pib);
  const juros_pct = ultPct(rg.juros_central_pct_pib);
  const juros_pct_rec = ultPct(rg.juros_pct_receita);
  // nfsp pct exibido apenas no gráfico do bloco 4

  // === Crescimento real receita/despesa 12m (deflacionado por IPCA YoY) ===
  const ipca_yoy = ultMensal(data.monetaria.ipca_12m_pct);
  const rec12m = ultBRL12m(rg.receita_liquida_12m_brl_mm);
  const rec12mAgo = ult12mAgo(rg.receita_liquida_12m_brl_mm);
  const des12m = ultBRL12m(rg.despesa_total_12m_brl_mm);
  const des12mAgo = ult12mAgo(rg.despesa_total_12m_brl_mm);
  const cresc_real_receita = (rec12m && rec12mAgo && ipca_yoy != null)
    ? ((1 + (rec12m / rec12mAgo - 1)) / (1 + ipca_yoy / 100) - 1) * 100 : null;
  const cresc_real_despesa = (des12m && des12mAgo && ipca_yoy != null)
    ? ((1 + (des12m / des12mAgo - 1)) / (1 + ipca_yoy / 100) - 1) * 100 : null;
  // Limite arcabouço = 70% do cresc real receita do ano anterior, com piso 0,6 e teto 2,5
  const limite_arcabouco = cresc_real_receita != null
    ? Math.min(2.5, Math.max(0.6, cresc_real_receita * 0.70)) : null;

  // === Gap Blanchard (primário estabilizador) ===
  const dbgg_pct = (() => {
    const s = data.divida?.dbgg_pct_pib;
    if (!s) return null;
    for (let i = s.length - 1; i >= 0; i--) if (s[i].valor != null) return s[i].valor;
    return null;
  })();
  const pib_real_recent = (() => {
    const s = data.monetaria.pib_real_yoy_pct;
    if (!s) return null;
    for (let i = s.length - 1; i >= 0; i--) if (s[i].valor_yoy_pct != null) return s[i].valor_yoy_pct;
    return null;
  })();
  // Custo médio implícito = juros 12m / DBGG → reaproveita juros/PIB ÷ DBGG/PIB
  const custo_medio_dbgg = (juros_pct != null && dbgg_pct != null && dbgg_pct > 0)
    ? (juros_pct / dbgg_pct) * 100 : null;
  const r_real = (custo_medio_dbgg != null && ipca_yoy != null) ? custo_medio_dbgg - ipca_yoy : null;
  const g_real = pib_real_recent;
  const r_menos_g = (r_real != null && g_real != null) ? r_real - g_real : null;
  const primario_estabilizador = (r_menos_g != null && dbgg_pct != null) ? (r_menos_g / 100) * dbgg_pct : null;
  const gap_blanchard = (primario_pct != null && primario_estabilizador != null)
    ? primario_pct - primario_estabilizador : null;

  // === SÉRIES TEMPORAIS (10 anos) ===

  // B1 — Receita × Despesa
  const serieRecDes = useMemo(() => mergePct(
    [tail(rg.receita_liquida_pct_pib, N_MESES), tail(rg.despesa_total_pct_pib, N_MESES)],
    ["receita", "despesa"],
  ), [rg]);

  // B1 — Primário com banda LDO
  const seriePrimario = useMemo(() => mergePct(
    [tail(rg.primario_central_pct_pib, N_MESES)],
    ["primario"],
  ), [rg]);

  // B2 — Receita por tributo (estado: quais tributos visíveis no stacked, default = TODOS)
  const [tributosAtivos, setTributosAtivos] = useState<Set<string>>(() => new Set(TRIBUTOS.map((t) => t.id)));
  const toggleTributo = (id: string) => {
    const novo = new Set(tributosAtivos);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setTributosAtivos(novo);
  };
  const serieTributosStacked = useMemo(() => {
    const ativos = TRIBUTOS.filter((t) => tributosAtivos.has(t.id));
    return mergePct(ativos.map((t) => tail(getSerie(t.key), N_MESES)), ativos.map((t) => t.lbl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tributosAtivos, rg]);
  const tabelaTributos = useMemo(() => {
    const totalUlt = TRIBUTOS.reduce((acc, t) => acc + (ultPct(getSerie(t.key)) ?? 0), 0);
    return TRIBUTOS.map((t) => {
      const serie = getSerie(t.key);
      const ult = ultPct(serie);
      const yoyAgo = serie.length >= 13 ? serie[serie.length - 13]?.valor_pct ?? null : null;
      const delta = ult != null && yoyAgo != null ? ult - yoyAgo : null;
      const pibNominal = data.pib_nominal_12m_brl_milhoes;
      const brl_bi = ult != null && pibNominal ? (ult / 100) * pibNominal / 1000 : null;
      const pctTotal = ult != null && totalUlt > 0 ? (ult / totalUlt) * 100 : null;
      return { ...t, valor: ult, brl_bi, delta_yoy: delta, pct_total: pctTotal };
    }).sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rg, data.pib_nominal_12m_brl_milhoes]);

  // B3 — Despesa por rubrica
  const [rubricasAtivas, setRubricasAtivas] = useState<Set<string>>(() => new Set(RUBRICAS.map((r) => r.id)));
  const toggleRubrica = (id: string) => {
    const novo = new Set(rubricasAtivas);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setRubricasAtivas(novo);
  };
  const serieRubricasStacked = useMemo(() => {
    const ativas = RUBRICAS.filter((r) => rubricasAtivas.has(r.id));
    return mergePct(ativas.map((r) => tail(getSerie(r.key), N_MESES)), ativas.map((r) => r.lbl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubricasAtivas, rg]);
  const tabelaRubricas = useMemo(() => {
    const totalUlt = RUBRICAS.reduce((acc, r) => acc + (ultPct(getSerie(r.key)) ?? 0), 0);
    return RUBRICAS.map((r) => {
      const serie = getSerie(r.key);
      const ult = ultPct(serie);
      const yoyAgo = serie.length >= 13 ? serie[serie.length - 13]?.valor_pct ?? null : null;
      const delta = ult != null && yoyAgo != null ? ult - yoyAgo : null;
      const pibNominal = data.pib_nominal_12m_brl_milhoes;
      const brl_bi = ult != null && pibNominal ? (ult / 100) * pibNominal / 1000 : null;
      const pctTotal = ult != null && totalUlt > 0 ? (ult / totalUlt) * 100 : null;
      return { ...r, valor: ult, brl_bi, delta_yoy: delta, pct_total: pctTotal };
    }).sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rg, data.pib_nominal_12m_brl_milhoes]);

  // B4 — Juros + NFSP
  const serieJurosNfsp = useMemo(() => mergePct(
    [
      tail(rg.juros_central_pct_pib, N_MESES),
      tail(rg.nfsp_sp_12m_pct_pib.map((p) => ({ data: p.data, valor_pct: p.valor })), N_MESES),
    ],
    ["juros_central", "nfsp"],
  ), [rg]);

  const carga_juros_despesa = (juros_pct != null && despesa_pct != null && despesa_pct > 0)
    ? (juros_pct / despesa_pct) * 100 : null;

  // B5 — Contexto Dalio: carga tributária consolidada (estimativa estática RFB 2023)
  const CT_BRASIL_2023 = 32.4; // RFB, carga tributária bruta consolidada
  const CT_OCDE_MEDIANA = 33.5;
  const CT_LATAM_MEDIANA = 21.7;

  return (
    <div className="space-y-8">
      <CardHeader
        titulo="Receita e gastos do governo central"
        subtitulo="Fluxo fiscal: tesoura Receita × Despesa, decomposição por tributo (3 famílias OFG/STN), por rubrica de despesa e serviço da dívida. Fonte: Tesouro Nacional/RTN, BCB SGS, IBGE."
      />

      {/* ===================== BLOCO 1 — RESULTADO PRIMÁRIO ===================== */}
      <section className="space-y-4 border-l-4 border-[#132960] pl-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#132960]/60">01 · Resultado primário</p>
          <h2 className="text-lg font-bold text-[#132960]">A tesoura receita × despesa e o primário do governo central</h2>
          <p className="mt-1 text-xs text-zinc-600">
            A diferença entre receita líquida e despesa total define o resultado primário (positivo = superávit, negativo = déficit). O <strong>gap Blanchard</strong>
            mede quão longe o realizado está do <strong>primário estabilizador</strong> (que mantém DBGG constante dado r−g). Banda verde = meta LDO ±0,25pp.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CardKpiCompacto label="Receita líquida" valor={receita_pct} fonte="RTN L.38" destaque="verde" />
          <CardKpiCompacto label="Despesa total" valor={despesa_pct} fonte="RTN L.39" />
          <CardKpiCompacto label="Primário central" valor={primario_pct}
            destaque={primario_pct != null && primario_pct >= 0 ? "verde" : "vermelho"} fonte="Calc. RTN" />
          <CardKpiCompacto label="Gap Blanchard"
            valor={gap_blanchard} unidade=" pp"
            destaque={gap_blanchard != null && gap_blanchard < -1 ? "vermelho" : gap_blanchard != null && gap_blanchard > 0 ? "verde" : "amarelo"}
            fonte={`Realizado − Estabilizador ${primario_estabilizador != null ? fmtPct(primario_estabilizador, 2) : "—"}`}
          />
        </div>

        <CardMetaLDO data={data} primarioAtual={primario_pct} />

        {/* Gráfico Receita × Despesa */}
        <Section titulo="Receita líquida × Despesa total / PIB (12m)" hint="A área entre as linhas é o resultado primário. Sombras: regimes fiscais (Recessão 15-16, Teto 17-22, Pandemia 20, Arcabouço 23+).">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieRecDes} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {REGIMES.map((r) => (
                  <ReferenceArea key={r.label} x1={r.x1} x2={r.x2} fill={r.fill} fillOpacity={0.25} label={{ value: r.label, fontSize: 9, fill: "#6b7280", position: "insideTopRight" }} />
                ))}
                <Line type="monotone" dataKey="receita" name="Receita líquida" stroke="#16a34a" strokeWidth={2.75} dot={false} />
                <Line type="monotone" dataKey="despesa" name="Despesa total" stroke="#1e3a8a" strokeWidth={2.75} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Gráfico Primário com banda LDO */}
        <Section titulo="Primário do governo central (% PIB, 12m) — banda LDO e referências" hint="Linha azul: primário realizado. Banda verde: zona da meta LDO atual (±0,25pp). Linha tracejada cinza: primário estabilizador (Blanchard).">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriePrimario} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[-3, 3]} />
                <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                <ReferenceLine y={0} stroke="#475569" />
                {data.metas_ldo?.anos?.[anoAtual()] && (
                  <ReferenceArea
                    y1={data.metas_ldo.anos[anoAtual()].banda_inf}
                    y2={data.metas_ldo.anos[anoAtual()].banda_sup}
                    fill="#16a34a"
                    fillOpacity={0.12}
                    label={{ value: `Meta LDO ${anoAtual()}`, fontSize: 10, fill: "#15803d", position: "insideTopLeft" }}
                  />
                )}
                {primario_estabilizador != null && (
                  <ReferenceLine
                    y={primario_estabilizador}
                    stroke="#71717a"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: `Estabilizador Blanchard ${fmtPct(primario_estabilizador, 2)}`, fontSize: 10, fill: "#52525b", position: "insideTopRight" }}
                  />
                )}
                <Line type="monotone" dataKey="primario" name="Primário 12m" stroke="#1e3a8a" strokeWidth={2.75} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            <strong>Primário estabilizador</strong> (Blanchard 1990) = (r − g) × DBGG/PIB, onde r = custo médio implícito da dívida e g = PIB real YoY.
            Hoje: r ≈ {fmtPct(r_real, 2)} · g ≈ {fmtPct(g_real, 2)} · DBGG = {fmtPct(dbgg_pct, 1)} PIB → primário p/ estabilizar ≈ {fmtPct(primario_estabilizador, 2)} PIB.
          </p>
        </Section>
      </section>

      {/* ===================== BLOCO 2 — RECEITA POR TRIBUTO ===================== */}
      <section className="space-y-4 border-l-4 border-emerald-500 pl-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">02 · Receita por tributo</p>
          <h2 className="text-lg font-bold text-[#132960]">11 tributos do governo central agrupados em 3 famílias</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Classificação STN/OFG. Clique nos cards para adicionar/remover do gráfico empilhado. A tabela mostra valores legíveis para todos os 11 tributos.
          </p>
        </div>

        {/* Cards-toggle agrupados por família, 2 fileiras compactas */}
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ChipFamilia familia="Administradas RFB" cor={COR_ADMINISTRADAS} />
              <span className="text-[10.5px] text-zinc-500">Tributos administrados pela Receita Federal — sujeitos à ciclicidade econômica e arrecadação.</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 md:grid-cols-8">
              {TRIBUTOS.filter((t) => t.familia === "Administradas RFB").map((t) => {
                const ativo = tributosAtivos.has(t.id);
                const valor = ultPct(getSerie(t.key));
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTributo(t.id)}
                    className={`rounded p-1.5 text-left text-[10.5px] transition ${
                      ativo ? "border-2 shadow-sm" : "border-2 border-dashed border-zinc-300 bg-white hover:border-solid"
                    }`}
                    style={ativo ? { borderColor: t.cor, background: `${t.cor}1a` } : {}}
                    title={t.lbl}
                  >
                    <div className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm flex-shrink-0" style={{ background: ativo ? t.cor : "transparent", border: `1.5px solid ${t.cor}` }} />
                      <span className="truncate font-bold text-zinc-700">{t.lbl}</span>
                    </div>
                    <div className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{fmtPct(valor, 2)}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <ChipFamilia familia="RGPS" cor={COR_RGPS} />
                <span className="text-[10.5px] text-zinc-500">Contribuição previdenciária (INSS).</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {TRIBUTOS.filter((t) => t.familia === "RGPS").map((t) => {
                  const ativo = tributosAtivos.has(t.id);
                  const valor = ultPct(getSerie(t.key));
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTributo(t.id)}
                      className={`rounded p-1.5 text-left text-[10.5px] transition ${
                        ativo ? "border-2 shadow-sm" : "border-2 border-dashed border-zinc-300 bg-white hover:border-solid"
                      }`}
                      style={ativo ? { borderColor: t.cor, background: `${t.cor}1a` } : {}}
                    >
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm flex-shrink-0" style={{ background: ativo ? t.cor : "transparent", border: `1.5px solid ${t.cor}` }} />
                        <span className="truncate font-bold text-zinc-700">{t.lbl}</span>
                      </div>
                      <div className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{fmtPct(valor, 2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <ChipFamilia familia="Não-administradas" cor={COR_NAOADM} />
                <span className="text-[10.5px] text-zinc-500">Dividendos de estatais, concessões e royalties de recursos naturais.</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {TRIBUTOS.filter((t) => t.familia === "Não-administradas").map((t) => {
                  const ativo = tributosAtivos.has(t.id);
                  const valor = ultPct(getSerie(t.key));
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTributo(t.id)}
                      className={`rounded p-1.5 text-left text-[10.5px] transition ${
                        ativo ? "border-2 shadow-sm" : "border-2 border-dashed border-zinc-300 bg-white hover:border-solid"
                      }`}
                      style={ativo ? { borderColor: t.cor, background: `${t.cor}1a` } : {}}
                    >
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm flex-shrink-0" style={{ background: ativo ? t.cor : "transparent", border: `1.5px solid ${t.cor}` }} />
                        <span className="truncate font-bold text-zinc-700">{t.lbl}</span>
                      </div>
                      <div className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{fmtPct(valor, 2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Stacked area */}
        <Section titulo="Composição da receita por tributo (% PIB, 12m) — stacked">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieTributosStacked} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {TRIBUTOS.filter((t) => tributosAtivos.has(t.id)).map((t) => (
                  <Area key={t.id} type="monotone" dataKey={t.lbl} stackId="1" stroke={t.cor} fill={t.cor} fillOpacity={0.7} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Tabela legível */}
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-[11.5px]">
            <thead className="bg-[#132960]/5">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-[#132960]">Tributo</th>
                <th className="px-3 py-2 text-left font-bold text-[#132960]">Família</th>
                <th className="px-3 py-2 text-right font-bold text-[#132960]">% PIB 12m</th>
                <th className="px-3 py-2 text-right font-bold text-[#132960]">R$ bi 12m</th>
                <th className="px-3 py-2 text-right font-bold text-[#132960]">Δ vs 12m atrás</th>
                <th className="px-3 py-2 text-right font-bold text-[#132960]">% do total</th>
              </tr>
            </thead>
            <tbody>
              {tabelaTributos.map((t) => (
                <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm mr-1.5 align-middle" style={{ background: t.cor }} />
                    <strong>{t.lbl}</strong>
                  </td>
                  <td className="px-3 py-1.5 text-zinc-600">{t.familia}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtPct(t.valor, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-700">{fmtBRL(t.brl_bi)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${t.delta_yoy != null && t.delta_yoy < 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmtPP(t.delta_yoy)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-700">{fmtPct(t.pct_total, 1)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-bold">
                <td className="px-3 py-2" colSpan={2}>TOTAL receita federal*</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(tabelaTributos.reduce((a, t) => a + (t.valor ?? 0), 0), 2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(tabelaTributos.reduce((a, t) => a + (t.brl_bi ?? 0), 0))}</td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2 text-right">100,0%</td>
              </tr>
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-[10px] text-zinc-500">* Receita primária bruta do gov central (somatório dos tributos administrados RFB + RGPS + não-administradas). Não inclui receitas de estados e municípios.</p>
        </div>
      </section>

      {/* ===================== BLOCO 3 — DESPESA POR RUBRICA ===================== */}
      <section className="space-y-4 border-l-4 border-violet-500 pl-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">03 · Despesa por rubrica</p>
          <h2 className="text-lg font-bold text-[#132960]">Onde a despesa primária está alocada</h2>
          <p className="mt-1 text-xs text-zinc-600">
            7 rubricas obrigatórias e discricionárias. Previdência domina (~9% PIB). Chip do arcabouço mostra crescimento real da despesa vs limite LC 200/2023.
          </p>
        </div>

        {/* Chip arcabouço */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <CardKpiCompacto label="Crescimento real receita 12m" valor={cresc_real_receita} fonte="Defl. IPCA YoY" destaque="verde" />
          <CardKpiCompacto label="Crescimento real despesa 12m" valor={cresc_real_despesa} fonte="Defl. IPCA YoY"
            destaque={cresc_real_despesa != null && limite_arcabouco != null && cresc_real_despesa > limite_arcabouco ? "vermelho" : "verde"} />
          <CardKpiCompacto label="Limite arcabouço (LC 200/23)" valor={limite_arcabouco} fonte="70% × cresc. real receita, piso 0,6% teto 2,5%" destaque="amarelo" />
        </div>

        {/* Cards-toggle rubricas */}
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-7">
          {RUBRICAS.map((r) => {
            const ativo = rubricasAtivas.has(r.id);
            const valor = ultPct(getSerie(r.key));
            return (
              <button
                key={r.id}
                onClick={() => toggleRubrica(r.id)}
                className={`rounded p-1.5 text-left text-[10.5px] transition ${
                  ativo ? "border-2 shadow-sm" : "border-2 border-dashed border-zinc-300 bg-white hover:border-solid"
                }`}
                style={ativo ? { borderColor: r.cor, background: `${r.cor}1a` } : {}}
              >
                <div className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm flex-shrink-0" style={{ background: ativo ? r.cor : "transparent", border: `1.5px solid ${r.cor}` }} />
                  <span className="truncate font-bold text-zinc-700">{r.lbl}</span>
                </div>
                <div className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{fmtPct(valor, 2)}</div>
              </button>
            );
          })}
        </div>

        {/* Stacked */}
        <Section titulo="Composição da despesa primária (% PIB, 12m) — stacked">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieRubricasStacked} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {RUBRICAS.filter((r) => rubricasAtivas.has(r.id)).map((r) => (
                  <Area key={r.id} type="monotone" dataKey={r.lbl} stackId="1" stroke={r.cor} fill={r.cor} fillOpacity={0.7} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Tabela despesa */}
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-[11.5px]">
            <thead className="bg-[#132960]/5">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-[#132960]">Rubrica</th>
                <th className="px-3 py-2 text-right font-bold text-[#132960]">% PIB 12m</th>
                <th className="px-3 py-2 text-right font-bold text-[#132960]">R$ bi 12m</th>
                <th className="px-3 py-2 text-right font-bold text-[#132960]">Δ vs 12m atrás</th>
                <th className="px-3 py-2 text-right font-bold text-[#132960]">% do total</th>
              </tr>
            </thead>
            <tbody>
              {tabelaRubricas.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm mr-1.5 align-middle" style={{ background: r.cor }} />
                    <strong>{r.lbl}</strong>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtPct(r.valor, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-700">{fmtBRL(r.brl_bi)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${r.delta_yoy != null && r.delta_yoy > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmtPP(r.delta_yoy)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-700">{fmtPct(r.pct_total, 1)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-bold">
                <td className="px-3 py-2">TOTAL despesa primária*</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(tabelaRubricas.reduce((a, r) => a + (r.valor ?? 0), 0), 2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(tabelaRubricas.reduce((a, r) => a + (r.brl_bi ?? 0), 0))}</td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2 text-right">100,0%</td>
              </tr>
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-[10px] text-zinc-500">* Somatório das rubricas obrigatórias e discricionárias do gov central. Pode diferir levemente da despesa total reportada (RTN L.39 = {fmtPct(despesa_pct, 2)} PIB) por arredondamentos.</p>
        </div>
      </section>

      {/* ===================== BLOCO 4 — JUROS & SERVIÇO DA DÍVIDA ===================== */}
      <section className="space-y-4 border-l-4 border-rose-500 pl-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700">04 · Juros e serviço da dívida</p>
          <h2 className="text-lg font-bold text-[#132960]">Custo do estoque DBGG e pressão sobre o orçamento</h2>
          <p className="mt-1 text-xs text-zinc-600">
            <strong>Debt Service / Income</strong> é a métrica central no framework Dalio (livro &quot;How Countries Go Broke&quot;, cap. The Mechanics). Acima de 30% de juros/receita = BREAK.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border-2 border-zinc-300 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-700">Juros nominais / PIB</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-[#132960]">{fmtPct(juros_pct, 2)}</div>
            <p className="mt-2 text-[10.5px] text-zinc-600">
              Despesa anual com juros da dívida federal. Custo médio implícito sobre DBGG ≈ {fmtPct(custo_medio_dbgg, 2)} a.a.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-rose-900">Juros / Receita líquida — BREAK Dalio</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-rose-900">{fmtPct(juros_pct_rec, 2)}</div>
            <p className="mt-2 text-[10.5px] text-rose-900">
              {juros_pct_rec != null && juros_pct_rec > 30
                ? `Acima de 30%, considerado BREAK no framework Dalio. Cada R$ 100 arrecadados, R$ ${juros_pct_rec.toFixed(0)} viram juros antes de qualquer serviço público.`
                : "Zona Dalio: <10% verde, 10-20% atenção, 20-30% crítico, >30% break."}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-900">Juros / Despesa total</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-amber-900">{fmtPct(carga_juros_despesa, 2)}</div>
            <p className="mt-2 text-[10.5px] text-amber-900">
              Juros já são a <strong>2ª maior linha do orçamento federal</strong>, atrás apenas da previdência ({fmtPct(ultPct(rg.previdencia_12m_pct_pib), 2)} PIB). Reduz drasticamente o espaço fiscal.
            </p>
          </div>
        </div>

        <Section titulo="Juros nominais central × NFSP setor público (% PIB, 12m)" hint="Juros nominais do gov central + Necessidade de Financiamento do Setor Público consolidado (BCB SGS 5727).">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieJurosNfsp} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="juros_central" name="Juros gov central / PIB" stroke="#1e3a8a" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="nfsp" name="NFSP setor público / PIB" stroke="#dc2626" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </section>

      {/* ===================== BLOCO 5 — CONTEXTO DALIO ===================== */}
      <section className="space-y-4 border-l-4 border-zinc-500 pl-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">05 · Contexto Dalio — Levers disponíveis</p>
          <h2 className="text-lg font-bold text-[#132960]">Espaço político para ajuste fiscal</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Os 4 Levers de Dalio (subir juros, subir inflação, cortar despesa, aumentar receita) operam dentro de restrições estruturais. Brasil tem 3 obstáculos críticos:
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-900">Lever 1 — aumentar receita</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-amber-900">CARGA TRIBUTÁRIA NO TETO</div>
            <p className="mt-2 text-[10.5px] text-amber-900">
              Brasil: <strong>{CT_BRASIL_2023}% PIB</strong> (RFB 2023) · OCDE mediana: {CT_OCDE_MEDIANA}% · LatAm mediana: {CT_LATAM_MEDIANA}%.
              Já no patamar OCDE, sem ser país desenvolvido. Espaço para subir é limitado politicamente.
            </p>
          </div>
          <div className="rounded-xl border-2 border-violet-200 bg-violet-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-violet-900">Lever 2 — cortar despesa</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-violet-900">NÚCLEO BLINDADO ~75%</div>
            <p className="mt-2 text-[10.5px] text-violet-900">
              Previdência ({fmtPct(ultPct(rg.previdencia_12m_pct_pib), 1)}) + Pessoal ({fmtPct(ultPct(rg.pessoal_12m_pct_pib), 1)}) + vinculações constitucionais (mínimos saúde/educação, FUNDEB) blindam ~75% da despesa primária. Sobra <strong>~25%</strong> ajustáveis politicamente.
            </p>
          </div>
          <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-rose-900">Receita rígida</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-rose-900">~90% VINCULADA</div>
            <p className="mt-2 text-[10.5px] text-rose-900">
              ~90% da receita federal tem destinação carimbada na CF (mínimos, FPE/FPM, RGPS, fundos constitucionais).
              Qualquer aumento de receita escorre automaticamente — não vira espaço fiscal livre.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-700">
          <strong className="text-[#132960]">Leitura Dalio combinada:</strong> com 3 das 4 Levers severamente restritas, o ajuste fiscal brasileiro requer reforma estrutural (PEC) e não política orçamentária ordinária. A literatura histórica do livro mostra que países com esse perfil tendem a recorrer ao Lever 3 (inflação/monetização) quando o estresse fiscal supera o limite político — ver Termômetro Fiscal e simulador de trajetória para cenários.
        </div>
      </section>

      <p className="text-xs text-zinc-500">
        Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}. Pipeline diário 9h BRT.
        Fontes: Tesouro Nacional/RTN tabela 1.1, BCB SGS (5727 NFSP, 13522 IPCA, 13762 DBGG), IBGE PIB.
      </p>
    </div>
  );
}
