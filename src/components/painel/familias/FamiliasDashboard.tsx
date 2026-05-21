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
  FamiliasData,
  FamiliasEndividamentoData,
  FamiliasRendaData,
  SeriePonto,
  RendaTotalPonto,
  RendaPosicaoPonto,
  SerieDataPonto,
  ComposicaoPctPonto,
} from "@/lib/painel-familias";

// ----------------------------------------------------------------------------
// Paleta (consistente com outros painéis)
// ----------------------------------------------------------------------------
const COR_PRIMARIA = "#132960";
const COR_ACENTO = "#027DFC";
const COR_POSITIVO = "#16a34a";
const COR_NEGATIVO = "#dc2626";
const COR_AMARELO = "#f59e0b";
const COR_LARANJA = "#ea580c";

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
  // 'YYYY-MM' (último mês do trim móvel) -> 'mês-ant1/mês-ant2/mês-final aa'
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
      <div style={{ height: `${height}px` }} className="w-full">
        {children}
      </div>
      {footer && <div className="mt-3 text-[11px] text-zinc-400">{footer}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Manchete auto-gerada (2 frases — Onda 1: A + B)
// ----------------------------------------------------------------------------
function Manchete({
  renda,
  endividamento,
}: {
  renda: FamiliasRendaData | null;
  endividamento: FamiliasEndividamentoData | null;
}) {
  if (!renda?.hero?.renda_real?.valor || !endividamento?.hero) {
    return null;
  }
  const r = renda.hero.renda_real;
  const varReal = r.var_pct_aa_real ?? 0;
  let dir = "estabilidade";
  if (varReal > 1) dir = `crescimento de ${fmtBR(varReal)}%`;
  else if (varReal < -1) dir = `queda de ${fmtBR(Math.abs(varReal))}%`;

  const trimLabel = r.trim ? fmtTrimMovel(r.trim) : "—";
  const rendaVal = fmtBR0(r.valor);

  const endTotal = endividamento.hero.endividamento_total_pct_renda?.valor;
  const cmpMensal = endividamento.hero.comprometimento_mensal_pct?.valor;

  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-gradient-to-br from-[#132960]/5 to-white p-5 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Resumo</div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">
        No trimestre <strong>{trimLabel}</strong>, a renda real do trabalhador brasileiro foi de{" "}
        <strong>R$ {rendaVal}</strong> em média, com {dir} em relação a 12 meses atrás. As famílias devem aos
        bancos o equivalente a <strong>{fmtBR(endTotal, 1)}%</strong> da renda anual e comprometem{" "}
        <strong>{fmtBR(cmpMensal, 1)}%</strong> da renda mensal com pagamento de dívidas.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Bloco A — Renda
// ----------------------------------------------------------------------------
function BlocoA({ renda }: { renda: FamiliasRendaData }) {
  // A1: renda média real e nominal
  const a1Data = useMemo(
    () =>
      (renda.bloco_renda_total.serie || []).map((p) => ({
        trim: p.trim,
        real: p.rendimento_medio_real,
        nominal: p.rendimento_medio_nominal,
      })),
    [renda.bloco_renda_total.serie],
  );

  // A3: salário mínimo nominal × real — agregar por ano (último valor do ano)
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

  // A4: renda por posição na ocupação — usar 4 categorias principais
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
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={a1Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="trim"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtMes(v)}
              interval={Math.max(0, Math.floor(a1Data.length / 8))}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} domain={["auto", "auto"]} />
            <Tooltip
              labelFormatter={(label) => fmtTrimMovel(label as string)}
              formatter={(v: any, name: any) => [`R$ ${fmtBR0(v as number)}`, name as string]}
            />
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
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={a3Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="ano"
              tick={{ fontSize: 10 }}
              interval={Math.max(0, Math.floor(a3Data.length / 12))}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} domain={["auto", "auto"]} />
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
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={a4Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="trim"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtMes(v)}
              interval={Math.max(0, Math.floor(a4Data.length / 8))}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} domain={["auto", "auto"]} />
            <Tooltip
              labelFormatter={(label) => fmtTrimMovel(label as string)}
              formatter={(v: any, name: any) => [`R$ ${fmtBR0(v as number)}`, name as string]}
            />
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
// Bloco B — Endividamento
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
  // Constrói série combinada por mês: { mes, alias1, alias2, ... }
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
  // B1: endividamento total vs sem habit (24 últimos meses do Brasil 2005+)
  const b1Data = useMemo(
    () => mergePontosFor(endividamento.bloco_endividamento.series_pontos, [
      { src: "total", alias: "total" },
      { src: "sem_habitacional", alias: "sem_habit" },
    ]),
    [endividamento.bloco_endividamento.series_pontos],
  );

  // B2: comprometimento — total, juros, amortização (últimos 60m)
  const b2Data = useMemo(
    () => mergePontosFor(
      endividamento.bloco_comprometimento.series_pontos,
      [
        { src: "servico_divida", alias: "total" },
        { src: "juros", alias: "juros" },
        { src: "amortizacao", alias: "amort" },
      ],
      60,
    ),
    [endividamento.bloco_comprometimento.series_pontos],
  );

  // B3: inadimplência por modalidade (24m)
  const b3Data = useMemo(
    () => mergePontosFor(
      endividamento.bloco_inadimplencia.series_pontos,
      [
        { src: "pf_livres_total", alias: "total" },
        { src: "pessoal_nao_consignado", alias: "credito_pessoal" },
        { src: "consignado_privado", alias: "consignado" },
        { src: "veiculos", alias: "veiculos" },
        { src: "cartao_total", alias: "cartao" },
        { src: "cartao_rotativo", alias: "rotativo" },
      ],
      24,
    ),
    [endividamento.bloco_inadimplencia.series_pontos],
  );

  // B4: composição percentual do estoque PF (24 últimos meses)
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
        footer="Fonte: BCB SGS 29037 (total) e 29038 (sem habit). Quando a linha vermelha encosta na faixa de 50%+, o orçamento da família média está esticado."
        height={340}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={b1Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(b1Data.length / 12))}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip
              labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v as number, 2)}%`, name as string]}
            />
            <ReferenceLine y={50} stroke={COR_NEGATIVO} strokeDasharray="3 3" label={{ value: "50% (faixa de risco)", fill: COR_NEGATIVO, fontSize: 10, position: "insideTopRight" }} />
            <ReferenceLine y={40} stroke={COR_AMARELO} strokeDasharray="3 3" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="total" name="Total (com habitacional)" stroke={COR_TOTAL} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sem_habit" name="Exceto habitacional" stroke={COR_SEM_HABIT} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Comprometimento mensal de renda com dívida (%)"
        subtitle="Total = juros + amortização. Quanto da renda mensal da família vai pra pagar boletos de dívida"
        footer="Fonte: BCB SGS 29034 (total), 29033 (juros), 29036 (amortização) — todas com ajuste sazonal."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={b2Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtMes(v as string)}
              interval={Math.max(0, Math.floor(b2Data.length / 10))}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip
              labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v as number, 2)}%`, name as string]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="total" name="Total (serviço da dívida)" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="juros" name="Juros" stroke={COR_JUROS} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="amort" name="Amortização" stroke={COR_AMORT} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Inadimplência da pessoa física (>90 dias)"
        subtitle="Por modalidade de crédito — recursos livres. O cartão rotativo costuma ficar bem acima das demais"
        footer="Fonte: BCB SGS 21112 (total), 21127 (rotativo), 21129 (cartão total), 21114 (crédito pessoal), 21116 (consignado priv.), 21121 (veículos)."
        height={340}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={b3Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtMes(v as string)}
              interval={1}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip
              labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v as number, 2)}%`, name as string]}
            />
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
        footer="Fonte: BCB SGS 20631 + 20632 (total) e 20680/20689/20695/20697/20712 (modalidades). 'Outras' = residual."
        height={340}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={b4Data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtMes(v as string)}
              interval={1}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
            <Tooltip
              labelFormatter={(label) => fmtMes(label as string)}
              formatter={(v: any, name: any) => [`${fmtBR(v as number, 1)}%`, name as string]}
            />
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
// Dashboard principal
// ----------------------------------------------------------------------------
export function FamiliasDashboard({ data }: { data: FamiliasData }) {
  const { renda, endividamento } = data;

  // KPIs hero — usa endividamento se disponível; fallback gracioso
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

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <header className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-[#132960]">Famílias</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Saúde financeira das famílias brasileiras — renda, endividamento, comprometimento e inadimplência.
          {" "}
          Fontes: BCB SGS, IBGE PNAD Contínua, Ipeadata.
          {renda?.trim_recente && (
            <>
              {" · "}PNAD: <strong className="text-zinc-700">{fmtTrimMovel(renda.trim_recente)}</strong>
            </>
          )}
          {endividamento?.ultima_referencia_mensal && (
            <>
              {" · "}BCB SGS: <strong className="text-zinc-700">{fmtMes(endividamento.ultima_referencia_mensal)}</strong>
            </>
          )}
        </p>
      </header>

      {/* Manchete auto-gerada */}
      <Manchete renda={renda} endividamento={endividamento} />

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI
          label="Renda média real"
          value={heroRenda?.valor ? `R$ ${fmtBR0(heroRenda.valor)}` : "—"}
          unit="por mês"
          trend={trendRenda}
          hint={`Variação real vs 12m: ${fmtBR(heroRenda?.var_pct_aa_real, 1)}%`}
        />
        <KPI
          label="Endividamento total"
          value={fmtBR(heroEnd?.valor, 1)}
          unit="% renda 12m"
          trend={trendEnd}
          hint="Tudo que famílias devem a bancos / renda anual"
        />
        <KPI
          label="Comprometimento mensal"
          value={fmtBR(heroCmp?.valor, 1)}
          unit="% renda mensal"
          trend={trendCmp}
          hint="% do salário do mês comprometido com dívidas"
        />
        <KPI
          label="Inadimplência cartão rotativo"
          value={fmtBR(heroRot?.valor, 1)}
          unit="%"
          trend="neutro"
          hint="Atraso > 90 dias no rotativo — modalidade de juros mais altos"
        />
      </div>

      {/* Bloco A */}
      {renda ? (
        <BlocoA renda={renda} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Dados de Renda (PNAD) indisponíveis no momento. Tente recarregar em alguns minutos.
        </div>
      )}

      {/* Bloco B */}
      {endividamento ? (
        <BlocoB endividamento={endividamento} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Dados de Endividamento (BCB) indisponíveis no momento. Tente recarregar em alguns minutos.
        </div>
      )}

      {/* Ficha técnica resumida */}
      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-xs text-zinc-600">
        <h3 className="mb-2 text-sm font-bold text-[#132960]">Ficha técnica</h3>
        <p className="mb-2">
          <strong>Onda 1 (MVP)</strong> — Blocos A (Renda) e B (Endividamento). Pipeline rodado diariamente às 23h30 UTC via GitHub Actions.
        </p>
        <p className="mb-2">
          <strong>Fontes:</strong> BCB Sistema Gerenciador de Séries Temporais (SGS), IBGE PNAD Contínua via SIDRA, Ipeadata.
          {" "}
          PNAD Contínua é trimestre móvel (ex: "dez-jan-fev/26" = código 202602). Endividamento BCB é estoque/renda 12m. Comprometimento é serviço da dívida mensal / renda mensal (com ajuste sazonal).
        </p>
        <p>
          <strong>Onda 2 (em breve):</strong> Bloco C — Poder de compra estrutural (salário em USD PTAX/PPC, múltiplos físicos FipeZap/carro, cesta DIEESE). Bloco D — Estrutura social (classes A-E FGV Social, pobreza monetária, beneficiários Bolsa Família, IPCA por faixa de renda IPEA).
        </p>
      </section>
    </div>
  );
}
