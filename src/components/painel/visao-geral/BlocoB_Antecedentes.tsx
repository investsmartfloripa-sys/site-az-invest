"use client";

import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

import type { AntecedentesFinData, AtividadePimData, CniData, CodaceFaixa, CreditoData, FgvConfiancaData, IcfData, IpeadataData, OecdCliData, FgvAntecedentesData } from "@/lib/painel-visao-geral";
import { CardSelicReal, CardConcessoes } from "./BlocoE_CondicoesFinanceiras";
import { ExploradorSeries, type SerieExplorador } from "./ExploradorSeries";
import { formatMes } from "@/lib/painel-visao-geral";

function CardOecdCli({ data, codace }: { data: OecdCliData | null; codace: CodaceFaixa[] }) {
  if (!data || !data.serie || data.serie.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
        <h3 className="text-base font-semibold text-zinc-500">B1 — OECD CLI Brasil</h3>
        <p className="mt-2 text-xs text-zinc-400">Aguardando pipeline.</p>
      </div>
    );
  }

  const dados = data.serie.map((p) => ({ mes: p.mes, nivel: p.nivel, var6: p.var_6m_anualizada }));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">
          Indicador antecedente OCDE — Brasil (defasado, último ponto dez/2023)
        </h3>
        <p className="text-xs text-zinc-500">
          Linha 100 = tendência. Quadrante atual: <strong>{data.destaques?.quadrante_recente ?? "—"}</strong>. Adianta
          viradas em 6-9 meses.
        </p>
        {data.mes_recente && new Date(data.mes_recente + "-01").getTime() < Date.now() - 1000*60*60*24*365 && (
          <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-800 border border-amber-200">
            ⚠ Série OECD com defasagem &gt;12 meses (último ponto: {data.mes_recente}). Tratar como contexto histórico.
            Para sinal corrente use o card de Confiança Empresarial FGV no Bloco C.
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis yAxisId="lvl" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
          <YAxis yAxisId="var" orientation="right" tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {codace.map((f, i) => (
            <ReferenceArea
              key={`${f.pico}-${i}`}
              x1={f.pico}
              x2={f.vale}
              fill="#9CA3AF"
              fillOpacity={0.12}
              yAxisId="lvl"
            />
          ))}
          <ReferenceLine yAxisId="lvl" y={100} stroke="#000" strokeDasharray="2 4" />
          <Line yAxisId="lvl" type="monotone" dataKey="nivel" stroke="#132960" strokeWidth={2} dot={false} name="CLI (nível)" />
          <Line
            yAxisId="var"
            type="monotone"
            dataKey="var6"
            stroke="#DC2626"
            strokeWidth={1.5}
            dot={false}
            name="Var. 6m anualizada (%)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardFgvAntecedentes({ data }: { data: FgvAntecedentesData | null }) {
  if (!data || data.freshness_status === "missing") {
    return null; // esconder até o scraper FGV ser ativado
  }

  const status = data.freshness_status;
  const iace = data.iace?.serie ?? [];
  const icce = data.icce?.serie ?? [];
  const iaemp = data.iaemp?.serie ?? [];
  const iiebr = data.iie_br?.serie ?? [];

  // Junta por mês
  const todosMeses = new Set<string>();
  for (const arr of [iace, icce, iaemp, iiebr]) {
    for (const p of arr) todosMeses.add(p.mes);
  }
  const dados = Array.from(todosMeses)
    .sort()
    .map((mes) => ({
      mes,
      iace: iace.find((p) => p.mes === mes)?.valor ?? null,
      icce: icce.find((p) => p.mes === mes)?.valor ?? null,
      iaemp: iaemp.find((p) => p.mes === mes)?.valor ?? null,
      iie_br: iiebr.find((p) => p.mes === mes)?.valor ?? null,
    }));

  if (dados.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-900">Antecedentes FGV-IBRE</h3>
        <p className="text-xs text-zinc-500">
          IACE (antecedente composto), ICCE (coincidente), IAEmp (antecedente de emprego), IIE-Br (incerteza
          econômica).
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dados} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(dados.length / 12))} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))}
            labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="iace" stroke="#DC2626" dot={false} strokeWidth={2} name="IACE" connectNulls />
          <Line type="monotone" dataKey="icce" stroke="#2563EB" dot={false} strokeWidth={1.5} name="ICCE" connectNulls />
          <Line type="monotone" dataKey="iaemp" stroke="#059669" dot={false} strokeWidth={1.5} name="IAEmp" connectNulls />
          <Line type="monotone" dataKey="iie_br" stroke="#7C3AED" dot={false} strokeWidth={1.5} name="IIE-Br" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BlocoBAntecedentes({
  oecdCli,
  fgvAntecedentes,
  codace,
  icf,
  credito,
  ipeadata,
  atividadePim,
  fgvConfianca,
  cni,
  antecedentesFin,
}: {
  oecdCli: OecdCliData | null;
  fgvAntecedentes: FgvAntecedentesData | null;
  codace: CodaceFaixa[];
  icf: IcfData | null;
  credito: CreditoData | null;
  ipeadata: IpeadataData | null;
  atividadePim: AtividadePimData | null;
  fgvConfianca: FgvConfiancaData | null;
  cni: CniData | null;
  antecedentesFin: AntecedentesFinData | null;
}) {
  const oecdDefasado = oecdCli?.mes_recente
    ? new Date(oecdCli.mes_recente + "-01").getTime() < Date.now() - 1000 * 60 * 60 * 24 * 365
    : false;

  // Montar series do explorador (Selic real ex-ante + Concessoes PF/PJ reais + futuras)
  const series: SerieExplorador[] = [];
  if (icf?.serie?.length) {
    const u = icf.serie[icf.serie.length - 1];
    series.push({
      id: "selic-real-exante",
      titulo: "Selic real ex-ante",
      subtitulo: "Selic meta - IPCA esperado 12m (Focus). Acima de ~4% costuma antecipar freio.",
      cor: "#DC2626",
      valorAtual: u?.selic_real_ex_ante_pct,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 4,
      data: icf.serie.map((p) => ({ mes: p.mes, v: p.selic_real_ex_ante_pct })),
    });
  }
  const pfReal = credito?.concessoes?.pf_total_real_12m_var_pct ?? [];
  if (pfReal.length > 0) {
    const u = pfReal[pfReal.length - 1];
    series.push({
      id: "concessoes-pf-real",
      titulo: "Concessões PF reais 12m",
      subtitulo: "Var. real a/a das concessões a pessoas físicas (BCB).",
      cor: "#2563EB",
      valorAtual: u?.valor,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: pfReal.map((p) => ({ mes: p.mes, v: p.valor })),
    });
  }
  const pjReal = credito?.concessoes?.pj_total_real_12m_var_pct ?? [];
  if (pjReal.length > 0) {
    const u = pjReal[pjReal.length - 1];
    series.push({
      id: "concessoes-pj-real",
      titulo: "Concessões PJ reais 12m",
      subtitulo: "Var. real a/a das concessões a pessoas jurídicas (BCB).",
      cor: "#DC2626",
      valorAtual: u?.valor,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: pjReal.map((p) => ({ mes: p.mes, v: p.valor })),
    });
  }
  // FENABRAVE emplacamentos - demanda de bens duráveis (antecedente IACE-FGV)
  const fenSer = ipeadata?.fenabrave_emplac?.serie ?? [];
  if (fenSer.length > 0) {
    const u = fenSer[fenSer.length - 1];
    series.push({
      id: "fenabrave-emplac",
      titulo: "FENABRAVE emplac.",
      subtitulo: "Demanda de bens duráveis (componente antecedente IACE-FGV)",
      cor: "#2563EB",
      valorAtual: u?.var_yoy_pct,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: fenSer.map((p) => ({ mes: p.mes, v: p.var_yoy_pct })),
    });
  }
  // PIM-PF bens consumo duraveis (componente IACE-FGV antecedente classico)
  const pimCat = atividadePim?.categorias_economicas?.serie ?? [];
  if (pimCat.length > 0) {
    const u = pimCat[pimCat.length - 1];
    series.push({
      id: "pim-duraveis",
      titulo: "PIM-PF bens duráveis",
      subtitulo: "Produção de bens de consumo duráveis (var. a/a) — componente IACE-FGV",
      cor: "#DC2626",
      valorAtual: u?.bens_consumo_duraveis_var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: pimCat.map((p) => ({ mes: p.mes, v: p.bens_consumo_duraveis_var_yoy })),
    });
    series.push({
      id: "pim-bens-capital",
      titulo: "PIM-PF bens capital",
      subtitulo: "Produção de bens de capital (var. a/a) — antecedente de investimento (FBKF)",
      cor: "#7C3AED",
      valorAtual: u?.bens_capital_var_yoy,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: pimCat.map((p) => ({ mes: p.mes, v: p.bens_capital_var_yoy })),
    });
  }
  // FGV ICI (Confiança Indústria - expectativas) — componente IACE
  const ici = fgvConfianca?.ici ?? [];
  if (ici.length > 0) {
    const u = ici[ici.length - 1];
    series.push({
      id: "fgv-ici",
      titulo: "FGV ICI (Indústria)",
      subtitulo: "Confiança Indústria FGV — componente IACE (100 = neutro)",
      cor: "#059669",
      valorAtual: u?.valor,
      mesAtual: u?.mes,
      unidade: "",
      refLine: 100,
      data: ici.map((p) => ({ mes: p.mes, v: p.valor })),
    });
  }
  const ics = fgvConfianca?.ics ?? [];
  if (ics.length > 0) {
    const u = ics[ics.length - 1];
    series.push({
      id: "fgv-ics",
      titulo: "FGV ICS (Serviços)",
      subtitulo: "Confiança Serviços FGV — componente IACE (100 = neutro)",
      cor: "#0EA5E9",
      valorAtual: u?.valor,
      mesAtual: u?.mes,
      unidade: "",
      refLine: 100,
      data: ics.map((p) => ({ mes: p.mes, v: p.valor })),
    });
  }
  const icc = fgvConfianca?.icc ?? [];
  if (icc.length > 0) {
    const u = icc[icc.length - 1];
    series.push({
      id: "fgv-icc",
      titulo: "FGV ICC (Consumidor)",
      subtitulo: "Confiança Consumidor FGV — componente IACE (100 = neutro)",
      cor: "#F59E0B",
      valorAtual: u?.valor,
      mesAtual: u?.mes,
      unidade: "",
      refLine: 100,
      data: icc.map((p) => ({ mes: p.mes, v: p.valor })),
    });
  }
  // CNI ICEI expectativas
  const iceiExp = cni?.icei_expectativas ?? [];
  if (iceiExp.length > 0) {
    const u = iceiExp[iceiExp.length - 1];
    series.push({
      id: "cni-icei-exp",
      titulo: "CNI ICEI expectativas",
      subtitulo: "Expectativa empresário industrial (CNI) — 50 = neutro",
      cor: "#10B981",
      valorAtual: u?.valor,
      mesAtual: u?.mes,
      unidade: "",
      refLine: 50,
      data: iceiExp.map((p) => ({ mes: p.mes, v: p.valor })),
    });
  }
  // FGV Construção expectativas (IPEADATA)
  const fgvConstr = ipeadata?.fgv_constr_exp?.serie ?? [];
  if (fgvConstr.length > 0) {
    const u = fgvConstr[fgvConstr.length - 1];
    series.push({
      id: "fgv-constr-exp",
      titulo: "FGV Construção (exp.)",
      subtitulo: "Expectativa construção FGV — antecedente de FBKF",
      cor: "#8B5CF6",
      valorAtual: u?.valor,
      mesAtual: u?.mes,
      unidade: "",
      refLine: 100,
      data: fgvConstr.map((p) => ({ mes: p.mes, v: p.valor })),
    });
  }
  // ICEC CNC (varejo) — IPEADATA
  const icec = ipeadata?.cnc_icec?.serie ?? [];
  if (icec.length > 0) {
    const u = icec[icec.length - 1];
    series.push({
      id: "cnc-icec",
      titulo: "CNC ICEC (varejo)",
      subtitulo: "Confiança empresário comércio (CNC) — antecedente varejo",
      cor: "#EC4899",
      valorAtual: u?.valor,
      mesAtual: u?.mes,
      unidade: "",
      refLine: 100,
      data: icec.map((p) => ({ mes: p.mes, v: p.valor })),
    });
  }
  // Slope DI (Pré 360d - Selic meta). Negativo (curva invertida) antecede recessao.
  const slope = antecedentesFin?.slope_di ?? [];
  if (slope.length > 0) {
    const u = slope[slope.length - 1];
    series.push({
      id: "slope-di",
      titulo: "Slope DI (Pré 1a − Selic)",
      subtitulo: "Negativo = curva invertida (antecede recessão, Estrella-Mishkin 1998)",
      cor: "#DC2626",
      valorAtual: u?.slope_di_pp,
      mesAtual: u?.mes,
      unidade: "pp",
      refLine: 0,
      data: slope.map((p) => ({ mes: p.mes, v: p.slope_di_pp })),
    });
  }
  // Ibov real 6m
  const ibov = antecedentesFin?.ibov_real ?? [];
  if (ibov.length > 0) {
    const u = ibov[ibov.length - 1];
    series.push({
      id: "ibov-real-6m",
      titulo: "Ibovespa real 6m",
      subtitulo: "Retorno acumulado 6m deflacionado pelo IPCA — componente IACE",
      cor: "#059669",
      valorAtual: u?.retorno_real_6m_pct,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: ibov.map((p) => ({ mes: p.mes, v: p.retorno_real_6m_pct })),
    });
  }
  // EMBI+ Brasil
  const embi = antecedentesFin?.embi ?? [];
  if (embi.length > 0) {
    const u = embi[embi.length - 1];
    series.push({
      id: "embi-br",
      titulo: "EMBI+ Brasil",
      subtitulo: "Risco-país em pontos-base (alta antecede aperto crédito)",
      cor: "#F59E0B",
      valorAtual: u?.embi_bps,
      mesAtual: u?.mes,
      unidade: "",
      data: embi.map((p) => ({ mes: p.mes, v: p.embi_bps })),
    });
  }
  if (oecdCli?.serie?.length) {
    const u = oecdCli.serie[oecdCli.serie.length - 1];
    series.push({
      id: "oecd-cli-var6m",
      titulo: "OCDE CLI var. 6m",
      subtitulo: "Variação 6m anualizada do CLI Brasil. Defasagem >12m.",
      cor: "#7C3AED",
      valorAtual: u?.var_6m_anualizada,
      mesAtual: u?.mes,
      unidade: "%",
      refLine: 0,
      data: oecdCli.serie.map((p) => ({ mes: p.mes, v: p.var_6m_anualizada })),
    });
  }

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#132960]">Antecedentes do PIB</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Indicadores que historicamente lideram viradas de ciclo em 3-12 meses. Combinam composite OCDE oficial, taxa de juros real, dinâmica de concessões reais e expectativas FGV. Literatura: IACE/ICCE FGV-IBRE, Chauvet (2002), BCB WP 285 e WP 435 (Gaglianone-Areosa).
        </p>
      </header>

      {oecdDefasado && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800 border border-amber-200">
          ⚠ OCDE CLI publica com defasagem &gt;12 meses (último: {oecdCli?.mes_recente}). Sinal corrente vem das sondagens FGV abaixo. OCDE serve como benchmark histórico cross-country.
        </div>
      )}

      {/* OCDE CLI benchmark sempre visível em cima */}
      <CardOecdCli data={oecdCli} codace={codace} />

      {/* Explorador de séries antecedentes (gráfico único + cards seletores) */}
      {series.length > 0 && (
        <ExploradorSeries
          series={series}
          titulo="Indicadores antecedentes"
          subtitulo="Selic real ex-ante · Concessões reais PF/PJ · OCDE CLI · sondagens FGV/CNI · PIM duráveis/capital"
          codace={codace}
        />
      )}

      {/* FGV antecedentes (quando o scraper voltar) */}
      <CardFgvAntecedentes data={fgvAntecedentes} />

      <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-4 text-center">
        <p className="text-sm font-semibold text-zinc-700">Mais antecedentes em construção</p>
        <p className="mt-1 text-xs text-zinc-500">
          Próximos (via APIs BCB SGS/Olinda + IBGE SIDRA + IPEADATA): IACE FGV oficial, slope DI 10a-2a, Ibov real 6m, EMBI+ Brasil, Focus PIB 12m-ahead, IIE-Br FGV, spread crédito PJ, CAGED saldo MoM dessaz, inadimplência PJ.
        </p>
      </div>
    </section>
  );
}
