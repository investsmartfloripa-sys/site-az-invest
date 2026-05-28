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

import { MiniCardExpansivel } from "./MiniCardExpansivel";

function GraficoLinha({ data, dataKey, cor, label, unidade = "%" }: { data: { mes: string; v: number | null | undefined }[]; dataKey?: string; cor: string; label: string; unidade?: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
        <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(data.length / 8))} />
        <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => v.toFixed(unidade === "%" ? 0 : 1) + unidade} />
        <Tooltip
          formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) + unidade : "—")}
          labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
        />
        <ReferenceLine y={0} stroke="#000" strokeDasharray="2 4" />
        <Line type="monotone" dataKey={dataKey ?? "v"} stroke={cor} strokeWidth={1.6} dot={false} name={label} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}


export function BlocoDHardData({
  anfavea,
  anp,
  epe,
  hardData: _hardData,
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
  // ====== PIM-PF como BENCHMARK no topo (mantém destaque) ======
  const pimSerie = atividadePim?.geral?.serie ?? [];
  const pimUlt = pimSerie[pimSerie.length - 1];
  const pimYoy = pimUlt?.var_yoy ?? null;

  // ====== Mini-cards drill-down ======
  // Cada categoria gera mini-cards com sparkline + valor atual + drill-down on click
  const cards: {
    id: string;
    titulo: string;
    subt: string;
    cor: string;
    yoy: number | null | undefined;
    mes: string | null | undefined;
    spark: { mes: string; v: number | null | undefined }[];
    serieCompleta: { mes: string; v: number | null | undefined }[];
    unidade?: string;
  }[] = [];

  // ANFAVEA: produção + vendas + exportação (índice 2019)
  if (anfavea?.serie?.length) {
    const an = anfavea.serie.slice(-60);
    const ulta = an[an.length - 1];
    cards.push({
      id: "anfavea-prod",
      titulo: "ANFAVEA — produção",
      subt: "Veículos produzidos (índice 2019=100)",
      cor: "#DC2626",
      yoy: ulta?.producao_var_yoy_pct,
      mes: ulta?.mes,
      spark: an.map((p) => ({ mes: p.mes, v: p.producao_var_yoy_pct })),
      serieCompleta: anfavea.serie.map((p) => ({ mes: p.mes, v: p.producao_indice_2019 })),
      unidade: "",
    });
    cards.push({
      id: "anfavea-vendas",
      titulo: "ANFAVEA — vendas",
      subt: "Emplacamentos (índice 2019=100)",
      cor: "#2563EB",
      yoy: ulta?.vendas_var_yoy_pct,
      mes: ulta?.mes,
      spark: an.map((p) => ({ mes: p.mes, v: p.vendas_var_yoy_pct })),
      serieCompleta: anfavea.serie.map((p) => ({ mes: p.mes, v: p.vendas_indice_2019 })),
      unidade: "",
    });
  }

  // EPE energia: industrial + total
  if (epe?.serie?.length) {
    const ep = epe.serie.slice(-60);
    const ultep = ep[ep.length - 1];
    cards.push({
      id: "epe-ind",
      titulo: "EPE — consumo industrial",
      subt: "Energia elétrica indústria, var. a/a",
      cor: "#7C3AED",
      yoy: ultep?.industrial_var_yoy_pct,
      mes: ultep?.mes,
      spark: ep.map((p) => ({ mes: p.mes, v: p.industrial_var_yoy_pct })),
      serieCompleta: epe.serie.map((p) => ({ mes: p.mes, v: p.industrial_var_yoy_pct })),
    });
    cards.push({
      id: "epe-total",
      titulo: "EPE — consumo total",
      subt: "Energia elétrica geral, var. a/a",
      cor: "#059669",
      yoy: ultep?.total_var_yoy_pct,
      mes: ultep?.mes,
      spark: ep.map((p) => ({ mes: p.mes, v: p.total_var_yoy_pct })),
      serieCompleta: epe.serie.map((p) => ({ mes: p.mes, v: p.total_var_yoy_pct })),
    });
  }

  // ANP combustíveis: diesel + ciclo otto
  if (anp?.serie?.length) {
    const ap = anp.serie.slice(-60);
    const ultap = ap[ap.length - 1];
    cards.push({
      id: "anp-diesel",
      titulo: "ANP — diesel",
      subt: "Atividade econômica/logística (índice 2019=100)",
      cor: "#DC2626",
      yoy: ultap?.diesel_indice_2019 != null ? ultap.diesel_indice_2019 - 100 : null,
      mes: ultap?.mes,
      spark: ap.map((p) => ({ mes: p.mes, v: p.diesel_indice_2019 != null ? p.diesel_indice_2019 - 100 : null })),
      serieCompleta: anp.serie.map((p) => ({ mes: p.mes, v: p.diesel_indice_2019 })),
      unidade: "",
    });
    cards.push({
      id: "anp-otto",
      titulo: "ANP — ciclo Otto",
      subt: "Consumo das famílias (índice 2019=100)",
      cor: "#2563EB",
      yoy: ultap?.ciclo_otto_indice_2019 != null ? ultap.ciclo_otto_indice_2019 - 100 : null,
      mes: ultap?.mes,
      spark: ap.map((p) => ({ mes: p.mes, v: p.ciclo_otto_indice_2019 != null ? p.ciclo_otto_indice_2019 - 100 : null })),
      serieCompleta: anp.serie.map((p) => ({ mes: p.mes, v: p.ciclo_otto_indice_2019 })),
      unidade: "",
    });
  }

  // IPEADATA hard data: papelão + aço + FENABRAVE
  if (ipeadata) {
    const buckets = [
      { key: "papelao_abpo" as const, titulo: "Papelão ondulado (ABPO)", subt: "Antecedente PIM (ρ≈0.85)", cor: "#7C3AED" },
      { key: "aco_bruto" as const, titulo: "Aço bruto (IBS)", subt: "Coincidente indústria pesada", cor: "#DC2626" },
      { key: "fenabrave_emplac" as const, titulo: "FENABRAVE emplacamentos", subt: "Consumo durável", cor: "#2563EB" },
    ];
    for (const b of buckets) {
      const bloco = ipeadata[b.key];
      const ser = bloco?.serie ?? [];
      if (ser.length === 0) continue;
      const u = ser[ser.length - 1];
      cards.push({
        id: `ipea-${b.key}`,
        titulo: b.titulo,
        subt: b.subt,
        cor: b.cor,
        yoy: u?.var_yoy_pct,
        mes: u?.mes,
        spark: ser.slice(-60).map((p) => ({ mes: p.mes, v: p.var_yoy_pct })),
        serieCompleta: ser.map((p) => ({ mes: p.mes, v: p.var_yoy_pct })),
      });
    }
  }

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#132960]">Coincidentes — séries puras</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Séries que se movem junto com o PIB no presente. Cobertura: PIM-PF oficial IBGE, ANFAVEA produção+vendas, EPE consumo industrial, ANP diesel+ciclo Otto, IPEADATA papelão+aço+FENABRAVE. Cada mini-card mostra var. a/a recente — clique para abrir o gráfico de série temporal completo.
        </p>
      </header>

      {/* PIM-PF BENCHMARK no topo (mantém destaque) */}
      {atividadePim && pimSerie.length > 0 && (
        <div className="rounded-2xl border-2 border-[#132960]/25 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-zinc-900">PIM-PF: produção industrial (IBGE)</h3>
                <span className="rounded bg-[#132960] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Benchmark oficial IBGE</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Coincidente oficial publicado pelo IBGE via SIDRA (base 2022=100). Referência de comparação para os demais hard data.</p>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${pimYoy === null || pimYoy === undefined ? "text-zinc-400" : pimYoy >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {pimYoy !== null && pimYoy !== undefined ? `${pimYoy >= 0 ? "+" : ""}${pimYoy.toFixed(1)}%` : "—"}
              </div>
              <div className="text-[10px] text-zinc-500">a/a, {formatMes(pimUlt?.mes)}</div>
            </div>
          </div>
          <div className="mt-3 h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pimSerie.slice(-60)} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(60 / 8))} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip
                  formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—")}
                  labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
                />
                <ReferenceLine y={0} stroke="#000" strokeDasharray="2 4" />
                <Line type="monotone" dataKey="var_yoy" stroke="#132960" strokeWidth={1.8} dot={false} name="PIM-PF a/a" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Grid de mini-cards com drill-down */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-800">Demais coincidentes — clique para abrir gráfico</h3>
          <span className="text-[10px] text-zinc-500">{cards.length} séries disponíveis</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <MiniCardExpansivel
              key={c.id}
              titulo={c.titulo}
              subtitulo={c.subt}
              valorAtual={c.yoy}
              unidade={c.unidade ?? "%"}
              cor={c.cor}
              mesAtual={c.mes}
              spark={c.spark}
              expanded={
                <GraficoLinha
                  data={c.serieCompleta}
                  cor={c.cor}
                  label={c.titulo}
                  unidade={c.unidade ?? "%"}
                />
              }
            />
          ))}
        </div>
      </div>

      {/* Footer Legend */}
      <p className="mt-3 text-[10px] text-zinc-500">
        Linha cinza tracejada nos sparklines marca o nível zero (var. a/a ou nível base 100). Clique em qualquer card para expandir o histórico completo da série.
      </p>
    </section>
  );
}
