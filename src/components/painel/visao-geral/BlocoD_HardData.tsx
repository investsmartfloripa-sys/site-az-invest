"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

import type { AnfaveaData, AnpData, AtividadePimData, EpeData, HardDataData, IpeadataData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";

function Termometro({
  zScores,
}: {
  zScores: { nome: string; z: number | null }[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">D1 — Termômetro físico</h3>
      <p className="text-xs text-zinc-500">
        Z-score do último mês vs média 5a. Cores quentes = aquecimento; frias = freio.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {zScores.filter(({ z }) => z !== null).map(({ nome, z }) => {
          const cor =
            z === null
              ? "bg-zinc-100 text-zinc-400"
              : z > 1
                ? "bg-emerald-200 text-emerald-900"
                : z > 0
                  ? "bg-emerald-100 text-emerald-800"
                  : z > -1
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-200 text-rose-900";
          return (
            <div key={nome} className={`rounded-lg p-3 ${cor}`}>
              <div className="text-[10px] uppercase tracking-wide">{nome}</div>
              <div className="mt-1 text-xl font-bold">{z === null ? "—" : z.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardAnfavea({ data }: { data: AnfaveaData | null }) {
  if (!data || data.serie.length === 0) return null;
  const dados = data.serie.slice(-60).map((p) => ({
    mes: p.mes,
    producao: p.producao_indice_2019,
    vendas: p.vendas_indice_2019,
  }));
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">D2 — ANFAVEA: índice base 2019</h3>
      <p className="text-xs text-zinc-500">Produção e vendas de veículos (unidades). Base 100 = média 2019.</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dados}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={100} stroke="#000" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="producao" stroke="#DC2626" dot={false} strokeWidth={1.5} name="Produção" connectNulls />
          <Line type="monotone" dataKey="vendas" stroke="#2563EB" dot={false} strokeWidth={1.5} name="Vendas" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardEnergia({ data }: { data: EpeData | null }) {
  if (!data || data.serie.length === 0) return null;
  const dados = data.serie.slice(-60).map((p) => ({
    mes: p.mes,
    industrial: p.industrial_var_yoy_pct,
    comercial: p.comercial_var_yoy_pct,
    residencial: p.residencial_var_yoy_pct,
    total: p.total_var_yoy_pct,
  }));
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">D4 — Consumo de energia elétrica (EPE)</h3>
      <p className="text-xs text-zinc-500">Variação a/a por classe. Industrial é antecedente forte da PIM.</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dados}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#000" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="industrial" stroke="#DC2626" dot={false} strokeWidth={1.5} name="Industrial" connectNulls />
          <Line type="monotone" dataKey="comercial" stroke="#F59E0B" dot={false} strokeWidth={1.5} name="Comercial" connectNulls />
          <Line type="monotone" dataKey="residencial" stroke="#059669" dot={false} strokeWidth={1.5} name="Residencial" connectNulls />
          <Line type="monotone" dataKey="total" stroke="#132960" dot={false} strokeWidth={2} name="Total" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniSpark({
  serie,
  cor,
  altura = 56,
}: {
  serie: { mes: string; v: number | null | undefined }[];
  cor: string;
  altura?: number;
}) {
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={serie} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="2 2" />
          <Tooltip
            cursor={{ stroke: "#888", strokeWidth: 1 }}
            contentStyle={{ fontSize: 10, padding: "4px 8px" }}
            formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—")}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Line type="monotone" dataKey="v" stroke={cor} strokeWidth={1.6} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardPimDestaque({ pim }: { pim: AtividadePimData | null }) {
  const pimSerie = pim?.geral?.serie ?? [];
  const pimUlt = pimSerie[pimSerie.length - 1];
  const pimYoy = pimUlt?.var_yoy ?? null;
  if (!pim || pimSerie.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-[#132960]/25 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-zinc-900">D2 — PIM-PF: produção industrial (IBGE)</h3>
            <span className="rounded bg-[#132960] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Benchmark oficial IBGE</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Coincidente oficial publicado pelo IBGE via SIDRA (base 2022=100). Referência contra a qual os demais hard data são comparados. Cobre 20% do PIB (indústria).</p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${pimYoy === null || pimYoy === undefined ? "text-zinc-400" : pimYoy >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {pimYoy !== null && pimYoy !== undefined ? `${pimYoy >= 0 ? "+" : ""}${pimYoy.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-zinc-500">a/a, {formatMes(pimUlt?.mes)}</div>
        </div>
      </div>
      <div className="mt-3">
        <MiniSpark
          serie={pimSerie.slice(-36).map((p) => ({ mes: p.mes, v: p.var_yoy }))}
          cor="#132960"
          altura={80}
        />
      </div>
    </div>
  );
}

function CardIpeadata({ data }: { data: IpeadataData | null }) {
  if (!data || data.freshness_status === "missing") return null;

  // PIM-PF oficial via SIDRA IBGE renderizado em CardPimDestaque separado.

  const blocos = [
    { key: "papelao_abpo" as const, titulo: "Papelão ondulado (ABPO)", subt: "Antecedente clássico da PIM (ρ≈0.85)", cor: "#7C3AED", tag: "antecedente" },
    { key: "aco_bruto" as const, titulo: "Aço bruto — produção (IBS)", subt: "Coincidente da indústria de transformação", cor: "#DC2626", tag: "coincidente" },
    { key: "fenabrave_emplac" as const, titulo: "FENABRAVE — emplacamentos", subt: "Antecedente suave de consumo durável", cor: "#2563EB", tag: "antecedente" },
  ];
  const dadosValidos = data ? blocos.filter(b => (data[b.key]?.serie?.length ?? 0) > 0) : [];
  if (dadosValidos.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">D7 — Hard data físico antecedente (IPEADATA)</h3>
          <p className="text-xs text-zinc-500">Antecedentes e coincidentes secundários da indústria. Variação a/a (linha cinza tracejada = 0).</p>
          {(() => {
            const valores = dadosValidos.map(b => { const ser = data![b.key]?.serie ?? []; return { nome: b.titulo.split(" (")[0].split(" —")[0], yoy: ser[ser.length-1]?.var_yoy_pct }; });
            const positivos = valores.filter(v => v.yoy !== null && v.yoy !== undefined && v.yoy > 0).map(v => v.nome);
            const negativos = valores.filter(v => v.yoy !== null && v.yoy !== undefined && v.yoy < 0).map(v => v.nome);
            if (positivos.length > 0 && negativos.length > 0) {
              return <p className="mt-1 text-xs italic text-zinc-600">Sinal misto: <strong>{positivos.join(", ")}</strong> em alta vs <strong>{negativos.join(", ")}</strong> em queda.</p>;
            }
            if (positivos.length === valores.length && valores.length > 0) return <p className="mt-1 text-xs italic text-zinc-600">Sinal positivo difundido nos {positivos.length} indicadores.</p>;
            if (negativos.length === valores.length && valores.length > 0) return <p className="mt-1 text-xs italic text-zinc-600">Sinal negativo difundido — atenção.</p>;
            return null;
          })()}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {dadosValidos.map(b => {
              const serie = data![b.key]!.serie!;
              const ult = serie[serie.length - 1];
              const yoy = ult?.var_yoy_pct;
              const sparkData = serie.slice(-24).map(p => ({ mes: p.mes, v: p.var_yoy_pct }));
              return (
                <div key={b.key} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-zinc-700">{b.titulo}</div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${b.tag === "antecedente" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{b.tag}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">{b.subt}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold" style={{ color: b.cor }}>
                      {yoy !== null && yoy !== undefined ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "—"}
                    </span>
                    <span className="text-[10px] text-zinc-500">a/a, {formatMes(ult?.mes)}</span>
                  </div>
                  <MiniSpark serie={sparkData} cor={b.cor} />
                </div>
              );
            })}
          </div>
    </div>
  );
}

function CardAnp({ data }: { data: AnpData | null }) {
  if (!data || data.serie.length === 0) return null;
  const dados = data.serie.slice(-60).map((p) => ({
    mes: p.mes,
    diesel: p.diesel_indice_2019,
    ciclo_otto: p.ciclo_otto_indice_2019,
    total: p.total_liquidos_indice_2019,
  }));
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">D5 — Combustíveis (ANP, base 2019=100)</h3>
      <p className="text-xs text-zinc-500">
        Diesel = atividade econômica/logística. Ciclo Otto = consumo das famílias.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dados}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={100} stroke="#000" strokeDasharray="2 4" />
          <Line type="monotone" dataKey="diesel" stroke="#DC2626" dot={false} strokeWidth={1.5} name="Diesel" connectNulls />
          <Line type="monotone" dataKey="ciclo_otto" stroke="#2563EB" dot={false} strokeWidth={1.5} name="Ciclo Otto" connectNulls />
          <Line type="monotone" dataKey="total" stroke="#132960" dot={false} strokeWidth={2} name="Total líquidos" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardHardData({ data }: { data: HardDataData | null }) {
  if (!data) return null;
  // Filtrar fontes que tem dado real
  const fontesComDado = (["abcr","abpo","snic","aco","fenabrave"] as const).filter(k => (data as any)[k]?.serie?.length > 0);
  if (fontesComDado.length === 0) return null;
  const fontes = [
    { key: "abcr", nome: "ABCR (pedágio)" },
    { key: "abpo", nome: "ABPO (papelão)" },
    { key: "snic", nome: "SNIC (cimento)" },
    { key: "aco", nome: "Aço Brasil" },
    { key: "fenabrave", nome: "FENABRAVE" },
  ] as const;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {fontes.map(({ key, nome }) => {
        const bloco = data[key];
        const status = bloco?.freshness_status ?? "missing";
        const serie = bloco?.serie ?? [];
        const ult = serie[serie.length - 1];
        return (
          <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-zinc-900">{nome}</h4>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[#132960]">
                {ult?.var_yoy_pct !== null && ult?.var_yoy_pct !== undefined
                  ? `${ult.var_yoy_pct >= 0 ? "+" : ""}${ult.var_yoy_pct.toFixed(1)}%`
                  : "—"}
              </span>
              <span className="text-xs text-zinc-500">a/a</span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {ult ? `Ref. ${formatMes(ult.mes)}` : ""}
              {status === "stale" && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">stale</span>}
              {status === "missing" && (
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">indisponível</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function calcularZScores(payload: {
  anfavea: AnfaveaData | null;
  anp: AnpData | null;
  epe: EpeData | null;
  hardData: HardDataData | null;
}): { nome: string; z: number | null }[] {
  const z = (vals: (number | null | undefined)[]): number | null => {
    const valids = vals.filter((v): v is number => typeof v === "number");
    if (valids.length < 12) return null;
    const slice = valids.slice(-60);
    const media = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - media) ** 2, 0) / slice.length;
    const sd = Math.sqrt(variance) || 1;
    const ult = vals[vals.length - 1];
    if (typeof ult !== "number") return null;
    return (ult - media) / sd;
  };
  const out: { nome: string; z: number | null }[] = [];
  out.push({
    nome: "ANFAVEA prod.",
    z: z((payload.anfavea?.serie ?? []).map((p) => p.producao_var_yoy_pct)),
  });
  out.push({
    nome: "ANFAVEA vendas",
    z: z((payload.anfavea?.serie ?? []).map((p) => p.vendas_var_yoy_pct)),
  });
  out.push({
    nome: "EPE industrial",
    z: z((payload.epe?.serie ?? []).map((p) => p.industrial_var_yoy_pct)),
  });
  out.push({
    nome: "ANP diesel",
    z: z((payload.anp?.serie ?? []).map((p) => p.diesel_var_yoy_pct ?? null)),
  });
  out.push({
    nome: "ANP ciclo Otto",
    z: z((payload.anp?.serie ?? []).map((p) => p.ciclo_otto_var_yoy_pct ?? null)),
  });
  if (payload.hardData) {
    for (const k of ["abcr", "abpo", "snic", "aco", "fenabrave"] as const) {
      out.push({
        nome: k.toUpperCase(),
        z: z((payload.hardData[k]?.serie ?? []).map((p) => p.var_yoy_pct)),
      });
    }
  }
  return out;
}

export function BlocoDHardData({
  anfavea,
  anp,
  epe,
  hardData,
  ipeadata,
  atividadePim,
}: {
  anfavea: AnfaveaData | null;
  anp: AnpData | null;
  epe: EpeData | null;
  hardData: HardDataData | null;
  ipeadata: IpeadataData | null;
  atividadePim: AtividadePimData | null;
}) {
  const zScores = calcularZScores({ anfavea, anp, epe, hardData });
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#132960]">4. O que os caminhões mostram (hard data)</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Indicadores físicos de alta frequência. Antecedem PIM/PMC em 1-2 meses. Sequência: termômetro instantâneo →
          produção e vendas (ANFAVEA) → consumo de energia industrial → combustíveis → papelão/aço/emplacamentos (IPEADATA) → PIM-PF oficial IBGE.
        </p>
      </header>
      <Termometro zScores={zScores} />
      <CardPimDestaque pim={atividadePim} />
      <CardAnfavea data={anfavea} />
      <CardEnergia data={epe} />
      <CardAnp data={anp} />
      <CardIpeadata data={ipeadata} />
      <CardHardData data={hardData} />
    </section>
  );
}
