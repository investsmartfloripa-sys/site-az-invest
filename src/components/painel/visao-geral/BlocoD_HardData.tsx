"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { AnfaveaData, AnpData, AtividadePimData, AtividadePmcData, AtividadePmsData, CodaceFaixa, EmpregoPnadData, EpeData, HardDataData, HiatoData, IbcBrData, IpeadataData, PnadRendaData } from "@/lib/painel-visao-geral";
import { formatMes } from "@/lib/painel-visao-geral";
import DataStamp from "@/components/painel/DataStamp";

import { ExploradorSeries, type SerieExplorador } from "./ExploradorSeries";
import { CardHiatoLeque } from "./BlocoA_CicloAtual";

export function BlocoDHardData({
  anfavea,
  anp,
  epe,
  hardData: _hardData,
  ipeadata,
  atividadePim,
  atividadePmc,
  empregoPnad,
  atividadePms,
  ibcbr,
  pnadRenda,
  hiato,
  codace = [],
}: {
  anfavea: AnfaveaData | null;
  anp: AnpData | null;
  epe: EpeData | null;
  hardData: HardDataData | null;
  ipeadata: IpeadataData | null;
  atividadePim: AtividadePimData | null;
  atividadePmc: AtividadePmcData | null;
  empregoPnad: EmpregoPnadData | null;
  atividadePms: AtividadePmsData | null;
  ibcbr: IbcBrData | null;
  pnadRenda: PnadRendaData | null;
  hiato?: HiatoData | null;
  codace?: CodaceFaixa[];
}) {
  const pimSerie = atividadePim?.geral?.serie ?? [];
  const pimUlt = pimSerie[pimSerie.length - 1];
  const pimYoy = pimUlt?.var_yoy ?? null;

  const series: SerieExplorador[] = [];

  if (anfavea?.serie?.length) {
    const an = anfavea.serie;
    const ulta = an[an.length - 1];
    series.push({ id: "anfavea-prod", titulo: "ANFAVEA produção", subtitulo: "Veículos produzidos, var. a/a", cor: "#DC2626", valorAtual: ulta?.producao_var_yoy_pct, mesAtual: ulta?.mes, unidade: "%", refLine: 0, data: an.map((p) => ({ mes: p.mes, v: p.producao_var_yoy_pct })) });
    series.push({ id: "anfavea-vendas", titulo: "ANFAVEA vendas", subtitulo: "Emplacamentos, var. a/a", cor: "#2563EB", valorAtual: ulta?.vendas_var_yoy_pct, mesAtual: ulta?.mes, unidade: "%", refLine: 0, data: an.map((p) => ({ mes: p.mes, v: p.vendas_var_yoy_pct })) });
  }
  if (epe?.serie?.length) {
    const ep = epe.serie;
    const ultep = ep[ep.length - 1];
    series.push({ id: "epe-ind", titulo: "EPE indústria", subtitulo: "Consumo industrial, var. a/a", cor: "#7C3AED", valorAtual: ultep?.industrial_var_yoy_pct, mesAtual: ultep?.mes, unidade: "%", refLine: 0, data: ep.map((p) => ({ mes: p.mes, v: p.industrial_var_yoy_pct })) });
    series.push({ id: "epe-total", titulo: "EPE total", subtitulo: "Consumo total, var. a/a", cor: "#059669", valorAtual: ultep?.total_var_yoy_pct, mesAtual: ultep?.mes, unidade: "%", refLine: 0, data: ep.map((p) => ({ mes: p.mes, v: p.total_var_yoy_pct })) });
  }
  if (anp?.serie?.length) {
    const ap = anp.serie;
    const ultap = ap[ap.length - 1];
    series.push({ id: "anp-diesel", titulo: "ANP diesel", subtitulo: "Atividade/logística (índice 2019=100)", cor: "#DC2626", valorAtual: ultap?.diesel_indice_2019, mesAtual: ultap?.mes, unidade: "", refLine: 100, data: ap.map((p) => ({ mes: p.mes, v: p.diesel_indice_2019 })) });
    series.push({ id: "anp-otto", titulo: "ANP ciclo Otto", subtitulo: "Consumo famílias (índice 2019=100)", cor: "#2563EB", valorAtual: ultap?.ciclo_otto_indice_2019, mesAtual: ultap?.mes, unidade: "", refLine: 100, data: ap.map((p) => ({ mes: p.mes, v: p.ciclo_otto_indice_2019 })) });
  }
  // PMC (sales leg do quartet TCB) - varejo restrito IBGE
  if (atividadePmc?.serie?.length) {
    const ser = atividadePmc.serie;
    const u = ser[ser.length - 1];
    series.push({
      id: "pmc-restrito",
      titulo: "PMC varejo restrito (IBGE)",
      subtitulo: "Volume vendas, var. a/a — sales leg quartet TCB",
      cor: "#059669",
      valorAtual: u?.restrito_volume_var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: ser.map((p) => ({ mes: p.mes, v: p.restrito_volume_var_yoy })),
    });
    series.push({
      id: "pmc-ampliado",
      titulo: "PMC varejo ampliado",
      subtitulo: "Volume vendas, var. a/a — inclui veículos+construção",
      cor: "#0EA5E9",
      valorAtual: u?.ampliado_volume_var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: ser.map((p) => ({ mes: p.mes, v: p.ampliado_volume_var_yoy })),
    });
  }
  // PNAD - taxa de desocupacao (employment leg, trimestral)
  if (empregoPnad?.taxas?.serie?.length) {
    const ser = empregoPnad.taxas.serie;
    const u = ser[ser.length - 1];
    series.push({
      id: "pnad-desoc",
      titulo: "Desocupação PNAD-C (IBGE)",
      subtitulo: "Taxa trimestral — employment leg quartet TCB",
      cor: "#F59E0B",
      valorAtual: (u as unknown as Record<string, number | null | undefined>)?.["Taxa de desocupação"],
      mesAtual: u?.trim,
      unidade: "%",
      data: ser.map((p) => ({ mes: p.trim, v: (p as unknown as Record<string, number | null | undefined>)["Taxa de desocupação"] })),
    });
  }
  // IPEADATA: papelao + aco (sem FENABRAVE - movida para Antecedentes - IACE-FGV duraveis)
  // IBC-Br - benchmark mensal CODACE (coincidente oficial BCB)
  if (ibcbr?.serie?.length) {
    const ser = ibcbr.serie;
    const u = ser[ser.length - 1];
    series.push({
      id: "ibcbr",
      titulo: "IBC-Br (BCB)",
      subtitulo: "Proxy mensal do PIB — benchmark CODACE",
      cor: "#132960",
      valorAtual: u?.var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: ser.map((p) => ({ mes: p.mes, v: p.var_yoy })),
    });
  }
  // PIM-PF transformacao (cobre 80% da industria)
  const pimSec = atividadePim?.secoes?.serie ?? [];
  if (pimSec.length > 0) {
    const u = pimSec[pimSec.length - 1];
    series.push({
      id: "pim-transformacao",
      titulo: "PIM-PF transformação",
      subtitulo: "Indústria de transformação (var. a/a)",
      cor: "#7C3AED",
      valorAtual: u?.transformacao_var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: pimSec.map((p) => ({ mes: p.mes, v: p.transformacao_var_yoy })),
    });
    series.push({
      id: "pim-extrativa",
      titulo: "PIM-PF extrativa",
      subtitulo: "Indústria extrativa (var. a/a) — commodities domésticas",
      cor: "#F59E0B",
      valorAtual: u?.extrativa_var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: pimSec.map((p) => ({ mes: p.mes, v: p.extrativa_var_yoy })),
    });
  }
  // PIM-PF bens intermediarios
  const pimCat = atividadePim?.categorias_economicas?.serie ?? [];
  if (pimCat.length > 0) {
    const u = pimCat[pimCat.length - 1];
    series.push({
      id: "pim-intermediarios",
      titulo: "PIM-PF bens interm.",
      subtitulo: "Bens intermediários (var. a/a) — cadeia produtiva",
      cor: "#0EA5E9",
      valorAtual: u?.bens_intermediarios_var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: pimCat.map((p) => ({ mes: p.mes, v: p.bens_intermediarios_var_yoy })),
    });
  }
  // PMS Pesquisa Mensal de Servicos (IBGE) - servicos é 70% do PIB
  const pms = atividadePms?.serie ?? [];
  if (pms.length > 0) {
    const u = pms[pms.length - 1];
    series.push({
      id: "pms-servicos",
      titulo: "PMS serviços (IBGE)",
      subtitulo: "Volume serviços, var. a/a — 70% do PIB",
      cor: "#10B981",
      valorAtual: u?.volume_var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: pms.map((p) => ({ mes: p.mes, v: p.volume_var_yoy })),
    });
  }
  // PNAD-C rendimento medio real (income leg do quartet TCB)
  const rendaSer = pnadRenda?.serie ?? [];
  if (rendaSer.length > 0) {
    const u = rendaSer[rendaSer.length - 1];
    series.push({
      id: "pnad-renda",
      titulo: "PNAD-C rendimento real",
      subtitulo: "Income leg quartet TCB — var. a/a do rendimento medio real",
      cor: "#8B5CF6",
      valorAtual: u?.var_yoy_pct,
      mesAtual: u?.trim,
      unidade: "%",
      refLine: 0,
      data: rendaSer.map((p) => ({ mes: p.trim, v: p.var_yoy_pct })),
    });
  }
  if (ipeadata) {
    const buckets: { key: "papelao_abpo" | "aco_bruto"; titulo: string; subt: string; cor: string }[] = [
      { key: "papelao_abpo", titulo: "Papelão (ABPO)", subt: "Componente ICCE-FGV oficial", cor: "#7C3AED" },
      { key: "aco_bruto", titulo: "Aço bruto (IBS)", subt: "Coincidente indústria pesada", cor: "#DC2626" },
    ];
    for (const b of buckets) {
      const bloco = ipeadata[b.key];
      const ser = bloco?.serie ?? [];
      if (ser.length === 0) continue;
      const u = ser[ser.length - 1];
      series.push({ id: `ipea-${b.key}`, titulo: b.titulo, subtitulo: `${b.subt} · var. a/a`, cor: b.cor, valorAtual: u?.var_yoy_pct, mesAtual: u?.mes, unidade: "%", refLine: 0, data: ser.map((p) => ({ mes: p.mes, v: p.var_yoy_pct })) });
    }
  }

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#132960]">Coincidentes — séries puras</h2>
        <p className="mt-1 text-xs text-zinc-600">Séries que se movem junto com o PIB no presente. Quartet TCB clássico (Stock-Watson 1989 / Duarte-Issler-Spacov 2004 / ICCE-FGV): Produção (PIM-PF) + Vendas (PMC) + Emprego (PNAD-C) + Renda. Complementado pelos componentes oficiais ICCE-FGV: ABPO papelão e EPE energia industrial. Demais hard data (ANFAVEA, ANP, Aço) são coincidentes setoriais. Clique no card para trocar a série do gráfico.</p>
      </header>
      {hiato?.serie && hiato.serie.length > 0 && (
        <CardHiatoLeque serie={hiato.serie} codace={codace} />
      )}

      {atividadePim && pimSerie.length > 0 && (
        <div className="rounded-2xl border-2 border-[#132960]/25 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-zinc-900">PIM-PF: produção industrial (IBGE)</h3>
                <span className="rounded bg-[#132960] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Benchmark oficial IBGE</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Coincidente oficial via SIDRA (base 2022=100).</p>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${pimYoy === null || pimYoy === undefined ? "text-zinc-400" : pimYoy >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{pimYoy !== null && pimYoy !== undefined ? `${pimYoy >= 0 ? "+" : ""}${pimYoy.toFixed(1)}%` : "—"}</div>
              <div className="text-[10px] text-zinc-500">a/a, {formatMes(pimUlt?.mes)}</div>
            </div>
          </div>
          <div className="mt-3 h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pimSerie.slice(-60)} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(60 / 8))} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—")} labelFormatter={(l: unknown) => formatMes(String(l ?? ""))} />
                <ReferenceLine y={0} stroke="#000" strokeDasharray="2 4" />
                <Line type="monotone" dataKey="var_yoy" stroke="#132960" strokeWidth={1.8} dot={false} name="PIM-PF a/a" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2"><DataStamp giro={atividadePim.gerado_em} dado={pimUlt?.mes} /></p>
        </div>
      )}

      <ExploradorSeries series={series} titulo="Demais coincidentes" subtitulo="Quartet TCB: PMC vendas · PNAD desocup. · EPE indústria · ABPO papelão (ICCE) · setoriais ANFAVEA/ANP/Aço" codace={codace} />
    </section>
  );
}
