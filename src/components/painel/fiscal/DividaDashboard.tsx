"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { FiscalClassicosData, PontoMensal, PontoMensalPct } from "@/lib/painel-fiscal";
import { CORES_SERIES, CardHeader, IndicadorBox, KPI, Section, Toggle, useHorizonte } from "./FiscalShell";

const HORIZONTES = [
  { value: "5a", label: "5 anos", n: 60 },
  { value: "10a", label: "10 anos", n: 120 },
  { value: "max", label: "Max", n: 9999 },
] as const;

function formatMes(s: string): string {
  if (!s) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
function fmtPct(v: number | null | undefined, casas = 1): string {
  if (v == null) return "—";
  return `${v.toFixed(casas)}%`;
}
function ultimoValor<T extends { valor?: number | null }>(s: T[]): number | null {
  for (let i = s.length - 1; i >= 0; i--) {
    const v = s[i].valor;
    if (v != null) return v;
  }
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipPct = (v: any): string => (typeof v === "number" ? `${v.toFixed(2)}%` : "—");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTipLabel = (s: any): string => formatMes(String(s ?? ""));

function tail<T>(s: T[], n: number): T[] {
  return s.slice(Math.max(0, s.length - n));
}

// Junta múltiplas séries por mês
function mergeMensais(series: Array<{ key: string; data: PontoMensal[] }>): Array<Record<string, number | string | null>> {
  const mapa = new Map<string, Record<string, number | string | null>>();
  series.forEach((s) => {
    s.data.forEach((r) => {
      if (!mapa.has(r.data)) mapa.set(r.data, { mes: r.data });
      mapa.get(r.data)![s.key] = r.valor;
    });
  });
  return Array.from(mapa.values()).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
}

type SerieToggle = {
  id: string;
  label: string;             // título mostrado no card e legenda
  cor: string;               // cor da linha
  valor: number | null;
  unidade: string;
  fonte?: string;
  formula?: string;
  narrativa: string;
  siglas?: Array<{ sigla: string; expansao: string }>;
  serieTemporal: PontoMensal[];   // dados pro gráfico (pode estar vazio se ainda não coletado)
  ativoInicial?: boolean;
};

export function DividaDashboard({ data }: { data: FiscalClassicosData }) {
  const horizonte = useHorizonte(HORIZONTES, "10a");

  // === Calcular série temporal do Wedge (DBGG - DLSP total) ===
  const wedgeSerie = useMemo<PontoMensal[]>(() => {
    const dlspMap = new Map(data.divida.dlsp_total_pct_pib.map((p) => [p.data, p.valor]));
    return data.divida.dbgg_pct_pib.map((p) => {
      const d = dlspMap.get(p.data);
      return { data: p.data, valor: (p.valor != null && d != null) ? p.valor - d : null };
    });
  }, [data]);

  // === Série temporal de Dívida total economia (DBGG + Crédito setor privado) ===
  const credito = data.credito_economia?.credito_total_pct_pib ?? [];
  const dividaTotalSerie = useMemo<PontoMensal[]>(() => {
    if (credito.length === 0) return [];
    const credMap = new Map(credito.map((p) => [p.data, p.valor]));
    return data.divida.dbgg_pct_pib.map((p) => {
      const c = credMap.get(p.data);
      return { data: p.data, valor: (p.valor != null && c != null) ? p.valor + c : null };
    });
  }, [data, credito]);

  // === Definição das 6 séries com toggle ===
  const seriesPossiveis: SerieToggle[] = useMemo(() => [
    {
      id: "dbgg",
      label: "DBGG / PIB",
      cor: "#1e3a8a",
      valor: ultimoValor(data.divida.dbgg_pct_pib),
      unidade: "%",
      fonte: "BCB SGS 13762",
      narrativa: "Dívida bruta do governo geral em % do PIB — métrica padrão FMI / Maastricht. Inclui União, estados, municípios e previdência.",
      siglas: [
        { sigla: "DBGG", expansao: "Dívida Bruta do Governo Geral" },
        { sigla: "PIB", expansao: "Produto Interno Bruto" },
      ],
      serieTemporal: data.divida.dbgg_pct_pib,
      ativoInicial: true,
    },
    {
      id: "dlsp_total",
      label: "DLSP total / PIB",
      cor: "#1f77b4",
      valor: ultimoValor(data.divida.dlsp_total_pct_pib),
      unidade: "%",
      fonte: "BCB SGS 4513",
      narrativa: "Dívida líquida do setor público — DBGG menos créditos do governo (BNDES) menos reservas internacionais menos outros ativos.",
      siglas: [{ sigla: "DLSP", expansao: "Dívida Líquida do Setor Público" }],
      serieTemporal: data.divida.dlsp_total_pct_pib,
      ativoInicial: true,
    },
    {
      id: "dlsp_central",
      label: "DLSP gov central / PIB",
      cor: "#17becf",
      valor: ultimoValor(data.divida.dlsp_gov_central_pct_pib),
      unidade: "%",
      fonte: "BCB SGS 4503",
      narrativa: "Dívida líquida apenas do gov central (União, INSS, BCB). Métrica usada quando o foco é capacidade do Tesouro pagar.",
      serieTemporal: data.divida.dlsp_gov_central_pct_pib,
      ativoInicial: false,
    },
    {
      id: "wedge",
      label: "Ativos públicos líquidos / PIB",
      cor: "#9467bd",
      valor: ultimoValor(wedgeSerie),
      unidade: "%",
      formula: "DBGG − DLSP total",
      narrativa: "Diferença entre dívida bruta e líquida. Representa o conjunto de ativos do setor público: créditos do governo (BNDES, FAT, fundos), reservas internacionais e ativos da União que abatem da dívida bruta no cálculo da líquida. Quanto maior, mais 'colchão' o governo tem em caso de stress fiscal/cambial.",
      serieTemporal: wedgeSerie,
      ativoInicial: false,
    },
    {
      id: "credito",
      label: "Crédito setor privado / PIB",
      cor: "#2ca02c",
      valor: credito.length > 0 ? ultimoValor(credito) : null,
      unidade: "%",
      fonte: "BCB SGS 20622",
      narrativa: "Crédito total ao setor privado (famílias + empresas) sobre PIB. No livro do Dalio, fase tardia do Big Debt Cycle = endividamento privado saturado.",
      serieTemporal: credito,
      ativoInicial: false,
    },
    {
      id: "divida_total",
      label: "Dívida total economia / PIB",
      cor: "#6a3d9a",
      valor: ultimoValor(dividaTotalSerie),
      unidade: "%",
      formula: "DBGG + Crédito setor privado / PIB",
      narrativa: "Endividamento agregado do país. Referência Dalio: EUA ~250%, China ~290%, Japão ~410%. Brasil em ~136% é relativamente baixo no comparativo internacional.",
      serieTemporal: dividaTotalSerie,
      ativoInicial: false,
    },
  ], [data, wedgeSerie, dividaTotalSerie, credito]);

  // Estado de quais séries estão ativas
  const [ativas, setAtivas] = useState<Set<string>>(() => {
    return new Set(seriesPossiveis.filter((s) => s.ativoInicial).map((s) => s.id));
  });

  function toggle(id: string) {
    const nova = new Set(ativas);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    setAtivas(nova);
  }

  // Dados do gráfico — só séries ativas
  const chartData = useMemo(() => {
    const ativasArr = seriesPossiveis.filter((s) => ativas.has(s.id));
    if (ativasArr.length === 0) return [];
    const ativasComCorte = ativasArr.map((s) => ({
      key: s.id,
      data: tail(s.serieTemporal, horizonte.n),
    }));
    return mergeMensais(ativasComCorte);
  }, [seriesPossiveis, ativas, horizonte.n]);

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="Dívida pública"
        subtitulo="Trajetória da dívida bruta (DBGG), líquida (DLSP) e do setor privado. Clique nos cards à direita para adicionar/remover séries do gráfico. Fonte: BCB SGS 13762, 4513, 4503, 20622."
        rightSlot={<Toggle value={horizonte.horizonte} onChange={horizonte.setHorizonte} options={[...HORIZONTES]} />}
      />

      {/* === CARDS-TOGGLE HORIZONTAIS ACIMA === */}
      <div>
        <div className="mb-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-700">
          <strong>Tracejado</strong>: clique p/ adicionar série · <strong>Colorido</strong>: ativo (clique p/ remover)
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {seriesPossiveis.map((s) => {
            const ativo = ativas.has(s.id);
            const semDado = s.valor == null;
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => toggle(s.id)}
                disabled={semDado}
                className={`group cursor-pointer rounded-lg p-2 text-left transition ${
                  semDado ? "cursor-not-allowed border-2 border-zinc-200 bg-zinc-50 opacity-60" :
                  ativo
                    ? "border-2 shadow-md hover:shadow-lg hover:scale-[1.02]"
                    : "border-2 border-dashed border-zinc-300 bg-white hover:border-solid hover:scale-[1.02] hover:shadow-md"
                }`}
                style={ativo && !semDado ? { borderColor: s.cor, background: `${s.cor}10` } : {}}
                title={s.narrativa}
              >
                <div className="flex items-start gap-1.5">
                  <span
                    className="mt-0.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                    style={{ background: ativo ? s.cor : "transparent", border: `2px solid ${s.cor}` }}
                  />
                  <h4 className="flex-1 text-[11.5px] font-bold leading-tight text-[#132960]">{s.label}</h4>
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                  {s.valor != null ? `${s.valor.toFixed(2)}${s.unidade}` : "—"}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  {s.formula && (
                    <span className="rounded bg-violet-100 px-1 py-0.5 text-[9px] font-bold uppercase text-violet-900">calc</span>
                  )}
                  {!semDado && (ativo ? (
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                      style={{ background: s.cor }}
                    >
                      ativo
                    </span>
                  ) : (
                    <span className="rounded border border-dashed border-zinc-400 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-500 group-hover:border-solid group-hover:text-[#132960]">
                      + add
                    </span>
                  ))}
                </div>
                {s.formula && (
                  <p className="mt-1 text-[9.5px] italic leading-tight text-violet-700">{s.formula}</p>
                )}
                {s.fonte && !s.formula && (
                  <p className="mt-1 text-[9.5px] leading-tight text-zinc-500">{s.fonte}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* === GRÁFICO PRINCIPAL EM LARGURA TOTAL === */}
        <Section titulo="Trajetória das séries">
          {chartData.length === 0 ? (
            <div className="flex h-80 items-center justify-center text-sm text-zinc-500">
              Selecione pelo menos uma série nos cards à direita.
            </div>
          ) : (
            <div className="h-[32rem]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    unit="%"
                    domain={[(dataMin: number) => Math.floor(dataMin / 10) * 10, (dataMax: number) => Math.ceil(dataMax / 10) * 10]}
                    allowDecimals={false}
                  />
                  <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={80} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "80% atenção FMI", fontSize: 10, fill: "#dc2626", position: "insideTopRight" }} />
                  <ReferenceLine y={100} stroke="#7f1d1d" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "100% Reinhart-Rogoff", fontSize: 10, fill: "#7f1d1d", position: "insideTopRight" }} />
                  {seriesPossiveis.filter((s) => ativas.has(s.id)).map((s) => (
                    <Line key={s.id} type="monotone" dataKey={s.id} name={s.label} stroke={s.cor} strokeWidth={2.75} dot={false} activeDot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">
            Linhas tracejadas vermelhas: 80% (zona de atenção FMI) e 100% (limite Reinhart-Rogoff associado à fragilidade fiscal histórica).
          </p>
        </Section>

      </div>
      {/* === COMPOSIÇÃO DPMFi (mantida) === */}
      {data.composicao_dpmfi && (() => {
        const comp = data.composicao_dpmfi;
        const pct_selic = ultimoValor(comp.selic_pct);
        const pct_prefix = ultimoValor(comp.prefixado_pct);
        const pct_cambio = ultimoValor(comp.cambio_pct);
        const soma_conhecidos = (pct_selic ?? 0) + (pct_prefix ?? 0) + (pct_cambio ?? 0) +
                                (ultimoValor(comp.tr_pct ?? []) ?? 0) +
                                (ultimoValor(comp.outros_pct ?? []) ?? 0);
        const pct_ipca = soma_conhecidos > 0 ? Math.max(0, 100 - soma_conhecidos) : null;
        const serieComp = mergeMensais([
          { key: "Selic/LFT", data: tail(comp.selic_pct, horizonte.n) },
          { key: "Prefixado", data: tail(comp.prefixado_pct, horizonte.n) },
          { key: "Câmbio", data: tail(comp.cambio_pct, horizonte.n) },
        ]);
        return (
          <Section
            titulo="Composição da DPMFi por indexador"
            hint="Dívida Pública Mobiliária Federal interna por tipo de indexador. Selic/LFT = exposta a aperto monetário. Câmbio = exposta a desvalorização. Fonte: BCB SGS 4174-4180."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <IndicadorBox
                titulo="Selic / LFT"
                valor={pct_selic}
                unidade="%"
                fonte="BCB SGS 4177"
                narrativa="Parte da DPMFi indexada à Selic via LFT. Quando o BC sobe juros, o estoque inteiro encarece imediatamente. Brasil 2002: 70%. Hoje próximo de 50%."
                siglas={[
                  { sigla: "DPMFi", expansao: "Dívida Pública Mobiliária Federal interna" },
                  { sigla: "LFT", expansao: "Letra Financeira do Tesouro (indexada à Selic)" },
                ]}
                trend={pct_selic && pct_selic > 50 ? "ruim" : "neutra"}
              />
              <IndicadorBox
                titulo="IPCA (NTN-B)"
                valor={pct_ipca}
                unidade="%"
                formula="100% − (Selic + Prefixado + Câmbio + outros)"
                narrativa="Parte indexada à inflação via NTN-B. Calculado por resíduo das demais. Atrai investidores de longo prazo (fundos de pensão)."
                siglas={[{ sigla: "NTN-B", expansao: "Nota do Tesouro Nacional série B (indexada ao IPCA)" }]}
              />
              <IndicadorBox
                titulo="Prefixado"
                valor={pct_prefix}
                unidade="%"
                fonte="BCB SGS 4178"
                narrativa="Parte com custo travado na emissão. Protege o estoque contra alta de juros. Acima de 25% é considerado saudável."
                trend={pct_prefix && pct_prefix > 25 ? "boa" : "ruim"}
              />
              <IndicadorBox
                titulo="Câmbio"
                valor={pct_cambio}
                unidade="%"
                fonte="BCB SGS 4175"
                narrativa="Dívida em moeda estrangeira — vulnerável a desvalorizações. Brasil tem virtude estrutural: ~1-3%. Argentina pré-2001 tinha mais de 60%."
                trend={pct_cambio && pct_cambio > 5 ? "ruim" : "boa"}
              />
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serieComp}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={fmtTipPct} labelFormatter={fmtTipLabel} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Selic/LFT" stroke={CORES_SERIES[3]} fill={CORES_SERIES[3]} fillOpacity={0.4} strokeWidth={2} />
                  <Area type="monotone" dataKey="Prefixado" stroke={CORES_SERIES[2]} fill={CORES_SERIES[2]} fillOpacity={0.4} strokeWidth={2} />
                  <Area type="monotone" dataKey="Câmbio" stroke={CORES_SERIES[5]} fill={CORES_SERIES[5]} fillOpacity={0.4} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>
        );
      })()}

      <p className="text-xs text-zinc-500">
        Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
