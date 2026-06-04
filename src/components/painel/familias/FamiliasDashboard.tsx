"use client";

import { useMemo } from "react";
import {
  Area,
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
  FamiliasData,
  FamiliasEndividamentoData,
  FamiliasRendaData,
  FamiliasPoderCompraData,
  FamiliasEstruturaSocialData,
  SeriePonto,
  ComposicaoPctPonto,
} from "@/lib/painel-familias";
import DataStamp from "@/components/painel/DataStamp";
import { lastSeriesDate } from "@/lib/data-stamp";

// ----------------------------------------------------------------------------
// Paleta
// ----------------------------------------------------------------------------
const COR_PRIMARIA = "#132960";
const COR_ACENTO = "#027DFC";
const COR_POSITIVO = "#16a34a";
const COR_NEGATIVO = "#dc2626";
const COR_AMARELO = "#f59e0b";
const COR_LARANJA = "#ea580c";
const COR_ROXO = "#9333ea";
const COR_CIANO = "#0891b2";
const COR_TEAL = "#0d9488";
const COR_ROSA = "#ec4899";

const COR_TOTAL = "#132960";
const COR_SEM_HABIT = "#027DFC";
const COR_JUROS = "#dc2626";
const COR_AMORT = "#0891b2";

const COR_HABIT = "#0ea5e9";
const COR_CONSIG = "#16a34a";
const COR_CARTAO = "#dc2626";
const COR_VEIC = "#f59e0b";
const COR_PESSOAL = "#9333ea";
const COR_OUTRAS = "#6b7280";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
const fmtBR = (n: number | null | undefined, casas = 1): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
};

const fmtBR0 = (n: number | null | undefined): string =>
  n === null || n === undefined || Number.isNaN(n)
    ? "—"
    : Math.round(n).toLocaleString("pt-BR");

const fmtMes = (yyyymmdd: string): string => {
  if (!yyyymmdd || yyyymmdd.length < 7) return yyyymmdd;
  const [y, m] = yyyymmdd.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mi = parseInt(m, 10) - 1;
  return `${meses[mi] ?? m}/${y.slice(2)}`;
};

const fmtTrimMovel = (yyyymm: string): string => {
  if (!yyyymm || yyyymm.length < 7) return yyyymm;
  const [y, m] = yyyymm.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mi = parseInt(m, 10) - 1;
  const m1 = (mi - 2 + 12) % 12;
  const m2 = (mi - 1 + 12) % 12;
  return `${meses[m1]}-${meses[m2]}-${meses[mi]}/${y.slice(2)}`;
};

// ----------------------------------------------------------------------------
// KPI mini
// ----------------------------------------------------------------------------
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
  trend?: "verde" | "vermelho" | "neutro" | "amarelo";
  hint?: string;
}) {
  const trendColor =
    trend === "verde"
      ? COR_POSITIVO
      : trend === "vermelho"
      ? COR_NEGATIVO
      : trend === "amarelo"
      ? COR_AMARELO
      : COR_PRIMARIA;
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

// ----------------------------------------------------------------------------
// ChartCard
// ----------------------------------------------------------------------------
function ChartCard({
  title,
  subtitle,
  footer,
  stampGiro,
  stampDado,
  height = 300,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: string;
  stampGiro?: string | null;
  stampDado?: string | null;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-[#132960]">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div style={{ height: `${height}px` }} className="w-full">
        {children}
      </div>
      {(footer || stampGiro || stampDado) && (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="text-[11px] text-zinc-400">{footer}</div>
          <DataStamp giro={stampGiro} dado={stampDado} className="not-italic" />
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Manchete auto-gerada (4 frases — Onda 1+2)
// ----------------------------------------------------------------------------
function Manchete({
  renda,
  endividamento,
  poderCompra,
  estruturaSocial,
}: {
  renda: FamiliasRendaData | null;
  endividamento: FamiliasEndividamentoData | null;
  poderCompra: FamiliasPoderCompraData | null;
  estruturaSocial: FamiliasEstruturaSocialData | null;
}) {
  if (!renda?.hero?.renda_real?.valor || !endividamento?.hero) return null;
  const r = renda.hero.renda_real;
  const varReal = r.var_pct_aa_real ?? 0;
  let dir = "estabilidade";
  if (varReal > 1) dir = `crescimento de ${fmtBR(varReal)}%`;
  else if (varReal < -1) dir = `queda de ${fmtBR(Math.abs(varReal))}%`;
  const trimLabel = r.trim ? fmtTrimMovel(r.trim) : "—";
  const rendaVal = fmtBR0(r.valor);
  const endTotal = endividamento.hero.endividamento_total_pct_renda?.valor;
  const cmpMensal = endividamento.hero.comprometimento_mensal_pct?.valor;
  const smUsd = poderCompra?.hero?.sm_usd_ptax?.valor;
  const smPpc = poderCompra?.hero?.sm_usd_ppc?.valor;
  const top10 = estruturaSocial?.hero?.concentracao_top10?.valor;
  const pob = estruturaSocial?.hero?.pobreza_pct_830?.valor;

  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-gradient-to-br from-[#132960]/5 to-white p-5 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Resumo</div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">
        No trimestre <strong>{trimLabel}</strong>, a renda real do trabalhador brasileiro foi de{" "}
        <strong>R$ {rendaVal}</strong> em média, com {dir} em relação a 12 meses atrás. As famílias devem aos
        bancos o equivalente a <strong>{fmtBR(endTotal, 1)}%</strong> da renda anual e comprometem{" "}
        <strong>{fmtBR(cmpMensal, 1)}%</strong> da renda mensal com pagamento de dívidas.
        {smUsd != null && smPpc != null && (
          <>
            {" "}O salário mínimo equivale a <strong>US$ {fmtBR(smUsd, 0)}</strong> em câmbio PTAX corrente
            (<strong>US$ {fmtBR(smPpc, 0)}</strong> em paridade de poder de compra interna).
          </>
        )}
        {top10 != null && pob != null && (
          <>
            {" "}Os 10% mais ricos concentram <strong>{fmtBR(top10, 1)}%</strong> da renda; cerca de{" "}
            <strong>{fmtBR(pob, 1)}%</strong> da população vive abaixo de US$ 8,30/dia em paridade de poder de compra.
          </>
        )}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Bloco A — Renda
// ----------------------------------------------------------------------------
function BlocoA({ renda }: { renda: FamiliasRendaData }) {
  const a1Data = useMemo(
    () =>
      (renda.bloco_renda_total.serie || []).map((p) => ({
        trim: p.trim,
        real: p.rendimento_medio_real,
        nominal: p.rendimento_medio_nominal,
      })),
    [renda.bloco_renda_total.serie],
  );

  const a3Data = useMemo(() => {
    const nominal = renda.bloco_salario_minimo.nominal_serie || [];
    const real = renda.bloco_salario_minimo.real_serie || [];
    const byAno: Record<string, { ano: string; nominal: number | null; real: number | null }> = {};
    for (const p of nominal) {
      const ano = p.data.slice(0, 4);
      if (!byAno[ano]) byAno[ano] = { ano, nominal: null, real: null };
      byAno[ano].nominal = p.valor;
    }
    for (const p of real) {
      const ano = p.data.slice(0, 4);
      if (!byAno[ano]) byAno[ano] = { ano, nominal: null, real: null };
      byAno[ano].real = p.valor;
    }
    return Object.values(byAno)
      .sort((a, b) => (a.ano < b.ano ? -1 : 1))
      .filter((p) => parseInt(p.ano, 10) >= 1994);
  }, [renda.bloco_salario_minimo]);

  const a4Data = useMemo(
    () =>
      (renda.bloco_renda_posicao.serie || []).map((p) => ({
        trim: p.trim,
        formal: p.empregado_privado_com_carteira,
        informal: p.empregado_privado_sem_carteira,
        publico: p.empregado_publico,
        conta_propria: p.conta_propria,
      })),
    [renda.bloco_renda_posicao.serie],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-12 rounded bg-[#132960]" />
        <h2 className="text-lg font-bold text-[#132960]">A. Renda</h2>
      </div>

      <ChartCard
        title="Renda real do trabalho (média) — trimestre móvel"
        subtitle="Pessoas de 14+ ocupadas, rendimento habitualmente recebido, valores em R$ deflacionados pelo IBGE"
        footer="Fonte: IBGE/SIDRA PNAD Contínua Trimestral, tabela 6390 (var 5933 real, 5929 nominal)."
        stampGiro={renda.gerado_em}
        stampDado={lastSeriesDate(renda.bloco_renda_total.serie, "trim")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={a1Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="trim" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v)}
              interval={Math.max(0, Math.floor(a1Data.length / 8))} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip labelFormatter={(label) => fmtTrimMovel(label as string)}
              formatter={(v: any, name: any) => [`R$ ${fmtBR0(v as number)}`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="real" name="Real (R$ de hoje)" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="nominal" name="Nominal (R$ correntes)" stroke={COR_ACENTO} strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Salário mínimo nominal × real (desde 1994)"
        subtitle="Linha azul = valor nominal (sobe sempre); laranja = valor real deflacionado pelo INPC"
        footer="Fonte: BCB SGS 1619 (nominal), Ipeadata GAC12_SALMINRE12 (real). Pontos anuais (último valor do ano)."
        stampGiro={renda.gerado_em}
        stampDado={lastSeriesDate(renda.bloco_salario_minimo.nominal_serie)}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={a3Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="ano" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(a3Data.length / 12))} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip formatter={(v: any, name: any) => [`R$ ${fmtBR(v as number, 2)}`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="nominal" name="Nominal" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="real" name="Real (R$ de hoje)" stroke={COR_LARANJA} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Renda média real por posição na ocupação"
        subtitle="R$ por mês — formal (carteira) × informal (sem carteira) × público × conta-própria"
        footer="Fonte: IBGE/SIDRA PNAD Contínua, tabela 6389 (var 5932, classificação 11913)."
        stampGiro={renda.gerado_em}
        stampDado={lastSeriesDate(renda.bloco_renda_posicao.serie, "trim")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={a4Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="trim" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v)}
              interval={Math.max(0, Math.floor(a4Data.length / 8))} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip labelFormatter={(label) => fmtTrimMovel(label as string)}
              formatter={(v: any, name: any) => [`R$ ${fmtBR0(v as number)}`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="formal" name="Empregado privado c/ carteira" stroke={COR_POSITIVO} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="informal" name="Empregado privado s/ carteira" stroke={COR_NEGATIVO} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="publico" name="Empregado público" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="conta_propria" name="Conta-própria" stroke={COR_LARANJA} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Bloco B — Endividamento (mantém exato como estava)
// ----------------------------------------------------------------------------
type SerieMap = Record<string, SeriePonto[]>;

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

function mergePontosFor(
  series: SerieMap,
  keys: { src: string; alias: string }[],
  nMeses?: number,
): Record<string, number | string | null>[] {
  const byMes: Record<string, Record<string, number | string | null>> = {};
  for (const { src, alias } of keys) {
    const arr = series[src] || [];
    for (const p of arr) {
      if (!byMes[p.mes]) byMes[p.mes] = { mes: p.mes };
      byMes[p.mes][alias] = p.valor;
    }
  }
  const ordenado = Object.values(byMes).sort((a, b) => ((a.mes as string) < (b.mes as string) ? -1 : 1));
  return nMeses ? lastN(ordenado, nMeses) : ordenado;
}

function BlocoB({ endividamento }: { endividamento: FamiliasEndividamentoData }) {
  const b1Data = useMemo(
    () => mergePontosFor(endividamento.bloco_endividamento.series_pontos, [
      { src: "total", alias: "total" },
      { src: "sem_habitacional", alias: "sem_habit" },
    ]),
    [endividamento.bloco_endividamento.series_pontos],
  );
  const b2Data = useMemo(
    () => mergePontosFor(endividamento.bloco_comprometimento.series_pontos, [
      { src: "servico_divida", alias: "total" },
      { src: "juros", alias: "juros" },
      { src: "amortizacao", alias: "amort" },
    ], 60),
    [endividamento.bloco_comprometimento.series_pontos],
  );
  const b3Data = useMemo(
    () => mergePontosFor(endividamento.bloco_inadimplencia.series_pontos, [
      { src: "pf_livres_total", alias: "total" },
      { src: "pessoal_nao_consignado", alias: "credito_pessoal" },
      { src: "consignado_privado", alias: "consignado" },
      { src: "veiculos", alias: "veiculos" },
      { src: "cartao_total", alias: "cartao" },
      { src: "cartao_rotativo", alias: "rotativo" },
    ], 24),
    [endividamento.bloco_inadimplencia.series_pontos],
  );
  const b4Data = useMemo<ComposicaoPctPonto[]>(
    () => lastN(endividamento.bloco_estoque.composicao_pct || [], 24),
    [endividamento.bloco_estoque.composicao_pct],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-12 rounded bg-[#dc2626]" />
        <h2 className="text-lg font-bold text-[#132960]">B. Endividamento e comprometimento</h2>
      </div>

      <ChartCard
        title="Endividamento das famílias com bancos (% da renda dos últimos 12 meses)"
        subtitle="Linha azul-escuro = total (com financiamento imobiliário); azul-claro = exceto habitacional"
        footer="Fonte: BCB SGS 29037 (total) e 29038 (sem habit)."
        stampGiro={endividamento.gerado_em}
        stampDado={lastSeriesDate(endividamento.bloco_endividamento.series_pontos["total"])}
        height={340}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={b1Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(b1Data.length / 12))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v as number, 2)}%`, name as string]} />
            <ReferenceLine y={50} stroke={COR_NEGATIVO} strokeDasharray="3 3"
              label={{ value: "50% (faixa de risco)", fill: COR_NEGATIVO, fontSize: 10, position: "insideTopRight" }} />
            <ReferenceLine y={40} stroke={COR_AMARELO} strokeDasharray="3 3" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="total" name="Total (com habitacional)" stroke={COR_TOTAL} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sem_habit" name="Exceto habitacional" stroke={COR_SEM_HABIT} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Comprometimento mensal de renda com dívida (%)"
        subtitle="Total = juros + amortização. Quanto da renda mensal vai pra pagar dívida"
        footer="Fonte: BCB SGS 29034 (total), 29033 (juros), 29036 (amortização), com ajuste sazonal."
        stampGiro={endividamento.gerado_em}
        stampDado={lastSeriesDate(endividamento.bloco_comprometimento.series_pontos["servico_divida"])}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={b2Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(b2Data.length / 10))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v as number, 2)}%`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="total" name="Total (serviço da dívida)" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="juros" name="Juros" stroke={COR_JUROS} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="amort" name="Amortização" stroke={COR_AMORT} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Inadimplência da pessoa física (>90 dias)"
        subtitle="Por modalidade — recursos livres. Cartão rotativo costuma ficar bem acima das demais"
        footer="Fonte: BCB SGS 21112/21114/21116/21121/21127/21129."
        stampGiro={endividamento.gerado_em}
        stampDado={lastSeriesDate(endividamento.bloco_inadimplencia.series_pontos["pf_livres_total"])}
        height={340}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={b3Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)} interval={1} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v as number, 2)}%`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="rotativo" name="Cartão rotativo" stroke={COR_NEGATIVO} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cartao" name="Cartão (total)" stroke={COR_LARANJA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="credito_pessoal" name="Crédito pessoal n/ consignado" stroke={COR_AMARELO} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="veiculos" name="Veículos" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="consignado" name="Consignado privado" stroke={COR_POSITIVO} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="total" name="Total (livres)" stroke={COR_ACENTO} strokeWidth={2} strokeDasharray="4 2" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Composição do estoque de crédito PF (últimos 24 meses)"
        subtitle="Onde mora a dívida da família média — % do saldo total da pessoa física por modalidade"
        footer="Fonte: BCB SGS 20631 + 20632 + 20680/20689/20695/20697/20712. 'Outras' = residual."
        stampGiro={endividamento.gerado_em}
        stampDado={lastSeriesDate(endividamento.bloco_estoque.composicao_pct)}
        height={340}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={b4Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)} interval={1} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v as number, 1)}%`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="habitacional_pct" name="Habitacional" stackId="estoque" fill={COR_HABIT} />
            <Bar dataKey="consignado_pct" name="Consignado" stackId="estoque" fill={COR_CONSIG} />
            <Bar dataKey="cartao_pct" name="Cartão" stackId="estoque" fill={COR_CARTAO} />
            <Bar dataKey="veiculos_pct" name="Veículos" stackId="estoque" fill={COR_VEIC} />
            <Bar dataKey="credito_pessoal_pct" name="Crédito pessoal n/ consig" stackId="estoque" fill={COR_PESSOAL} />
            <Bar dataKey="outras_pct" name="Outras (residual)" stackId="estoque" fill={COR_OUTRAS} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Bloco C — Poder de compra
// ----------------------------------------------------------------------------
function BlocoC({ poderCompra }: { poderCompra: FamiliasPoderCompraData }) {
  const c1Data = useMemo(() => lastN(poderCompra.bloco_cesta_basica.serie || [], 60),
    [poderCompra.bloco_cesta_basica.serie]);
  const c2Data = useMemo(() => lastN(poderCompra.bloco_cambio_ptax.serie || [], 360),
    [poderCompra.bloco_cambio_ptax.serie]);
  const c3Data = useMemo(() => lastN(poderCompra.bloco_ppc.serie || [], 360),
    [poderCompra.bloco_ppc.serie]);
  const c4Data = useMemo(() => poderCompra.bloco_renda_media_usd.serie || [],
    [poderCompra.bloco_renda_media_usd.serie]);
  const c5Data = useMemo(() => lastN(poderCompra.bloco_fipezap.serie || [], 180),
    [poderCompra.bloco_fipezap.serie]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-12 rounded bg-[#0d9488]" />
        <h2 className="text-lg font-bold text-[#132960]">C. Poder de compra estrutural</h2>
      </div>

      <ChartCard
        title="Quantas horas de salário mínimo pagam uma cesta básica?"
        subtitle="Cesta básica nacional DIEESE ÷ (SM ÷ 220h trabalhadas no mês). Quanto maior, menor o poder de compra"
        footer="Fonte: Ipeadata CESBTOTAL (DIEESE — média das 27 capitais) + BCB SGS 1619 (SM nominal)."
        stampGiro={poderCompra.gerado_em}
        stampDado={lastSeriesDate(poderCompra.bloco_cesta_basica.serie)}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={c1Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(c1Data.length / 10))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}h`} domain={["auto", "auto"]} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => {
                if (name === "Horas de SM por cesta") return [`${fmtBR(v as number, 1)} h`, name as string];
                if (name === "% do salário mínimo") return [`${fmtBR(v as number, 1)}%`, name as string];
                return [v, name as string];
              }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="horas_sm" name="Horas de SM por cesta" stroke={COR_TEAL} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pct_sm" name="% do salário mínimo" stroke={COR_LARANJA} strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Salário mínimo em dólar (PTAX corrente)"
        subtitle="SM nominal R$ ÷ taxa PTAX média do mês. Sensível a câmbio — quando dólar sobe, SM em USD cai"
        footer="Fonte: BCB SGS 1619 (SM) ÷ SGS 3697 (PTAX média mensal)."
        stampGiro={poderCompra.gerado_em}
        stampDado={lastSeriesDate(poderCompra.bloco_cambio_ptax.serie)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={c2Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(c2Data.length / 12))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `US$ ${v}`} domain={["auto", "auto"]} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`US$ ${fmtBR(v as number, 2)}`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="sm_usd_ptax" name="SM em US$ (PTAX)" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Salário mínimo em US$ — paridade poder de compra (PPC)"
        subtitle="Quanto o SM brasileiro vale em poder de compra internamente, comparado a uma cesta padrão americana"
        footer="Fonte: Ipeadata GAC12_SALMINDOL12 (IPEA). Diferente do PTAX, captura custo de vida local."
        stampGiro={poderCompra.gerado_em}
        stampDado={lastSeriesDate(poderCompra.bloco_ppc.serie)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={c3Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(c3Data.length / 12))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `US$ ${v}`} domain={["auto", "auto"]} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`US$ ${fmtBR(v as number, 2)}`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="sm_usd_ppc" name="SM em US$ PPC" stroke={COR_ROXO} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Renda média do trabalho em US$ (PTAX)"
        subtitle="Renda média PNAD ÷ PTAX média mensal — mostra ganho real em moeda forte"
        footer="Fonte: PNAD Contínua (rendimento médio real) ÷ BCB SGS 3697 (PTAX)."
        stampGiro={poderCompra.gerado_em}
        stampDado={lastSeriesDate(poderCompra.bloco_renda_media_usd.serie)}
        height={280}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={c4Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(c4Data.length / 8))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `US$ ${v}`} domain={["auto", "auto"]} />
            <Tooltip labelFormatter={(label) => fmtTrimMovel(label as string)}
              formatter={(v: any, name: any) => [`US$ ${fmtBR(v as number, 2)}`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="renda_usd_ptax" name="Renda média em US$" stroke={COR_CIANO} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Índice FipeZap — imóveis residenciais (venda, Brasil)"
        subtitle="Índice mensal base jun/2012=100. Linha laranja mostra variação acumulada em 12 meses"
        footer="Fonte: Ipeadata FIPE12_VENBR12 (FipeZap residencial vendas Brasil)."
        stampGiro={poderCompra.gerado_em}
        stampDado={lastSeriesDate(poderCompra.bloco_fipezap.serie)}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={c5Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(c5Data.length / 12))} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => {
                if (name === "Variação 12m (%)") return [`${fmtBR(v as number, 2)}%`, name as string];
                return [fmtBR(v as number, 1), name as string];
              }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="left" type="monotone" dataKey="indice" name="Índice FipeZap" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="var_pct_aa" name="Variação 12m (%)" stroke={COR_LARANJA} strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Bloco D — Estrutura social
// ----------------------------------------------------------------------------
function BlocoD({ estruturaSocial }: { estruturaSocial: FamiliasEstruturaSocialData }) {
  const d1Data = useMemo(() => estruturaSocial.bloco_concentracao_renda.serie || [],
    [estruturaSocial.bloco_concentracao_renda.serie]);
  const d2Data = useMemo(() => estruturaSocial.bloco_pobreza.serie || [],
    [estruturaSocial.bloco_pobreza.serie]);
  const d3Data = useMemo(() => lastN(estruturaSocial.bloco_transferencias_sociais.serie || [], 60),
    [estruturaSocial.bloco_transferencias_sociais.serie]);
  const d4Data = useMemo(() => estruturaSocial.bloco_gini.serie || [],
    [estruturaSocial.bloco_gini.serie]);
  const d5Data = useMemo(() => lastN(estruturaSocial.bloco_ipca_faixa_renda.serie || [], 60),
    [estruturaSocial.bloco_ipca_faixa_renda.serie]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-12 rounded bg-[#9333ea]" />
        <h2 className="text-lg font-bold text-[#132960]">D. Estrutura social</h2>
      </div>

      <ChartCard
        title="Concentração de renda — quem fica com quanto"
        subtitle="% da renda domiciliar capturada pelos 10% mais ricos, 50% intermediários e 40% mais pobres (PNAD anual)"
        footer="Fonte: Ipeadata PNADS_BOTTOM40 + PNADS_MIDDLE50 (IBGE/PNAD); TOP10 = 100 - BOTTOM40 - MIDDLE50."
        stampGiro={estruturaSocial.gerado_em}
        stampDado={lastSeriesDate(estruturaSocial.bloco_concentracao_renda.serie, "ano")}
        height={340}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d1Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }} stackOffset="expand">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="ano" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(d1Data.length / 12))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} />
            <Tooltip formatter={(v: any, name: any) => [`${fmtBR(v as number, 1)}%`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="bottom40" name="40% mais pobres" stackId="conc" fill={COR_POSITIVO} stroke={COR_POSITIVO} fillOpacity={0.6} />
            <Area type="monotone" dataKey="middle50" name="50% intermediários" stackId="conc" fill={COR_AMARELO} stroke={COR_AMARELO} fillOpacity={0.6} />
            <Area type="monotone" dataKey="top10" name="10% mais ricos" stackId="conc" fill={COR_NEGATIVO} stroke={COR_NEGATIVO} fillOpacity={0.6} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Pobreza monetária — % população abaixo de linhas internacionais (PPC)"
        subtitle="3 linhas do Banco Mundial: US$3/dia (extrema), US$4,20/dia (pobreza moderada), US$8,30/dia (pobreza alta)"
        footer="Fonte: Ipeadata PNADS_PERCPOBRE300/420/830 (PNAD/IBGE)."
        stampGiro={estruturaSocial.gerado_em}
        stampDado={lastSeriesDate(estruturaSocial.bloco_pobreza.serie, "ano")}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d2Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="ano" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(d2Data.length / 12))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip formatter={(v: any, name: any) => [`${fmtBR(v as number, 1)}%`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="pct_300" name="Abaixo US$ 3,00/dia PPC" stroke={COR_NEGATIVO} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pct_420" name="Abaixo US$ 4,20/dia PPC" stroke={COR_LARANJA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pct_830" name="Abaixo US$ 8,30/dia PPC" stroke={COR_AMARELO} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Transferências sociais — Bolsa Família e BPC (R$ milhões/mês)"
        subtitle="Valor mensal nacional pago pelo MDS (agregado dos 27 estados via Ipeadata)"
        footer="Fonte: Ipeadata VAL_PBF12 (Bolsa Família) + VAL_BPC (Benefício de Prestação Continuada)."
        stampGiro={estruturaSocial.gerado_em}
        stampDado={lastSeriesDate(estruturaSocial.bloco_transferencias_sociais.serie)}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d3Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(d3Data.length / 10))} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} domain={[0, "auto"]} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`R$ ${fmtBR0(v as number)} mi`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="pbf_valor_milhoes" name="Bolsa Família" fill={COR_ROXO} />
            <Bar dataKey="bpc_valor_milhoes" name="BPC (idosos + deficiência)" fill={COR_TEAL} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Índice de Gini — concentração de renda domiciliar per capita"
        subtitle="0 = igualdade perfeita; 1 = concentração total. Brasil é dos mais desiguais do mundo (0,50+)"
        footer="Fonte: IBGE/SIDRA tabela 7435 var 10681 (PNAD Contínua Anual)."
        stampGiro={estruturaSocial.gerado_em}
        stampDado={lastSeriesDate(estruturaSocial.bloco_gini.serie, "ano")}
        height={280}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d4Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="ano" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBR(v as number, 3)} domain={[0.45, 0.6]} />
            <Tooltip formatter={(v: any, name: any) => [fmtBR(v as number, 4), name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="valor" name="Gini PNAD" stroke={COR_PRIMARIA} strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="IPCA por faixa de renda — quem sente mais a inflação?"
        subtitle="Indicador IPEA: variação mensal da cesta de consumo de 6 faixas de renda (base jul/2006=1)"
        footer="Fonte: Ipeadata DIMAC_INF1..6 (IPEA Carta de Conjuntura — Indicador IPEA de Inflação por Faixa de Renda)."
        stampGiro={estruturaSocial.gerado_em}
        stampDado={lastSeriesDate(estruturaSocial.bloco_ipca_faixa_renda.serie)}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d5Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(d5Data.length / 10))} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [fmtBR(v as number, 4), name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="muito_baixa" name="Renda muito baixa" stroke={COR_NEGATIVO} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="baixa" name="Renda baixa" stroke={COR_LARANJA} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="media_baixa" name="Renda média-baixa" stroke={COR_AMARELO} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="media" name="Renda média" stroke={COR_POSITIVO} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="media_alta" name="Renda média-alta" stroke={COR_CIANO} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="alta" name="Renda alta" stroke={COR_ROXO} strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Dashboard principal
// ----------------------------------------------------------------------------
export function FamiliasDashboard({ data }: { data: FamiliasData }) {
  const { renda, endividamento, poder_compra, estrutura_social } = data;

  const heroRenda = renda?.hero?.renda_real;
  const trendRenda: "verde" | "amarelo" | "vermelho" | "neutro" = useMemo(() => {
    const v = heroRenda?.var_pct_aa_real ?? 0;
    if (v > 2) return "verde";
    if (v >= 0) return "amarelo";
    return "vermelho";
  }, [heroRenda?.var_pct_aa_real]);

  const heroEnd = endividamento?.hero?.endividamento_total_pct_renda;
  const trendEnd: "verde" | "amarelo" | "vermelho" | "neutro" = useMemo(() => {
    const v = heroEnd?.valor ?? 0;
    if (v < 40) return "verde";
    if (v < 50) return "amarelo";
    return "vermelho";
  }, [heroEnd?.valor]);

  const heroCmp = endividamento?.hero?.comprometimento_mensal_pct;
  const trendCmp: "verde" | "amarelo" | "vermelho" | "neutro" = useMemo(() => {
    const v = heroCmp?.valor ?? 0;
    if (v < 25) return "verde";
    if (v < 30) return "amarelo";
    return "vermelho";
  }, [heroCmp?.valor]);

  const heroRot = endividamento?.hero?.inad_cartao_rotativo_pct;

  // Onda 2 — KPIs C e D
  const heroSmUsd = poder_compra?.hero?.sm_usd_ptax;
  const heroSmPpc = poder_compra?.hero?.sm_usd_ppc;
  const heroCesta = poder_compra?.hero?.cesta_horas_sm;
  const heroFipezap = poder_compra?.hero?.fipezap;
  const heroTop10 = estrutura_social?.hero?.concentracao_top10;
  const heroPobr = estrutura_social?.hero?.pobreza_pct_830;
  const heroGini = estrutura_social?.hero?.gini;
  const heroBpf = estrutura_social?.hero?.bolsa_familia;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-[#132960]">Famílias</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Saúde financeira das famílias brasileiras — renda, endividamento, poder de compra e estrutura social.
          {" "}Fontes: BCB SGS, IBGE PNAD Contínua, Ipeadata (DIEESE, IPEA, FIPE, MDS).
          {renda?.trim_recente && (
            <>{" · "}PNAD: <strong className="text-zinc-700">{fmtTrimMovel(renda.trim_recente)}</strong></>
          )}
          {endividamento?.ultima_referencia_mensal && (
            <>{" · "}BCB: <strong className="text-zinc-700">{fmtMes(endividamento.ultima_referencia_mensal)}</strong></>
          )}
          {poder_compra?.mes_recente && (
            <>{" · "}Câmbio: <strong className="text-zinc-700">{fmtMes(poder_compra.mes_recente)}</strong></>
          )}
        </p>
      </header>

      <Manchete renda={renda} endividamento={endividamento} poderCompra={poder_compra} estruturaSocial={estrutura_social} />

      {/* Hero KPIs — linha 1: A + B (4) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Renda média real"
          value={heroRenda?.valor ? `R$ ${fmtBR0(heroRenda.valor)}` : "—"}
          unit="por mês" trend={trendRenda}
          hint={`Variação real vs 12m: ${fmtBR(heroRenda?.var_pct_aa_real, 1)}%`} />
        <KPI label="Endividamento total" value={fmtBR(heroEnd?.valor, 1)} unit="% renda 12m"
          trend={trendEnd} hint="Tudo que famílias devem a bancos / renda anual" />
        <KPI label="Comprometimento mensal" value={fmtBR(heroCmp?.valor, 1)} unit="% renda mensal"
          trend={trendCmp} hint="% do salário do mês comprometido com dívidas" />
        <KPI label="Inad. cartão rotativo" value={fmtBR(heroRot?.valor, 1)} unit="%"
          trend="neutro" hint="Atraso > 90 dias no rotativo" />
      </div>

      {/* Hero KPIs — linha 2: C + D (4) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="SM em US$ (PTAX)"
          value={heroSmUsd?.valor != null ? `US$ ${fmtBR(heroSmUsd.valor, 0)}` : "—"}
          unit="câmbio corrente" trend="neutro"
          hint={heroSmUsd?.data ? `Mês: ${fmtMes(heroSmUsd.data)}` : ""} />
        <KPI label="SM em US$ (PPC)"
          value={heroSmPpc?.valor != null ? `US$ ${fmtBR(heroSmPpc.valor, 0)}` : "—"}
          unit="poder de compra interno" trend="neutro"
          hint={heroSmPpc?.data ? `Mês: ${fmtMes(heroSmPpc.data)}` : ""} />
        <KPI label="Concentração 10% topo"
          value={fmtBR(heroTop10?.valor, 1)} unit="% renda total" trend="vermelho"
          hint={`Bottom 40%: ${fmtBR(heroTop10?.bottom40, 1)}% · ano ${heroTop10?.ano ?? "—"}`} />
        <KPI label="Pobreza < US$ 8,30/dia"
          value={fmtBR(heroPobr?.valor, 1)} unit="% pop"
          trend={(heroPobr?.valor ?? 0) > 30 ? "vermelho" : "amarelo"}
          hint={`Linha alta Banco Mundial · ano ${heroPobr?.ano ?? "—"}`} />
      </div>

      {/* Hero KPIs — linha 3: cesta + fipezap + gini + bolsa */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Cesta básica em horas SM"
          value={heroCesta?.valor != null ? `${fmtBR(heroCesta.valor, 1)} h` : "—"}
          unit="trabalhadas/mês"
          trend={(heroCesta?.valor ?? 0) > 100 ? "vermelho" : "amarelo"}
          hint={heroCesta?.pct_sm != null ? `${fmtBR(heroCesta.pct_sm, 1)}% do salário mínimo` : ""} />
        <KPI label="FipeZap (Brasil)"
          value={heroFipezap?.indice != null ? fmtBR(heroFipezap.indice, 1) : "—"}
          unit="índice (jun/12=100)"
          trend={(heroFipezap?.var_pct_aa ?? 0) > 5 ? "vermelho" : "neutro"}
          hint={heroFipezap?.var_pct_aa != null ? `Variação 12m: ${fmtBR(heroFipezap.var_pct_aa, 2)}%` : ""} />
        <KPI label="Índice de Gini"
          value={heroGini?.valor != null ? fmtBR(heroGini.valor, 3) : "—"}
          unit="0=igualdade · 1=concentração"
          trend={(heroGini?.valor ?? 0) > 0.5 ? "vermelho" : "amarelo"}
          hint={`Ano: ${heroGini?.ano ?? "—"}`} />
        <KPI label="Bolsa Família"
          value={heroBpf?.valor_milhoes_brl != null ? `R$ ${fmtBR0(heroBpf.valor_milhoes_brl)} mi` : "—"}
          unit="mensal nacional" trend="neutro"
          hint={heroBpf?.data ? `Mês: ${fmtMes(heroBpf.data)}` : ""} />
      </div>

      {/* Bloco A */}
      {renda ? <BlocoA renda={renda} /> : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Dados de Renda (PNAD) indisponíveis no momento. Tente recarregar em alguns minutos.
        </div>
      )}

      {/* Bloco B */}
      {endividamento ? <BlocoB endividamento={endividamento} /> : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Dados de Endividamento (BCB) indisponíveis no momento. Tente recarregar em alguns minutos.
        </div>
      )}

      {/* Bloco C */}
      {poder_compra ? <BlocoC poderCompra={poder_compra} /> : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Dados de Poder de Compra (Ipeadata) indisponíveis no momento.
        </div>
      )}

      {/* Bloco D */}
      {estrutura_social ? <BlocoD estruturaSocial={estrutura_social} /> : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Dados de Estrutura Social (Ipeadata/SIDRA) indisponíveis no momento.
        </div>
      )}

      {/* Ficha técnica */}
      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-xs text-zinc-600">
        <h3 className="mb-2 text-sm font-bold text-[#132960]">Ficha técnica</h3>
        <p className="mb-2">
          <strong>4 blocos via APIs estáveis</strong> — Renda (PNAD), Endividamento (BCB), Poder de compra (Ipeadata/DIEESE/IPEA/FIPE) e Estrutura social (Ipeadata/IBGE/IPEA/MDS). Pipeline diário 23h30 UTC via GitHub Actions.
        </p>
        <p className="mb-2">
          <strong>Princípio editorial:</strong> só entram indicadores com pipeline 100% automático. Fontes que dependem de PDF/HTML/XLSX manual ficam fora — preferimos cobertura menor mas confiável a indicadores que envelhecem sem manutenção.
        </p>
        <p>
          <strong>Notas:</strong> PNAD Contínua é trimestre móvel; "renda real" usa deflator INPC.
          Cesta básica (DIEESE) é média mensal das 27 capitais agregada pelo pipeline.
          SM em US$ PPC e Bolsa Família (mensal) vêm do Ipeadata, que agrega dados oficiais do IPEA e MDS.
          Concentração de renda substitui a antiga "Classes A-E FGV Social" (que requeria PDF manual) por dados PNAD diretos.
        </p>
      </section>
    </div>
  );
}
