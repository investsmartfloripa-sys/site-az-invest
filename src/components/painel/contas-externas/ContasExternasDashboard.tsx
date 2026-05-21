"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
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
  BpDecomposicaoPonto,
  BalancaComercialPonto,
  IdpVsTcPonto,
  IdpDecomposicaoPonto,
  ReservasPonto,
  SaldoAnualPonto,
} from "@/lib/painel-contas-externas";

// Paleta (consistente com outros painéis)
const COR_PRIMARIA = "#132960";
const COR_ACENTO = "#027DFC";
const COR_POSITIVO = "#16a34a";
const COR_NEGATIVO = "#dc2626";

const COR_BENS = "#16a34a";          // verde (superavitário no Brasil)
const COR_SERVICOS = "#f59e0b";       // laranja
const COR_RENDA_PRIM = "#dc2626";     // vermelho (deficitário)
const COR_RENDA_SEC = "#6366f1";      // azul

const COR_IDP = "#16a34a";            // verde — capital sadio
const COR_DEFICIT = "#dc2626";        // vermelho — déficit
const COR_PARTICIPACAO = "#1f77b4";
const COR_REINVESTIMENTO = "#9467bd";
const COR_INTERCOMPANHIA = "#8c564b";

// ---------------------------------------------------------------------------
// Formatadores
// ---------------------------------------------------------------------------
const fmtBR = (n: number | null | undefined, casas = 1): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
};

const fmtMes = (yyyymmdd: string): string => {
  if (!yyyymmdd || yyyymmdd.length < 7) return yyyymmdd;
  const [y, m] = yyyymmdd.split("-");
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
// KPI mini
// ---------------------------------------------------------------------------
function KPI({
  label,
  value,
  unit,
  trend,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: "verde" | "vermelho" | "neutro";
  hint?: string;
}) {
  const trendColor =
    trend === "verde" ? COR_POSITIVO : trend === "vermelho" ? COR_NEGATIVO : COR_PRIMARIA;
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums" style={{ color: trendColor }}>
          {value}
        </span>
        {unit && <span className="text-xs text-zinc-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] text-zinc-400">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartCard - container padrão de gráfico
// ---------------------------------------------------------------------------
function ChartCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-[#132960]">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div className="h-[300px] w-full">{children}</div>
      {footer && <div className="mt-3 text-[11px] text-zinc-400">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export function ContasExternasDashboard({ data }: { data: ContasExternasData }) {
  const { hero, bloco_a, bloco_b, bloco_c, ultima_referencia_mensal, ultima_referencia_diaria } = data;

  // ---- KPIs hero ----
  const trendTc: "verde" | "vermelho" | "neutro" = useMemo(() => {
    const v = hero.saldo_tc_pct_pib.valor ?? 0;
    if (v >= -2 && v <= 2) return "verde";
    if (v >= -4) return "neutro";
    return "vermelho";
  }, [hero.saldo_tc_pct_pib.valor]);

  const trendIdp: "verde" | "vermelho" | "neutro" = useMemo(() => {
    const tc = hero.saldo_tc_pct_pib.valor ?? 0;
    const idp = hero.idp_pct_pib.valor ?? 0;
    if (tc >= 0) return "verde";
    const cobertura = idp / Math.abs(tc);
    if (cobertura >= 1) return "verde";
    if (cobertura >= 0.7) return "neutro";
    return "vermelho";
  }, [hero.saldo_tc_pct_pib.valor, hero.idp_pct_pib.valor]);

  const trendMeses: "verde" | "vermelho" | "neutro" = useMemo(() => {
    const m = hero.meses_importacao.valor ?? 0;
    if (m >= 6) return "verde";
    if (m >= 3) return "neutro";
    return "vermelho";
  }, [hero.meses_importacao.valor]);

  // ---- Bloco A1: Saldo anual desde 2000 ----
  const saldoAnual = bloco_a.saldo_anual;

  // ---- Bloco A2: decomposição 24m (cortando 36 pra caber em mobile) ----
  const decomp24m = useMemo<BpDecomposicaoPonto[]>(
    () => bloco_a.decomposicao_mensal_36m.slice(-24),
    [bloco_a.decomposicao_mensal_36m],
  );

  // ---- Bloco A3: balança comercial 24m ----
  const balanca24m = useMemo<BalancaComercialPonto[]>(
    () => bloco_a.balanca_comercial_36m.slice(-24),
    [bloco_a.balanca_comercial_36m],
  );

  // ---- Bloco B1: IDP vs déficit (apenas pontos onde déficit > 0) ----
  const idpVsTc = useMemo<IdpVsTcPonto[]>(
    () => bloco_b.idp_vs_tc_pct_pib,
    [bloco_b.idp_vs_tc_pct_pib],
  );

  // ---- Bloco B2: IDP decomposição 24m ----
  const idpDecomp24m = useMemo<IdpDecomposicaoPonto[]>(
    () => bloco_b.idp_decomposicao_36m.slice(-24),
    [bloco_b.idp_decomposicao_36m],
  );

  // ---- Bloco C1: reservas diárias (downsample para semanal pra performance) ----
  const reservasSerie = useMemo<ReservasPonto[]>(() => {
    const todas = bloco_c.reservas_diaria;
    if (todas.length <= 600) return todas;
    // Downsample a cada N pontos
    const step = Math.max(1, Math.floor(todas.length / 600));
    return todas.filter((_, i) => i % step === 0 || i === todas.length - 1);
  }, [bloco_c.reservas_diaria]);

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <header className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-[#132960]">Contas Externas</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Fonte: Banco Central do Brasil — Estatísticas do Setor Externo (BPM6) ·
          Última referência mensal: <strong className="text-zinc-700">{fmtMes(ultima_referencia_mensal ?? "")}</strong>
          {ultima_referencia_diaria && (
            <>
              {" · "}Reservas em <strong className="text-zinc-700">{fmtDataBR(ultima_referencia_diaria)}</strong>
            </>
          )}
        </p>
      </header>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI
          label="Saldo com o exterior"
          value={fmtBR(hero.saldo_tc_pct_pib.valor, 2)}
          unit="% PIB (12m)"
          trend={trendTc}
          hint="Transações correntes acum. 12 meses / PIB"
        />
        <KPI
          label="Investimento longo prazo"
          value={fmtBR(hero.idp_pct_pib.valor, 2)}
          unit="% PIB (12m)"
          trend={trendIdp}
          hint="IDP acum. 12 meses / PIB"
        />
        <KPI
          label="Reservas internacionais"
          value={fmtBR(hero.reservas_us_bi.valor, 1)}
          unit="US$ bi"
          trend="neutro"
          hint="Conceito de liquidez"
        />
        <KPI
          label="Cobertura de importações"
          value={fmtBR(hero.meses_importacao.valor, 1)}
          unit="meses"
          trend={trendMeses}
          hint="Reservas / importação mensal"
        />
      </div>

      {/* Bloco A1 — Saldo TC anual desde 2000 */}
      <ChartCard
        title="Saldo do Brasil com o resto do mundo (% PIB)"
        subtitle="Transações correntes — barras anuais, 2000–presente (12m no ano corrente)"
        footer="Fonte: BCB SGS 22701 / 4380 (PIB acum 12m em US$). * ano corrente em 12m móvel."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={saldoAnual} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v: any, name: any) =>
                name === "saldo_pct_pib"
                  ? [`${fmtBR(v, 2)} %`, "Saldo / PIB"]
                  : [`US$ ${fmtBR(v, 1)} bi`, "Saldo"]
              }
            />
            <ReferenceLine y={0} stroke="#71717a" />
            <Bar
              dataKey="saldo_pct_pib"
              name="Saldo / PIB"
              radius={[3, 3, 0, 0]}
              fill="#9ca3af"
              // colorir positivo/negativo via shape
              shape={(props: any) => {
                const v = props.payload?.saldo_pct_pib ?? 0;
                const cor = v >= 0 ? COR_POSITIVO : COR_NEGATIVO;
                const h = Math.abs(props.height);
                return <rect x={props.x} y={props.y} width={props.width} height={h} fill={cor} rx={3} />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bloco A2 — Decomposição mensal */}
      <ChartCard
        title="De onde vem o saldo (mensal, 24 meses)"
        subtitle="Bens, serviços, lucros e juros, doações e remessas — US$ bilhões"
        footer="Fonte: BCB SGS 22707 (bens) + 22719 (serviços) + 22740 (renda primária) + resíduo (renda secundária). Soma ≈ 22701 (saldo)."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={decomp24m.map(p => ({
            ...p,
            bens_bi: p.bens != null ? p.bens / 1000 : null,
            servicos_bi: p.servicos != null ? p.servicos / 1000 : null,
            renda_primaria_bi: p.renda_primaria != null ? p.renda_primaria / 1000 : null,
            renda_secundaria_bi: p.renda_secundaria != null ? p.renda_secundaria / 1000 : null,
            saldo_total_bi: p.saldo_total != null ? p.saldo_total / 1000 : null,
          }))} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v)} interval={1} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
            <Tooltip
              labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`US$ ${fmtBR(v, 1)} bi`, name as string]}
            />
            <ReferenceLine y={0} stroke="#71717a" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="bens_bi" name="Bens" stackId="bp" fill={COR_BENS} />
            <Bar dataKey="servicos_bi" name="Serviços" stackId="bp" fill={COR_SERVICOS} />
            <Bar dataKey="renda_primaria_bi" name="Lucros e juros" stackId="bp" fill={COR_RENDA_PRIM} />
            <Bar dataKey="renda_secundaria_bi" name="Doações/remessas" stackId="bp" fill={COR_RENDA_SEC} />
            <Line
              type="monotone"
              dataKey="saldo_total_bi"
              name="Saldo total"
              stroke={COR_PRIMARIA}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bloco A3 — Balança comercial */}
      <ChartCard
        title="Balança comercial de bens (mensal, 24 meses)"
        subtitle="Exportações × Importações (negativo) × Saldo — US$ bilhões"
        footer="Fonte: BCB SGS 22711 (exportações) e 22707 (saldo). Importação derivada por identidade."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={balanca24m.map(p => ({
            ...p,
            exportacoes_bi: p.exportacoes != null ? p.exportacoes / 1000 : null,
            importacoes_bi: p.importacoes != null ? p.importacoes / 1000 : null,
            saldo_bi: p.saldo != null ? p.saldo / 1000 : null,
          }))} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v)} interval={1} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`US$ ${fmtBR(v, 1)} bi`, name as string]}
            />
            <ReferenceLine y={0} stroke="#71717a" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="exportacoes_bi" name="Exportações" fill={COR_POSITIVO} />
            <Bar dataKey="importacoes_bi" name="Importações" fill={COR_NEGATIVO} />
            <Line type="monotone" dataKey="saldo_bi" name="Saldo" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bloco B1 — IDP vs déficit */}
      <ChartCard
        title="Capital de longo prazo cobre o déficit? (% PIB, 12m)"
        subtitle="Investimento direto no país × déficit em transações correntes (sinal invertido), desde 2010"
        footer="Fonte: BCB SGS 22885 (IDP) e 22701 (TC). Quando IDP (verde) ≥ déficit (vermelho), financiamento é sadio."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={idpVsTc} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtMes(v)}
              interval={Math.max(1, Math.floor(idpVsTc.length / 10))}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
            <Tooltip
              labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v, 2)} %`, name as string]}
            />
            <ReferenceLine y={0} stroke="#71717a" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="idp_pct_pib"
              name="IDP / PIB"
              stroke={COR_IDP}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="deficit_abs_pct_pib"
              name="Déficit / PIB"
              stroke={COR_DEFICIT}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bloco B2 — IDP decomposição */}
      <ChartCard
        title="Como o investimento entra (mensal, 24 meses)"
        subtitle="Participação no capital × reinvestimento de lucros × intercompanhia — US$ bilhões"
        footer="Fonte: BCB SGS 22891 + 22892 + intercompanhia (resíduo)."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={idpDecomp24m.map(p => ({
            ...p,
            participacao_bi: p.participacao != null ? p.participacao / 1000 : null,
            reinvestimento_bi: p.reinvestimento != null ? p.reinvestimento / 1000 : null,
            intercompanhia_bi: p.intercompanhia != null ? p.intercompanhia / 1000 : null,
            total_bi: p.total != null ? p.total / 1000 : null,
          }))} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v)} interval={1} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`US$ ${fmtBR(v, 1)} bi`, name as string]}
            />
            <ReferenceLine y={0} stroke="#71717a" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="participacao_bi" name="Participação no capital" stackId="idp" fill={COR_PARTICIPACAO} />
            <Bar dataKey="reinvestimento_bi" name="Reinvestimento de lucros" stackId="idp" fill={COR_REINVESTIMENTO} />
            <Bar dataKey="intercompanhia_bi" name="Intercompanhia" stackId="idp" fill={COR_INTERCOMPANHIA} />
            <Line type="monotone" dataKey="total_bi" name="Total" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bloco C1 — Reservas internacionais */}
      <ChartCard
        title="Reservas internacionais — evolução diária (5 anos)"
        subtitle="Conceito de liquidez — US$ bilhões"
        footer="Fonte: BCB SGS 13982. Série diária, downsampling automático para performance."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={reservasSerie} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="data"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(1, Math.floor(reservasSerie.length / 12))}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} domain={["auto", "auto"]} />
            <Tooltip
              labelFormatter={(label) => fmtDataBR(label as string)}
              formatter={(v: any) => [`US$ ${fmtBR(v, 1)} bi`, "Reservas"]}
            />
            <Line type="monotone" dataKey="reservas_us_bi" stroke={COR_ACENTO} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
