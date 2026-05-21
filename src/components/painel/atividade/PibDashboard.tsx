"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type AtividadeIbcBrData,
  type AtividadePibData,
  HORIZONTES_TRIMESTRAIS,
  HORIZONTES_MENSAIS,
  LABELS_PIB_FALLBACK,
  formatTrim,
  formatMes,
  tail,
} from "@/lib/painel-atividade";
import {
  CardHeader,
  CORES_SERIES,
  COR_ACENTO,
  COR_NEGATIVO,
  COR_POSITIVO,
  COR_PRIMARIA,
  Heatmap,
  KPI,
  RankingTable,
  Section,
  Toggle,
  formatDivulgadoEm,
  useHorizonte,
} from "./AtividadeShell";

type Visao = "pib" | "ibcbr";
type Decomposicao = "oferta" | "demanda" | "industria" | "servicos";

const GRUPOS: Record<Decomposicao, { key: string; label: string }[]> = {
  oferta: [
    { key: "agro", label: "Agropecuária" },
    { key: "industria", label: "Indústria total" },
    { key: "servicos", label: "Serviços total" },
  ],
  industria: [
    { key: "industria_extrativa", label: "Extrativa" },
    { key: "industria_transformacao", label: "Transformação" },
    { key: "construcao", label: "Construção" },
    { key: "eletricidade_gas", label: "Eletricidade/Gás" },
  ],
  servicos: [
    { key: "comercio", label: "Comércio" },
    { key: "transporte", label: "Transporte" },
    { key: "informacao", label: "Informação" },
    { key: "financeiras", label: "Financeiras" },
    { key: "outros_servicos", label: "Outros serviços" },
    { key: "imobiliarias", label: "Imobiliárias" },
    { key: "admin_publica", label: "Admin. pública" },
  ],
  demanda: [
    { key: "consumo_familias", label: "Consumo famílias" },
    { key: "consumo_governo", label: "Consumo governo" },
    { key: "fbcf", label: "FBCF (investimento)" },
    { key: "exportacoes", label: "Exportações" },
    { key: "importacoes", label: "Importações" },
  ],
};

export function PibDashboard({
  pib,
  ibcbr,
}: {
  pib: AtividadePibData;
  ibcbr: AtividadeIbcBrData | null;
}) {
  const [visao, setVisao] = useState<Visao>("pib");
  if (visao === "ibcbr" && ibcbr) return <IbcBrView ibcbr={ibcbr} visao={visao} setVisao={setVisao} />;
  return <PibView pib={pib} ibcbrDisponivel={!!ibcbr} visao={visao} setVisao={setVisao} />;
}

function PibView({
  pib,
  ibcbrDisponivel,
  visao,
  setVisao,
}: {
  pib: AtividadePibData;
  ibcbrDisponivel: boolean;
  visao: Visao;
  setVisao: (v: Visao) => void;
}) {
  const labels = pib.labels ?? LABELS_PIB_FALLBACK;
  const trimH = useHorizonte(
    HORIZONTES_TRIMESTRAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "20T (5 anos)",
  );
  const [decomp, setDecomp] = useState<Decomposicao>("oferta");

  const serieFull = pib.variacao.serie;
  const serie = useMemo(() => tail(serieFull, trimH.n), [serieFull, trimH.n]);
  const ultimo = serie[serie.length - 1];

  const yoyPib = ultimo?.yoy_pib as number | null;
  const qoqPib = ultimo?.qoq_sa_pib as number | null;
  const acumAno = ultimo?.acum_ano_pib as number | null;
  const acum4t = ultimo?.acum_4t_pib as number | null;

  const chartData = serie.map((s) => ({
    trim: formatTrim(s.trim),
    qoq: s.qoq_sa_pib,
    yoy: s.yoy_pib,
  }));

  const grupos = GRUPOS[decomp];
  const decompData = serie.map((s) => {
    const r: any = { trim: formatTrim(s.trim) };
    for (const g of grupos) r[g.label] = s[`yoy_${g.key}`];
    return r;
  });

  // PIB R$ correntes do último trim
  const valoresUlt = pib.valores_correntes?.serie?.[pib.valores_correntes.serie.length - 1];
  const pibRs = (valoresUlt?.["pib"] as number | undefined) ?? null;

  // Pesos atuais — converte pra ranking
  const pesosOrdenados = pib.pesos_atuais
    ? Object.entries(pib.pesos_atuais)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
    : [];

  // Ranking ótica oferta (Agro + Indústria total + Indústria detalhe + Serviços detalhe)
  const rankingClassifs = ["agro", "industria_extrativa", "industria_transformacao", "construcao", "eletricidade_gas",
    "comercio", "transporte", "informacao", "financeiras", "outros_servicos", "imobiliarias", "admin_publica"];
  const rankingItems = rankingClassifs.map((k) => ({
    nome: labels[k] ?? k,
    var_yoy: (ultimo?.[`yoy_${k}`] ?? null) as number | null,
    var_mom_sa: (ultimo?.[`qoq_sa_${k}`] ?? null) as number | null,
    var_acum_12m: (ultimo?.[`acum_4t_${k}`] ?? null) as number | null,
  }));

  // Heatmap setores × trimestres (últimos 12 trim, principais setores)
  const heatmapTrims = serie.slice(-12).map((s) => formatTrim(s.trim));
  const heatmapRows = rankingClassifs.map((k) => labels[k] ?? k);
  const heatmapValues = rankingClassifs.map((k) =>
    serie.slice(-12).map((s) => (s[`yoy_${k}`] ?? null) as number | null),
  );

  // Focus — evolução da mediana ao longo do tempo
  const anoAtual = parseInt(pib.trim_recente.slice(0, 4), 10);
  const focusKeys = Object.keys(pib.focus ?? {}).filter((k) => parseInt(k, 10) >= anoAtual - 1).sort();
  const ultimoFocusAtual = pib.focus?.[String(anoAtual)]?.slice(-1)[0];
  const ultimoFocusProximo = pib.focus?.[String(anoAtual + 1)]?.slice(-1)[0];

  // Evolução do Focus (últimos 180 dias da mediana)
  const focusEvolucao: Record<string, { data: string; mediana: number | null }[]> = {};
  for (const ano of focusKeys) {
    const arr = pib.focus[ano] ?? [];
    focusEvolucao[ano] = arr.slice(-180);
  }
  // Merge por data
  const focusChart: any[] = [];
  if (focusKeys.length) {
    const datas = new Set<string>();
    for (const ano of focusKeys) for (const p of focusEvolucao[ano]) datas.add(p.data);
    const datasOrd = [...datas].sort();
    for (const d of datasOrd) {
      const row: any = { data: d };
      for (const ano of focusKeys) {
        const p = focusEvolucao[ano].find((x) => x.data === d);
        if (p) row[`Focus ${ano}`] = p.mediana;
      }
      focusChart.push(row);
    }
  }

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="PIB — Produto Interno Bruto"
        subtitulo="IBGE / Contas Nacionais Trimestrais — variações reais, ótica da oferta e da demanda, PIB nominal em R$ e expectativas Focus."
        divulgadoEm={formatDivulgadoEm(pib.gerado_em)}
        periodoReferencia={formatTrim(pib.trim_recente)}
        rightSlot={
          <Toggle
            value={visao}
            onChange={setVisao}
            options={[
              { value: "pib", label: "PIB trimestral" },
              ...(ibcbrDisponivel ? [{ value: "ibcbr", label: "IBC-Br (mensal)" }] : []),
            ] as any}
          />
        }
      />

      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Var SA (trim/trim ant.)"
          value={qoqPib}
          unit="%"
          trend={typeof qoqPib === "number" ? (qoqPib >= 0 ? "up" : "down") : "neutral"}
          hint="Dessazonalizada — manchete"
        />
        <KPI
          label="Var YoY (trim/4 trim atrás)"
          value={yoyPib}
          unit="%"
          trend={typeof yoyPib === "number" ? (yoyPib >= 0 ? "up" : "down") : "neutral"}
        />
        <KPI label="Acumulada no ano" value={acumAno} unit="%" hint={`Trim atual: ${formatTrim(pib.trim_recente)}`} />
        <KPI label="Acumulada 4 trim." value={acum4t} unit="%" hint="Proxy de PIB anualizado" />
      </div>

      {/* PIB nominal + Focus KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="PIB nominal no trimestre"
          value={pibRs ? (pibRs / 1_000_000).toFixed(2) : null}
          unit="R$ trilhões"
          hint="A preços correntes (sem deflator)"
        />
        <KPI
          label={`Focus ${anoAtual} (mediana)`}
          value={ultimoFocusAtual?.mediana}
          unit="%"
          hint={ultimoFocusAtual ? `Coleta: ${ultimoFocusAtual.data}` : undefined}
        />
        <KPI
          label={`Focus ${anoAtual + 1} (mediana)`}
          value={ultimoFocusProximo?.mediana}
          unit="%"
          hint={ultimoFocusProximo ? `Coleta: ${ultimoFocusProximo.data}` : undefined}
        />
        <KPI
          label="Realizado × Focus"
          value={acumAno !== null && ultimoFocusAtual?.mediana ? (acumAno - ultimoFocusAtual.mediana).toFixed(2) : null}
          unit="pp"
          trend={
            acumAno !== null && ultimoFocusAtual?.mediana
              ? acumAno >= ultimoFocusAtual.mediana
                ? "up"
                : "down"
              : "neutral"
          }
          hint="Acum. no ano − mediana Focus"
        />
      </div>

      {/* Gráfico principal */}
      <Section
        titulo="PIB total — Variação SA (barras) e variação anual (linha)"
        rightSlot={
          <Toggle size="sm" value={trimH.horizonte} onChange={trimH.setHorizonte as any} options={trimH.options as any} />
        }
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="trim" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} unit="%" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="qoq" name="Variação SA trim/trim anterior" fill={COR_ACENTO} radius={[2, 2, 0, 0]} />
            <Line yAxisId="right" dataKey="yoy" type="monotone" name="Variação anual" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Section>

      {/* Decomposição com 4 opções: oferta, indústria, serviços, demanda */}
      <Section
        titulo="Decomposição — variação anual (%) por componente"
        rightSlot={
          <Toggle
            size="sm"
            value={decomp}
            onChange={setDecomp}
            options={[
              { value: "oferta", label: "Ótica oferta" },
              { value: "industria", label: "Indústria detalhe" },
              { value: "servicos", label: "Serviços detalhe" },
              { value: "demanda", label: "Ótica demanda" },
            ]}
          />
        }
        hint={
          decomp === "oferta"
            ? "Decomposição setorial top-level (Agro/Indústria/Serviços). PIB total = soma ponderada por pesos."
            : decomp === "industria"
              ? "Sub-setores da Indústria: extrativa (mineração, petróleo), transformação (manufaturas), construção e utilities."
              : decomp === "servicos"
                ? "Sub-setores de Serviços (7 categorias). Comércio é o maior; Admin pública também tem peso alto."
                : "Componentes da demanda agregada. FBCF (investimento) lidera o ciclo; Importações com sinal invertido contribui negativamente quando sobe."
        }
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={decompData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="trim" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {grupos.map((g, i) => (
              <Line
                key={g.label}
                type="monotone"
                dataKey={g.label}
                stroke={CORES_SERIES[i % CORES_SERIES.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* Heatmap setorial */}
      <Section
        titulo="Heatmap setorial — variação anual (%) por trimestre (últimos 12T)"
        hint="Verde = expansão, vermelho = retração. Permite ver setores liderando ou ficando pra trás."
      >
        <Heatmap rows={heatmapRows} cols={heatmapTrims} values={heatmapValues} />
      </Section>

      {/* Ranking setorial */}
      <Section
        titulo={`Ranking setorial — variação anual no ${formatTrim(pib.trim_recente)}`}
      >
        <RankingTable items={rankingItems} colunaPrincipal="var_yoy" labelPrincipal="Var. anual" />
      </Section>

      {/* Focus histórico */}
      {focusChart.length > 0 && (
        <Section
          titulo="Expectativas Focus — evolução da mediana (últimos ~180 dias)"
          hint="Cada linha mostra a mediana das projeções Focus para um ano. Convergência sugere consenso; divergência mostra ajuste de expectativas."
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={focusChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="data" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(v: any, name: any) =>
                  typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {focusKeys.map((ano, i) => (
                <Line
                  key={ano}
                  type="monotone"
                  dataKey={`Focus ${ano}`}
                  stroke={CORES_SERIES[i % CORES_SERIES.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Pesos do PIB */}
      {pesosOrdenados.length > 0 && (
        <Section
          titulo="Pesos atuais no PIB nominal (% do último trimestre)"
          hint="Estimativa de quanto cada componente representa do PIB nominal corrente, calculada a partir da tabela 1846. Útil pra entender qual setor pesa mais ou pra ponderar mentalmente a importância de variações setoriais."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {pesosOrdenados.slice(0, 12).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                <span className="truncate text-zinc-700" title={labels[k] ?? k}>
                  {labels[k] ?? k}
                </span>
                <span className="ml-2 font-semibold tabular-nums text-[#132960]">{v.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <footer className="text-[11px] text-zinc-500">{pib.metadata.nota}</footer>
    </div>
  );
}

function IbcBrView({
  ibcbr,
  visao,
  setVisao,
}: {
  ibcbr: AtividadeIbcBrData;
  visao: Visao;
  setVisao: (v: Visao) => void;
}) {
  const mesH = useHorizonte(
    HORIZONTES_MENSAIS.map((h) => ({ value: h.label, label: h.label, n: h.n })) as any,
    "60",
  );
  const serie = useMemo(() => tail(ibcbr.serie, mesH.n), [ibcbr.serie, mesH.n]);
  const ultimo = serie[serie.length - 1];

  const chartData = serie.map((s) => ({
    mes: formatMes(s.mes),
    indice_sa: s.indice_sa,
    mm3: s.indice_sa_mm3,
  }));

  const yoyChart = serie.map((s) => ({
    mes: formatMes(s.mes),
    yoy: s.var_yoy,
    yoy_mm3: s.var_yoy_mm3,
  }));

  // Heatmap sazonalidade (var YoY por mês × ano)
  const meses12 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const yoyPorAnoMes: Record<string, (number | null)[]> = {};
  for (const it of ibcbr.serie) {
    const [ano, mes] = it.mes.split("-");
    const idx = parseInt(mes, 10) - 1;
    yoyPorAnoMes[ano] ??= Array(12).fill(null);
    yoyPorAnoMes[ano][idx] = it.var_yoy;
  }
  const anos = Object.keys(yoyPorAnoMes).sort().slice(-8);

  return (
    <div className="space-y-6">
      <CardHeader
        titulo="IBC-Br — Proxy mensal do PIB"
        subtitulo="Índice de Atividade Econômica do BCB. Base 2002=100. Série desde 2003."
        divulgadoEm={formatDivulgadoEm(ibcbr.gerado_em)}
        periodoReferencia={formatMes(ibcbr.mes_recente)}
        rightSlot={
          <Toggle
            value={visao}
            onChange={setVisao}
            options={[
              { value: "pib", label: "PIB trimestral" },
              { value: "ibcbr", label: "IBC-Br (mensal)" },
            ] as any}
          />
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Índice SA" value={ultimo?.indice_sa} hint="Base 2002=100" />
        <KPI
          label="Variação MoM SA"
          value={ultimo?.var_mom}
          unit="%"
          trend={typeof ultimo?.var_mom === "number" ? (ultimo.var_mom >= 0 ? "up" : "down") : "neutral"}
        />
        <KPI
          label="Variação anual"
          value={ultimo?.var_yoy}
          unit="%"
          trend={typeof ultimo?.var_yoy === "number" ? (ultimo.var_yoy >= 0 ? "up" : "down") : "neutral"}
        />
        <KPI
          label="YoY suavizado (MM3m)"
          value={ultimo?.var_yoy_mm3}
          unit="%"
          hint="Tira ruído mensal — leitura de tendência"
        />
      </div>

      <Section
        titulo="IBC-Br — Índice com ajuste sazonal e média móvel 3m"
        rightSlot={
          <Toggle size="sm" value={mesH.horizonte} onChange={mesH.setHorizonte as any} options={mesH.options as any} />
        }
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [v.toFixed(2), String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="indice_sa" name="IBC-Br SA" stroke={COR_PRIMARIA} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="mm3" name="MM3m" stroke={COR_ACENTO} strokeWidth={2} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Section>

      <Section
        titulo="Variação anual mensal — bruta e suavizada"
        hint="A linha tracejada mostra a tendência removendo o ruído mensal."
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={yoyChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(v: any, name: any) =>
                typeof v === "number" ? [`${v.toFixed(2)}%`, String(name)] : [v, String(name)]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="yoy" name="YoY bruto" stroke={COR_ACENTO} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="yoy_mm3" name="YoY MM3m" stroke={COR_PRIMARIA} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {anos.length > 0 && (
        <Section
          titulo="Heatmap — variação anual (%) por mês × ano"
          hint="Verde = expansão ano contra ano. Útil pra ver padrões sazonais e ciclos."
        >
          <Heatmap
            rows={anos}
            cols={meses12}
            values={anos.map((a) => yoyPorAnoMes[a])}
          />
        </Section>
      )}

      <footer className="text-[11px] text-zinc-500">{ibcbr.metadata.nota}</footer>
    </div>
  );
}
