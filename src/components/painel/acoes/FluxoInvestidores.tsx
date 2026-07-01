"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import {
  AzTooltip,
  azGridProps,
  azXAxisProps,
  azYAxisProps,
  azZeroLineProps,
} from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { diffDaysUTC, fmtDataBR, fmtSignedNum, formatAxisDate } from "@/lib/format-br";
import type { FluxoInvestidoresData } from "@/lib/painel-acoes";

// Cores por categoria (tokens do tema AZ). Estrangeiro = navy em destaque,
// pois costuma ditar a tendência; demais em tons de apoio.
const CAT_COLOR: Record<string, string> = {
  Estrangeiro: AZ_BRAND.navy,
  Institucional: AZ_BRAND.azure,
  "Inst. Financeira": AZ_CHART.ticks,
  "Pessoa Fisica": AZ_CHART.pos,
  Outros: "#94A3B8",
};
const CAT_LABEL: Record<string, string> = { "Pessoa Fisica": "Pessoa Física" };
const label = (k: string) => CAT_LABEL[k] ?? k;
// Chave segura p/ dataKey do Recharts: "." vira caminho aninhado, então slugamos.
const slug = (k: string) => k.replace(/[^A-Za-z]/g, "");

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesLabel = (mk: string) => `${MESES[Number(mk.slice(5, 7)) - 1]}/${mk.slice(2, 4)}`;

const PERIODS = [
  { id: "1m", label: "1 mês", months: 1 },
  { id: "3m", label: "3 meses", months: 3 },
  { id: "6m", label: "6 meses", months: 6 },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

type Props = { data: FluxoInvestidoresData };

export function FluxoInvestidores({ data }: Props) {
  // Série curta: não faz sentido separar por ano. Usamos o ano mais recente como
  // curva-base e janelamos por 1/3/6 meses.
  const latestYear = useMemo(
    () => Object.keys(data.years).sort((a, b) => b.localeCompare(a))[0],
    [data],
  );
  const base = latestYear ? data.years[latestYear] : undefined;

  const [period, setPeriod] = useState<PeriodId>("6m");
  const [tableOpen, setTableOpen] = useState(false);

  // Janela: últimos N meses a partir da última data. REBASEADO ao início da
  // janela — cada período mostra o fluxo acumulado DAQUELE período (começa em 0),
  // então 1m/3m/6m são dados de fato diferentes (não só zoom da curva do ano).
  const rows = useMemo(() => {
    if (!base) return [];
    const months = PERIODS.find((p) => p.id === period)!.months;
    const lastD = new Date(base.dates[base.dates.length - 1]);
    const cut = new Date(lastD);
    cut.setMonth(cut.getMonth() - months);
    const idxs = base.dates
      .map((d, i) => ({ d, i }))
      .filter((o) => new Date(o.d) >= cut)
      .map((o) => o.i);
    if (!idxs.length) return [];
    const first = idxs[0];
    return idxs.map((i) => {
      const row: Record<string, number | string> = { date: base.dates[i] };
      for (const lb of base.labels) {
        const v = base.series[lb]?.[i] ?? 0;
        const v0 = base.series[lb]?.[first] ?? 0;
        row[slug(lb)] = Math.round((v - v0) * 10) / 10;
      }
      return row;
    });
  }, [base, period]);

  const span = useMemo(
    () =>
      rows.length > 1
        ? Math.max(1, diffDaysUTC(String(rows[0].date), String(rows[rows.length - 1].date)))
        : 1,
    [rows],
  );

  // Tabela: fluxo líquido por mês (delta do acumulado entre fins de mês), ano cheio.
  const monthly = useMemo(() => {
    if (!base) return { months: [] as { mk: string; cells: number[] }[], labels: [] as string[] };
    const lastIdxByMonth = new Map<string, number>();
    base.dates.forEach((d, i) => lastIdxByMonth.set(d.slice(0, 7), i));
    const mks = [...lastIdxByMonth.keys()].sort();
    const out = mks.map((mk, mi) => {
      const idx = lastIdxByMonth.get(mk)!;
      const prevIdx = mi > 0 ? lastIdxByMonth.get(mks[mi - 1])! : null;
      const cells = base.labels.map((lb) => {
        const accNow = base.series[lb]?.[idx] ?? 0;
        const accPrev = prevIdx != null ? base.series[lb]?.[prevIdx] ?? 0 : 0;
        return Math.round((accNow - accPrev) * 10) / 10;
      });
      return { mk, cells };
    });
    return { months: out, labels: base.labels };
  }, [base]);

  if (!base || rows.length < 2) {
    return (
      <section
        aria-label="Fluxo de investidores"
        className="rounded-2xl border border-[#132960]/15 bg-white p-6 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Fluxo de investidores
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Pipeline em construção — dados serão preenchidos no próximo deploy.
        </p>
      </section>
    );
  }

  const lastIdx = rows.length - 1;
  // Rótulo de valor no fim de cada linha, na altura dela (só no último ponto).
  const endLabel =
    (color: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      if (props.index !== lastIdx || props.value == null) return null;
      return (
        <text
          x={props.x + 6}
          y={props.y}
          dy={3.5}
          fill={color}
          fontSize={11}
          fontWeight={700}
          textAnchor="start"
        >
          {fmtSignedNum(Number(props.value), 1)}
        </text>
      );
    };

  return (
    <section
      aria-label="Fluxo de investidores em ações"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Fluxo de investidores em ações
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Saldo líquido (compras − vendas) por perfil — acumulado em{" "}
            {PERIODS.find((p) => p.id === period)!.label}, R$ bi
          </p>
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => {
            const active = p.id === period;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                aria-pressed={active}
                className={
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition " +
                  (active
                    ? "border-transparent bg-[#132960] text-white shadow-sm"
                    : "border-[#132960]/15 bg-white text-zinc-600 hover:border-[#132960]/40 hover:text-[#132960]")
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </header>

      <div style={{ height: 340 }} className="mt-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 10, right: 46, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              dataKey="date"
              tickFormatter={(d) => formatAxisDate(String(d), span)}
              minTickGap={32}
            />
            <YAxis
              {...azYAxisProps()}
              domain={["auto", "auto"]}
              width={40}
              tickFormatter={(v) => fmtSignedNum(Number(v), 0)}
            />
            <ReferenceLine {...azZeroLineProps("y")} ifOverflow="extendDomain" />
            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => fmtDataBR(String(l))}
                  valueFmt={(v) => `${fmtSignedNum(v, 1)} bi`}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend
              verticalAlign="bottom"
              height={28}
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
            />
            {base.labels.map((lb) => (
              <Line
                key={lb}
                type="monotone"
                dataKey={slug(lb)}
                name={label(lb)}
                stroke={CAT_COLOR[lb]}
                strokeWidth={lb === "Estrangeiro" ? 2.6 : 1.6}
                strokeDasharray={lb === "Outros" ? "4 3" : undefined}
                dot={false}
                isAnimationActive={false}
                label={endLabel(CAT_COLOR[lb])}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela detalhada — minimizada; abre ao clicar */}
      <div className="mt-2 border-t border-[#132960]/10 pt-2">
        <button
          type="button"
          onClick={() => setTableOpen((o) => !o)}
          aria-expanded={tableOpen}
          className="flex w-full items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-[#132960]"
        >
          <span
            className="inline-block transition-transform"
            style={{ transform: tableOpen ? "rotate(90deg)" : "none" }}
          >
            ▸
          </span>
          Tabela — fluxo líquido por mês (R$ bi)
        </button>

        {tableOpen ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-right text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-[#132960]/10 text-zinc-500">
                  <th className="px-2 py-1 text-left font-semibold">Mês</th>
                  {monthly.labels.map((lb) => (
                    <th key={lb} className="px-2 py-1 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: CAT_COLOR[lb] }}
                        />
                        {label(lb)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.months.map((m) => (
                  <tr key={m.mk} className="border-b border-[#132960]/5">
                    <td className="px-2 py-1 text-left font-medium text-zinc-600">
                      {mesLabel(m.mk)}
                    </td>
                    {m.cells.map((v, i) => (
                      <td
                        key={i}
                        className="px-2 py-1"
                        style={{ color: v >= 0 ? AZ_CHART.posText : AZ_CHART.negText }}
                      >
                        {fmtSignedNum(v, 1)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-zinc-400">
              Fluxo líquido do mês = variação do acumulado entre os fins de mês. A soma dos meses
              reconstrói o acumulado no ano do gráfico.
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-[10px] text-zinc-400">
        Fonte: B3 — Boletim Diário do Mercado (dado público). Fluxo = compras − vendas; acumulado no
        ano a partir do acumulado mensal, defasagem de ~{data.lag_dias_uteis} dias úteis (D-
        {data.lag_dias_uteis}). Não é recomendação.
      </p>
      <p className="mt-2 text-right">
        <DataStamp giro={data.generated_at} dado={data.data_date} />
      </p>
    </section>
  );
}
