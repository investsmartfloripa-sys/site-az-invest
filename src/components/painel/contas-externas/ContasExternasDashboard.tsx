"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  ContasExternasData,
  ContasExternasComexData,
  CategoriaPonto,
  NcmPonto,
  PaisPonto,
  SecaoSeriePonto,
} from "@/lib/painel-contas-externas";

// ---------------------------------------------------------------------------
// Paleta (alinhada ao site)
// ---------------------------------------------------------------------------
const COR_PRIMARIA = "#132960";
const COR_ACENTO = "#027DFC";
const COR_POSITIVO = "#16a34a";
const COR_NEGATIVO = "#dc2626";

const PALETA = [
  "#027DFC", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6",
  "#0891b2", "#84cc16", "#ec4899", "#f97316", "#6366f1",
  "#a16207", "#475569", "#71717a",
];

// ---------------------------------------------------------------------------
// Mapeamento de nomes longos do SH pra labels curtos
// ---------------------------------------------------------------------------
const SECAO_CURTO: Record<string, string> = {
  "Produtos minerais": "Minerais (petróleo, ferro)",
  "Produtos do reino vegetal": "Vegetais (soja, café, grãos)",
  "Animais vivos e produtos do reino animal": "Animais (carne, leite)",
  "Produtos das indústrias alimentares; Bebidas, líquidos alcoólicos e vinagres; Tabaco e seus sucedâneos manufaturados": "Alimentos processados (açúcar, fumo)",
  "Produtos das indútrias alimentares; Bebidas, líquidos alcoólicos e vinagres; Tabaco e seus sucedâneos manufaturados": "Alimentos processados",
  "Material de transporte": "Transporte (veículos, aviões)",
  "Máquinas e aparelhos, material elétrico e suas partes; Aparelhos de gravação ou reprodução de som, aparelhos de gravação ou reprodução de imagens e de som em televisão, e suas partes e acessórios": "Máquinas e eletrônicos",
  "Produtos das indústrias químicas ou indústrias conexas": "Químicos (fertilizantes, remédios)",
  "Metais comuns e suas obras": "Metais comuns (aço, cobre)",
  "Plásticos e suas obras; Borracha e suas obras": "Plásticos e borrachas",
  "Outros": "Outros",
};

function secaoLabel(s: string): string {
  return SECAO_CURTO[s] ?? s.length > 35 ? s.slice(0, 32) + "…" : s;
}

// ---------------------------------------------------------------------------
// Formatadores
// ---------------------------------------------------------------------------
const fmtBR = (n: number | null | undefined, casas = 1): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
};

const fmtMes = (yyyymmdd: string): string => {
  if (!yyyymmdd || yyyymmdd.length < 7) return yyyymmdd;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(5, 7);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mi = parseInt(m, 10) - 1;
  return `${meses[mi] ?? m}/${y.slice(2)}`;
};

const fmtDataBR = (yyyymmdd: string | null): string => {
  if (!yyyymmdd) return "—";
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}/${m}/${y}`;
};

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KPI({
  label,
  value,
  unit,
  trend = "neutro",
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: "verde" | "vermelho" | "amarelo" | "neutro";
  hint?: string;
}) {
  const corValor =
    trend === "verde" ? COR_POSITIVO :
    trend === "vermelho" ? COR_NEGATIVO :
    trend === "amarelo" ? "#d97706" :
    COR_PRIMARIA;
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums" style={{ color: corValor }}>
          {value}
        </span>
        {unit && <span className="text-xs text-zinc-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] text-zinc-400">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartCard
// ---------------------------------------------------------------------------
function ChartCard({
  title,
  subtitle,
  footer,
  height = 300,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-[#132960]">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div className="w-full" style={{ height }}>{children}</div>
      {footer && <div className="mt-3 text-[11px] text-zinc-400">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente horizontal-bar: ranking de categorias / produtos / países
// ---------------------------------------------------------------------------
function HorizontalRankingBar({
  data,
  valueKey,
  labelKey,
  cor,
  formatTooltip,
}: {
  data: Array<Record<string, number | string>>;
  valueKey: string;
  labelKey: string;
  cor: string;
  formatTooltip: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 30, left: 0, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey={labelKey}
          tick={{ fontSize: 10 }}
          width={140}
          interval={0}
        />
        <Tooltip
          formatter={(v: any) => [formatTooltip(v), "Valor"]}
          labelFormatter={(l: any) => String(l)}
          cursor={{ fill: "rgba(2,125,252,0.05)" }}
        />
        <Bar dataKey={valueKey} fill={cor} radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={cor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function ContasExternasDashboard({
  data,
  comex,
}: {
  data: ContasExternasData;
  comex: ContasExternasComexData | null;
}) {
  const { hero, bloco_a, bloco_b, bloco_c, ultima_referencia_mensal, ultima_referencia_diaria } = data;

  // ---- Trends de cor ----
  const trendTc = useMemo<"verde" | "amarelo" | "vermelho">(() => {
    const v = hero.saldo_tc_pct_pib.valor ?? 0;
    if (v >= -2 && v <= 2) return "verde";
    if (v >= -4) return "amarelo";
    return "vermelho";
  }, [hero.saldo_tc_pct_pib.valor]);

  const trendIdp = useMemo<"verde" | "amarelo" | "vermelho">(() => {
    const tc = hero.saldo_tc_pct_pib.valor ?? 0;
    const idp = hero.idp_pct_pib.valor ?? 0;
    if (tc >= 0) return "verde";
    const cobertura = idp / Math.abs(tc);
    if (cobertura >= 1) return "verde";
    if (cobertura >= 0.7) return "amarelo";
    return "vermelho";
  }, [hero.saldo_tc_pct_pib.valor, hero.idp_pct_pib.valor]);

  const trendMeses = useMemo<"verde" | "amarelo" | "vermelho">(() => {
    const m = hero.meses_importacao.valor ?? 0;
    if (m >= 6) return "verde";
    if (m >= 3) return "amarelo";
    return "vermelho";
  }, [hero.meses_importacao.valor]);

  // ---- Bloco A1: Saldo TC anual (com sinal por cor) ----
  const saldoAnual = useMemo(() => bloco_a.saldo_anual.map(p => ({
    ano: p.ano,
    saldo_pct_pib: p.saldo_pct_pib,
  })), [bloco_a.saldo_anual]);

  // ---- Bloco A2: decomposição 24m em US$ bi ----
  const decomp24m = useMemo(() => bloco_a.decomposicao_mensal_36m.slice(-24).map(p => ({
    mes: p.mes,
    bens: p.bens != null ? p.bens / 1000 : null,
    servicos: p.servicos != null ? p.servicos / 1000 : null,
    renda_primaria: p.renda_primaria != null ? p.renda_primaria / 1000 : null,
    renda_secundaria: p.renda_secundaria != null ? p.renda_secundaria / 1000 : null,
    saldo_total: p.saldo_total != null ? p.saldo_total / 1000 : null,
  })), [bloco_a.decomposicao_mensal_36m]);

  // ---- Bloco A3: balança comercial 24m ----
  const balanca24m = useMemo(() => bloco_a.balanca_comercial_36m.slice(-24).map(p => ({
    mes: p.mes,
    exportacoes: p.exportacoes != null ? p.exportacoes / 1000 : null,
    importacoes: p.importacoes != null ? p.importacoes / 1000 : null,
    saldo: p.saldo != null ? p.saldo / 1000 : null,
  })), [bloco_a.balanca_comercial_36m]);

  // ---- Bloco B1: IDP vs TC ----
  const idpVsTc = bloco_b.idp_vs_tc_pct_pib;

  // ---- Bloco B2: IDP decomposição ----
  const idpDecomp24m = useMemo(() => bloco_b.idp_decomposicao_36m.slice(-24).map(p => ({
    mes: p.mes,
    participacao: p.participacao != null ? p.participacao / 1000 : null,
    reinvestimento: p.reinvestimento != null ? p.reinvestimento / 1000 : null,
    intercompanhia: p.intercompanhia != null ? p.intercompanhia / 1000 : null,
    total: p.total != null ? p.total / 1000 : null,
  })), [bloco_b.idp_decomposicao_36m]);

  // ---- Bloco C1: reservas (downsample) ----
  const reservasSerie = useMemo(() => {
    const todas = bloco_c.reservas_diaria;
    if (todas.length <= 600) return todas;
    const step = Math.max(1, Math.floor(todas.length / 600));
    return todas.filter((_, i) => i % step === 0 || i === todas.length - 1);
  }, [bloco_c.reservas_diaria]);

  // ---- Bloco D (Comex) ----
  const catExp = useMemo<CategoriaPonto[]>(
    () => (comex?.categorias_export_3m ?? []).slice().sort((a, b) => b.valor_us_bi - a.valor_us_bi),
    [comex],
  );
  const catImp = useMemo<CategoriaPonto[]>(
    () => (comex?.categorias_import_3m ?? []).slice().sort((a, b) => b.valor_us_bi - a.valor_us_bi),
    [comex],
  );
  const topNcmExp = useMemo<NcmPonto[]>(() => (comex?.top_ncm_export_3m ?? []).slice(0, 12), [comex]);
  const topNcmImp = useMemo<NcmPonto[]>(() => (comex?.top_ncm_import_3m ?? []).slice(0, 12), [comex]);
  const topDest = useMemo<PaisPonto[]>(() => (comex?.top_destinos_3m ?? []).slice(0, 10), [comex]);
  const topOrig = useMemo<PaisPonto[]>(() => (comex?.top_origens_3m ?? []).slice(0, 10), [comex]);

  // Séries por seção: renomeia chaves longas pra labels curtos
  const secaoExp12m = useMemo(() => {
    if (!comex) return [];
    return comex.secao_export_12m.map(p => {
      const out: Record<string, number | string> = { mes: p.mes as string };
      for (const k of Object.keys(p)) {
        if (k === "mes") continue;
        const v = p[k];
        if (typeof v === "number") out[secaoLabel(k)] = v;
      }
      return out;
    });
  }, [comex]);
  const secaoImp12m = useMemo(() => {
    if (!comex) return [];
    return comex.secao_import_12m.map(p => {
      const out: Record<string, number | string> = { mes: p.mes as string };
      for (const k of Object.keys(p)) {
        if (k === "mes") continue;
        const v = p[k];
        if (typeof v === "number") out[secaoLabel(k)] = v;
      }
      return out;
    });
  }, [comex]);

  const secKeysExp = comex ? [...comex.secao_export_top6.map(secaoLabel), "Outros"] : [];
  const secKeysImp = comex ? [...comex.secao_import_top6.map(secaoLabel), "Outros"] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-[#132960]">Contas Externas</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Fontes: <strong>BCB</strong> (Balanço de Pagamentos BPM6) e <strong>SECEX/MDIC</strong> (Comex Stat) ·
          Última referência mensal: <strong className="text-zinc-700">{fmtMes(ultima_referencia_mensal ?? "")}</strong>
          {ultima_referencia_diaria && (
            <>
              {" · "}Reservas em <strong className="text-zinc-700">{fmtDataBR(ultima_referencia_diaria)}</strong>
            </>
          )}
          {comex && (
            <>
              {" · "}Comex {comex.periodo_3m.from} a {comex.periodo_3m.to}
            </>
          )}
        </p>
      </header>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI
          label="Saldo do Brasil com o exterior"
          value={fmtBR(hero.saldo_tc_pct_pib.valor, 2)}
          unit="% PIB (12m)"
          trend={trendTc}
          hint="Transações correntes / PIB"
        />
        <KPI
          label="Investimento de longo prazo"
          value={fmtBR(hero.idp_pct_pib.valor, 2)}
          unit="% PIB (12m)"
          trend={trendIdp}
          hint="IDP acum. 12m / PIB"
        />
        <KPI
          label="Reservas internacionais"
          value={fmtBR(hero.reservas_us_bi.valor, 1)}
          unit="US$ bi"
          hint="Conceito de liquidez (BCB)"
        />
        <KPI
          label="Cobertura de importações"
          value={fmtBR(hero.meses_importacao.valor, 1)}
          unit="meses"
          trend={trendMeses}
          hint="Reservas / importação mensal"
        />
      </div>

      {/* ---------- BLOCO A — Balanço de Pagamentos ---------- */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#132960]">Balanço de pagamentos</h2>

        <ChartCard
          title="Saldo do Brasil com o resto do mundo (% PIB)"
          subtitle="Transações correntes — barras anuais desde 2000 (12m no ano corrente)"
          footer="Fonte: BCB SGS 22701 / 4380 (PIB acum 12m em US$). * ano corrente em janela móvel de 12m."
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={saldoAnual} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => `${v.toFixed(1)}%`} />
              <ReferenceLine y={0} stroke="#71717a" />
              <Tooltip
                formatter={(v: any) => [`${fmtBR(v, 2)} %`, "Saldo / PIB"]}
                cursor={{ fill: "rgba(2,125,252,0.05)" }}
              />
              <Bar dataKey="saldo_pct_pib" radius={[3, 3, 0, 0]}>
                {saldoAnual.map((p, i) => (
                  <Cell key={i} fill={p.saldo_pct_pib >= 0 ? COR_POSITIVO : COR_NEGATIVO} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="De onde vem o saldo (24m mensais)"
            subtitle="Decomposição em US$ bilhões"
            footer="Fonte: BCB SGS 22707 (bens) + 22719 (serviços) + 22740 (renda primária) + resíduo (renda secundária)."
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={decomp24m} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v: any) => fmtMes(v)} interval={2} />
                <YAxis tick={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#71717a" />
                <Tooltip
                  labelFormatter={(l: any) => fmtMes(l)}
                  formatter={(v: any, name: any) => [`US$ ${fmtBR(v, 1)} bi`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                <Bar dataKey="bens" name="Bens" stackId="bp" fill={COR_POSITIVO} />
                <Bar dataKey="servicos" name="Serviços" stackId="bp" fill="#f59e0b" />
                <Bar dataKey="renda_primaria" name="Lucros e juros" stackId="bp" fill={COR_NEGATIVO} />
                <Bar dataKey="renda_secundaria" name="Doações/remessas" stackId="bp" fill="#6366f1" />
                <Line
                  type="monotone"
                  dataKey="saldo_total"
                  name="Saldo total"
                  stroke={COR_PRIMARIA}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Balança comercial — bens (24m mensais)"
            subtitle="Exportações vs importações vs saldo, US$ bilhões"
            footer="Fonte: BCB SGS 22711 (exportações) e 22707 (saldo). Importação derivada por identidade."
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={balanca24m} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v: any) => fmtMes(v)} interval={2} />
                <YAxis tick={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#71717a" />
                <Tooltip
                  labelFormatter={(l: any) => fmtMes(l)}
                  formatter={(v: any, name: any) => [`US$ ${fmtBR(v, 1)} bi`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                <Bar dataKey="exportacoes" name="Exportações" fill={COR_POSITIVO} />
                <Bar dataKey="importacoes" name="Importações" fill={COR_NEGATIVO} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* ---------- BLOCO D — Comex Stat ---------- */}
      {comex && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#132960]">Comércio exterior por produto e destino</h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="O que o Brasil exportou (últimos 3 meses)"
              subtitle="Principais categorias em US$ bilhões"
              footer={`Fonte: SECEX/MDIC Comex Stat. Período: ${comex.periodo_3m.from} a ${comex.periodo_3m.to}. Categorias agregadas por prefixo NCM.`}
              height={Math.max(280, catExp.length * 26)}
            >
              <HorizontalRankingBar
                data={catExp as any}
                valueKey="valor_us_bi"
                labelKey="categoria"
                cor={COR_POSITIVO}
                formatTooltip={(v: number) => `US$ ${fmtBR(v, 2)} bi`}
              />
            </ChartCard>

            <ChartCard
              title="O que o Brasil importou (últimos 3 meses)"
              subtitle="Principais categorias em US$ bilhões"
              footer={`Fonte: SECEX/MDIC Comex Stat. Período: ${comex.periodo_3m.from} a ${comex.periodo_3m.to}.`}
              height={Math.max(280, catImp.length * 26)}
            >
              <HorizontalRankingBar
                data={catImp as any}
                valueKey="valor_us_bi"
                labelKey="categoria"
                cor={COR_NEGATIVO}
                formatTooltip={(v: number) => `US$ ${fmtBR(v, 2)} bi`}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="Top 12 produtos exportados — NCM"
              subtitle="Detalhamento por código NCM"
              footer="Fonte: SECEX/MDIC Comex Stat — NCM (Nomenclatura Comum do Mercosul)."
              height={Math.max(280, topNcmExp.length * 26)}
            >
              <HorizontalRankingBar
                data={topNcmExp.map(r => ({
                  produto: r.nome.length > 45 ? r.nome.slice(0, 42) + "…" : r.nome,
                  valor_us_bi: r.valor_us_bi,
                })) as any}
                valueKey="valor_us_bi"
                labelKey="produto"
                cor={COR_POSITIVO}
                formatTooltip={(v: number) => `US$ ${fmtBR(v, 2)} bi`}
              />
            </ChartCard>

            <ChartCard
              title="Top 12 produtos importados — NCM"
              subtitle="Detalhamento por código NCM"
              footer="Fonte: SECEX/MDIC Comex Stat."
              height={Math.max(280, topNcmImp.length * 26)}
            >
              <HorizontalRankingBar
                data={topNcmImp.map(r => ({
                  produto: r.nome.length > 45 ? r.nome.slice(0, 42) + "…" : r.nome,
                  valor_us_bi: r.valor_us_bi,
                })) as any}
                valueKey="valor_us_bi"
                labelKey="produto"
                cor={COR_NEGATIVO}
                formatTooltip={(v: number) => `US$ ${fmtBR(v, 2)} bi`}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="Para onde o Brasil exporta"
              subtitle="Top 10 destinos das exportações"
              footer="Fonte: SECEX/MDIC Comex Stat."
              height={Math.max(280, topDest.length * 26)}
            >
              <HorizontalRankingBar
                data={topDest as any}
                valueKey="valor_us_bi"
                labelKey="pais"
                cor={COR_ACENTO}
                formatTooltip={(v: number) => `US$ ${fmtBR(v, 2)} bi`}
              />
            </ChartCard>

            <ChartCard
              title="De onde o Brasil importa"
              subtitle="Top 10 origens das importações"
              footer="Fonte: SECEX/MDIC Comex Stat."
              height={Math.max(280, topOrig.length * 26)}
            >
              <HorizontalRankingBar
                data={topOrig as any}
                valueKey="valor_us_bi"
                labelKey="pais"
                cor="#8b5cf6"
                formatTooltip={(v: number) => `US$ ${fmtBR(v, 2)} bi`}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Composição das exportações ao longo dos meses (12m)"
            subtitle="Por seção do Sistema Harmonizado — US$ bilhões mensais"
            footer="Fonte: SECEX/MDIC Comex Stat. Top 6 seções agregadas + 'Outros'. Séries em US$ bilhões mensais."
            height={320}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={secaoExp12m} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v: any) => fmtMes(v)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(l: any) => fmtMes(l)}
                  formatter={(v: any, name: any) => [`US$ ${fmtBR(v, 2)} bi`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
                {secKeysExp.map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="exp" fill={PALETA[i % PALETA.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Composição das importações ao longo dos meses (12m)"
            subtitle="Por seção do Sistema Harmonizado — US$ bilhões mensais"
            footer="Fonte: SECEX/MDIC Comex Stat. Top 6 seções + 'Outros'."
            height={320}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={secaoImp12m} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v: any) => fmtMes(v)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(l: any) => fmtMes(l)}
                  formatter={(v: any, name: any) => [`US$ ${fmtBR(v, 2)} bi`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
                {secKeysImp.map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="imp" fill={PALETA[i % PALETA.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
      )}

      {/* ---------- BLOCO B — Investimento ---------- */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#132960]">Investimento estrangeiro</h2>

        <ChartCard
          title="Capital de longo prazo cobre o déficit? (% PIB, 12m, desde 2010)"
          subtitle="IDP (verde) × déficit corrente em valor absoluto (vermelho)"
          footer="Fonte: BCB SGS 22885 (IDP) e 22701 (TC). Quando IDP ≥ déficit, financiamento é sadio (capital de longo prazo)."
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={idpVsTc} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: any) => fmtMes(v)}
                interval={Math.max(1, Math.floor(idpVsTc.length / 12))}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => `${v.toFixed(1)}%`} />
              <ReferenceLine y={0} stroke="#71717a" />
              <Tooltip
                labelFormatter={(l: any) => fmtMes(l)}
                formatter={(v: any, name: any) => [`${fmtBR(v, 2)} %`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
              <Line type="monotone" dataKey="idp_pct_pib" name="IDP / PIB" stroke={COR_POSITIVO} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="deficit_abs_pct_pib" name="|Déficit| / PIB" stroke={COR_NEGATIVO} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Como o investimento entra (24m mensais)"
          subtitle="Participação no capital × reinvestimento × intercompanhia — US$ bilhões"
          footer="Fonte: BCB SGS 22891 + 22892 + intercompanhia (resíduo)."
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={idpDecomp24m} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v: any) => fmtMes(v)} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#71717a" />
              <Tooltip
                labelFormatter={(l: any) => fmtMes(l)}
                formatter={(v: any, name: any) => [`US$ ${fmtBR(v, 1)} bi`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
              <Bar dataKey="participacao" name="Participação no capital" stackId="idp" fill="#1f77b4" />
              <Bar dataKey="reinvestimento" name="Reinvestimento de lucros" stackId="idp" fill="#9467bd" />
              <Bar dataKey="intercompanhia" name="Intercompanhia" stackId="idp" fill="#8c564b" />
              <Line type="monotone" dataKey="total" name="Total" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ---------- BLOCO C — Reservas ---------- */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#132960]">Reservas internacionais</h2>

        <ChartCard
          title="Reservas internacionais — evolução diária (5 anos)"
          subtitle="Conceito de liquidez — US$ bilhões"
          footer="Fonte: BCB SGS 13982. Série diária com downsample automático."
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={reservasSerie} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="data"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: any) => fmtMes(v as string)}
                interval={Math.max(1, Math.floor(reservasSerie.length / 12))}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(l: any) => fmtDataBR(l as string)}
                formatter={(v: any) => [`US$ ${fmtBR(v, 1)} bi`, "Reservas"]}
              />
              <Line type="monotone" dataKey="reservas_us_bi" stroke={COR_ACENTO} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  );
}
