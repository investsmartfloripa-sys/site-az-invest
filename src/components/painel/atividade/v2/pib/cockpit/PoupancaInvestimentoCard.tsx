"use client";

/**
 * COCKPIT PIB — taxa de poupança bruta × taxa de investimento (FBCF), ambas em
 * % do PIB nominal (SIDRA 6726 v9774 / 6727 v2517), no painel de cima; B.9 =
 * capacidade (+) / necessidade (−) líquida de financiamento em % do PIB (SIDRA
 * 2072) no painel de baixo, lido da própria 2072 — nunca FBCF − poupança.
 * Toggle mm4T (default, pela sazonalidade forte da poupança) ↔ trimestral.
 * Molde: JurosInflacaoCrescimentoCard (dois AzTimeSeriesChart empilhados).
 */

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, CockpitChip, type AzSegmentedOption } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import {
  AzTimeSeriesChart,
  type AzRefLine,
  type AzSeriesPoint,
  type AzTimeSeries,
} from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { codaceAreas, fmtTrimCurto, mmPoints, num, toPointsTrim } from "../../shared";

/** Chaves literais das contas da 2072 (rótulos do IBGE, como o builder grava). */
const CHAVE_B9 = "(=) Capacidade / necessidade líquida de financiamento";
const CHAVE_FBC = "(-) Formação bruta de capital";
const CHAVE_POUPANCA = "(=) Poupança bruta";
const CHAVE_CESSAO = "(+) Cessão de ativos não financeiros não produzidos (aquisições líquidas)";
const CHAVE_TRANSF_CAPITAL = "(+) Transferências de capital (líquidas recebidas do exterior)";

const JANELA_MM = 4;

type ModoId = "mm4T" | "trim";

const OPCOES_MODO: AzSegmentedOption[] = [
  { id: "mm4T", label: "mm4T" },
  { id: "trim", label: "Trimestral" },
];

/** Linha do zero no painel do B.9 (divide capacidade de necessidade de financiamento). */
const REF_ZERO: AzRefLine[] = [{ y: 0, color: AZ_CHART.zero, dashed: true }];

type Ultimo = { trim: string; valor: number };

/** Último ponto {trim, valor} não-nulo de uma série 6726/6727. */
function ultimoTaxa(serie: ReadonlyArray<{ trim: string; valor: number | null }> | undefined): Ultimo | null {
  if (!serie) return null;
  for (let i = serie.length - 1; i >= 0; i--) {
    const v = serie[i].valor;
    if (typeof v === "number" && Number.isFinite(v)) return { trim: serie[i].trim, valor: v };
  }
  return null;
}

/** Último valor não-nulo de uma conta da 2072 (% PIB). */
function ultimoConta(rows: ReadonlyArray<Record<string, unknown> & { trim: string }>, chave: string): Ultimo | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = num(rows[i], chave);
    if (v != null) return { trim: rows[i].trim, valor: v };
  }
  return null;
}

/** Último valor de uma série de pontos (já na transformação exibida). */
function ultimoPonto(points: ReadonlyArray<AzSeriesPoint>): number | null {
  return points.length > 0 ? points[points.length - 1][1] : null;
}

export function PoupancaInvestimentoCard({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });
  const [modo, setModo] = useState<ModoId>("mm4T");

  const seriePoup = pib.taxa_poupanca?.serie;
  const serieInv = pib.taxa_investimento?.serie;
  const contas = pib.contas_economicas_pct_pib?.serie;
  const sazonalidade = pib.taxa_poupanca?.sazonalidade;

  // Pontos brutos (trimestrais, mês central do trimestre).
  const brutos = useMemo(
    () => ({
      poup: seriePoup ? toPointsTrim(seriePoup, "valor") : [],
      inv: serieInv ? toPointsTrim(serieInv, "valor") : [],
      b9: contas ? toPointsTrim(contas, CHAVE_B9) : [],
    }),
    [seriePoup, serieInv, contas],
  );

  // Pontos na transformação exibida (mm4T calculada no cliente ou trimestral publicada).
  const exibidos = useMemo(() => {
    if (modo === "trim") return brutos;
    return {
      poup: mmPoints(brutos.poup, JANELA_MM),
      inv: mmPoints(brutos.inv, JANELA_MM),
      b9: mmPoints(brutos.b9, JANELA_MM),
    };
  }, [brutos, modo]);

  const { seriesTopo, seriesBaixo, minIso, maxIso } = useMemo(() => {
    const topo: AzTimeSeries[] = [
      { id: "poupanca", label: "Poupança bruta / PIB", color: AZ_BRAND.navy, data: exibidos.poup },
      { id: "investimento", label: "FBCF / PIB", color: AZ_BRAND.azure, data: exibidos.inv },
    ];
    const baixo: AzTimeSeries[] = [
      { id: "b9", label: "B.9 — capac. (+) / necess. (−) de financiamento", color: AZ_BRAND.rust, data: exibidos.b9 },
    ];
    const inicios = [exibidos.poup[0]?.[0], exibidos.inv[0]?.[0], exibidos.b9[0]?.[0]].filter((s): s is string => !!s);
    const fins = [
      exibidos.poup[exibidos.poup.length - 1]?.[0],
      exibidos.inv[exibidos.inv.length - 1]?.[0],
      exibidos.b9[exibidos.b9.length - 1]?.[0],
    ].filter((s): s is string => !!s);
    return {
      seriesTopo: topo,
      seriesBaixo: baixo,
      minIso: inicios.length > 0 ? inicios.reduce((a, b) => (a < b ? a : b)) : "",
      maxIso: fins.length > 0 ? fins.reduce((a, b) => (a > b ? a : b)) : "",
    };
  }, [exibidos]);

  const faixasCodace = useMemo(() => codaceAreas(codace?.trimestral), [codace]);

  // Últimos valores publicados (trimestrais) — os números dos chips.
  const ultPoup = useMemo(() => ultimoTaxa(seriePoup), [seriePoup]);
  const ultInv = useMemo(() => ultimoTaxa(serieInv), [serieInv]);
  const ultFbc = useMemo(() => (contas ? ultimoConta(contas, CHAVE_FBC) : null), [contas]);
  const ultB9 = useMemo(() => (contas ? ultimoConta(contas, CHAVE_B9) : null), [contas]);

  // Identidade da 2072 no último trimestre (p/ o ?): B.9 = poupança − FBC + cessão + transf. de capital.
  const identidade = useMemo(() => {
    if (!contas || contas.length === 0) return null;
    const r = contas[contas.length - 1];
    return {
      trim: r.trim,
      poup: num(r, CHAVE_POUPANCA),
      fbc: num(r, CHAVE_FBC),
      cessao: num(r, CHAVE_CESSAO),
      transf: num(r, CHAVE_TRANSF_CAPITAL),
      b9: num(r, CHAVE_B9),
    };
  }, [contas]);

  // Valores mm4T no último ponto (só p/ complementar o chip quando o toggle está em mm4T).
  const mmPoup = modo === "mm4T" ? ultimoPonto(exibidos.poup) : null;
  const mmInv = modo === "mm4T" ? ultimoPonto(exibidos.inv) : null;
  const mmB9 = modo === "mm4T" ? ultimoPonto(exibidos.b9) : null;

  const trimRef = ultPoup?.trim ?? ultInv?.trim ?? ultB9?.trim ?? null;
  const sufixoTrim = (t: string | null | undefined) => (t && t !== trimRef ? ` (${fmtTrimCurto(t)})` : "");

  const temDado = brutos.poup.length > 0 || brutos.inv.length > 0;

  // Proxy ingênuo do B.9 na MESMA convenção de sinal (capacidade = poupança − investimento):
  // poupança − FBCF. Só p/ mostrar no ? por que ele NÃO é o B.9 (FBCF exclui estoques).
  const difIngenua = ultInv && ultPoup ? +(ultPoup.valor - ultInv.valor).toFixed(2) : null;
  // Variação de estoques implícita = FBC (2072) − FBCF (6727), em p.p. do PIB.
  const estoquesPp = ultFbc && ultInv ? +(ultFbc.valor - ultInv.valor).toFixed(2) : null;

  const sazonTexto =
    sazonalidade && ["Q1", "Q2", "Q3", "Q4"].some((q) => num(sazonalidade, q) != null)
      ? ["Q1", "Q2", "Q3", "Q4"]
          .map((q, i) => `${i + 1}T ${fmtPct(num(sazonalidade, q), 1)}`)
          .join(" · ")
      : "—";

  const footer = (
    <div className="space-y-1.5">
      <p>
        <strong>Taxa de poupança bruta</strong> = poupança bruta ÷ PIB (SIDRA 6726, variável 9774);{" "}
        <strong>taxa de investimento</strong> = FBCF ÷ PIB (SIDRA 6727, variável 2517). Ambas em % do PIB nominal a
        preços correntes, sem ajuste sazonal, série trimestral do IBGE (6726 desde 2000, 6727 desde 1996).{" "}
        <strong>FBCF</strong> = formação bruta de capital fixo (máquinas, construção, ativos intangíveis);{" "}
        <strong>FBC</strong> = FBCF + variação de estoques.
      </p>
      <p>
        <strong>mm4T</strong> (default) = média móvel de 4 trimestres, calculada no cliente — remove a sazonalidade da
        poupança, que é forte: média por trimestre da 6726 desde 2000 = {sazonTexto} (o 4T cai porque o consumo das
        famílias sobe no fim do ano). <strong>Trimestral</strong> = o número publicado, tal qual. Os chips carregam
        sempre o valor trimestral publicado{modo === "mm4T" ? " e, após o separador, o mm4T em que a linha termina" : ""}.
      </p>
      <p>
        <strong>B.9</strong> = capacidade (+) / necessidade (−) líquida de financiamento, saldo final das contas
        econômicas integradas (SIDRA 2072 em % do PIB): B.9 = poupança bruta − FBC + cessão de ativos não produzidos
        + transferências de capital.{" "}
        {identidade ? (
          <>
            No {fmtTrimCurto(identidade.trim)}: {fmtNum(identidade.poup, 2)} − {fmtNum(identidade.fbc, 2)} +{" "}
            ({fmtNum(identidade.cessao, 2)}) + ({fmtNum(identidade.transf, 2)}) = {fmtSignedPct(identidade.b9, 2)} do
            PIB.
          </>
        ) : null}{" "}
        <strong>Não aproxime o B.9 por poupança − FBCF</strong> (nem pelo inverso, FBCF − poupança): a conta usa FBCF,
        que exclui a variação de estoques, e ignora as contas de capital
        {difIngenua != null && ultB9 ? (
          <>
            {" "}
            — no {fmtTrimCurto(ultB9.trim)}, poupança − FBCF daria {fmtSignedPct(difIngenua, 1)}, contra B.9 de{" "}
            {fmtSignedPct(ultB9.valor, 2)}
            {Math.sign(difIngenua) !== Math.sign(ultB9.valor) ? " (sinal oposto)" : ""}
            {estoquesPp != null ? `; a diferença é a variação de estoques, FBC − FBCF = ${fmtSignedNum(estoquesPp, 1)} p.p. do PIB` : ""}
          </>
        ) : null}
        . Por isso o painel de baixo lê a 2072 diretamente. Sinal negativo = o país investe mais do que poupa e
        financia a diferença com poupança externa (déficit em transações correntes); positivo = poupa mais do que
        investe.
      </p>
      <p>
        Faixas verticais cinzas = recessões datadas pelo CODACE/FGV (cronologia oficial, atualizada com defasagem). A
        linha tracejada do zero no painel de baixo só aparece quando a janela contém valores dos dois sinais (o eixo
        segue os dados). A 2072 em % do PIB começa em 2006-T03 no Blob; a variação de estoques não tem série em volume
        (o IBGE só a publica em % do PIB, SIDRA 1846, e em R$ correntes) e por isso não há série trimestral de FBC em
        volume.
      </p>
    </div>
  );

  return (
    <ChartCard
      id="pib-poupanca-investimento"
      title="Poupança × investimento × B.9 (% PIB)"
      subtitle="SIDRA 6726 / 6727 / 2072 · painel de cima: taxa de poupança bruta e taxa de investimento (FBCF/PIB) e FBCF/PIB, média móvel de 4 trimestres (default) ou trimestral · painel de baixo: capacidade (+) / necessidade (−) líquida de financiamento em % do PIB"
      toolbar={
        <>
          <AzSegmented
            size="sm"
            ariaLabel="Transformação das taxas de poupança e investimento"
            value={modo}
            onChange={(id) => setModo(id as ModoId)}
            options={OPCOES_MODO}
          />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso || undefined}
            max={maxIso || undefined}
            periods={["5y", "10y", "max"]}
          />
        </>
      }
      footer={footer}
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip cor={AZ_BRAND.navy} title="Taxa de poupança bruta (SIDRA 6726 v9774) — último trimestre publicado">
          {ultPoup
            ? `poupança ${fmtPct(ultPoup.valor, 1)} PIB (${fmtTrimCurto(ultPoup.trim)})${
                mmPoup != null ? ` · mm4T ${fmtPct(mmPoup, 1)}` : ""
              }`
            : "poupança —"}
        </CockpitChip>
        <CockpitChip cor={AZ_BRAND.azure} title="Taxa de investimento = FBCF / PIB (SIDRA 6727 v2517)">
          {ultInv
            ? `FBCF ${fmtPct(ultInv.valor, 1)}${sufixoTrim(ultInv.trim)}${mmInv != null ? ` · mm4T ${fmtPct(mmInv, 1)}` : ""}`
            : "FBCF —"}
        </CockpitChip>
        <CockpitChip cor={AZ_CHART.ticks} title="Formação bruta de capital = FBCF + variação de estoques (SIDRA 2072, % PIB)">
          {ultFbc ? `FBC ${fmtPct(ultFbc.valor, 1)}${sufixoTrim(ultFbc.trim)}` : "FBC —"}
        </CockpitChip>
        <CockpitChip
          cor={AZ_BRAND.rust}
          title="B.9 = capacidade (+) / necessidade (−) líquida de financiamento (SIDRA 2072, % PIB)"
        >
          {ultB9
            ? `B.9 ${fmtSignedPct(ultB9.valor, 1)} PIB${sufixoTrim(ultB9.trim)}${mmB9 != null ? ` · mm4T ${fmtSignedPct(mmB9, 1)}` : ""}`
            : "B.9 —"}
        </CockpitChip>
      </div>

      {!temDado ? (
        <p className="flex h-[200px] items-center justify-center text-sm text-zinc-400">
          — as tabelas 6726/6727 não estão nesta geração do Blob.
        </p>
      ) : (
        <>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Poupança bruta × FBCF (% PIB) · {modo === "mm4T" ? "média móvel 4T" : "trimestral"}
          </p>
          <AzTimeSeriesChart
            series={seriesTopo}
            unit="%"
            period={period}
            height={200}
            xRefAreas={faixasCodace}
            showLegend
            yAxisLabel="% PIB"
            variant="default"
          />
        </>
      )}

      <p className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        B.9 — capacidade (+) / necessidade (−) líquida de financiamento (% PIB) ·{" "}
        {modo === "mm4T" ? "média móvel 4T" : "trimestral"}
      </p>
      {brutos.b9.length === 0 ? (
        <p className="flex h-[110px] items-center justify-center text-sm text-zinc-400">
          — a 2072 em % do PIB não está nesta geração do Blob.
        </p>
      ) : (
        <AzTimeSeriesChart
          series={seriesBaixo}
          unit="%"
          period={period}
          height={110}
          xRefAreas={faixasCodace}
          refLines={REF_ZERO}
          showLegend={false}
          yAxisLabel="% PIB"
          variant="default"
        />
      )}
    </ChartCard>
  );
}
