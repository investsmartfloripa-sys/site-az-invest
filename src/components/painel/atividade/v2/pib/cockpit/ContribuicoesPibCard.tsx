"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AtividadeCodaceData, AtividadePibData, CodaceFaixaAtividade, PibContribPonto } from "@/lib/painel-atividade";
import {
  AzSegmented,
  AzTooltip,
  ChartCard,
  CockpitChip,
  azGridProps,
  azXAxisProps,
  azYAxisProps,
  azZeroLineProps,
  tomPorSinal,
} from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_SERIES, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { fmtTrimCurto, num, trimIsoCentral } from "../../shared";
import { ROTULO_CURTO } from "../cockpit-shared";

/**
 * COCKPIT do PIB — contribuições ao crescimento YoY em pontos percentuais.
 * Barras empilhadas por ótica (demanda | oferta) + linha do PIB YoY, com
 * recessões CODACE sombreadas. Contribuição = peso nominal do mesmo trimestre
 * do ano anterior (SIDRA 1846, t−4) × variação real YoY (SIDRA 5932), gravada
 * pelo builder no bloco `contribuicoes` (importações já com sinal trocado; o
 * resíduo absorve a não-aditividade do encadeamento e, na demanda, os estoques).
 */

type Otica = "demanda" | "oferta";

const OFERTA_KEYS = ["oferta_agro", "oferta_industria", "oferta_servicos", "oferta_impostos", "oferta_residuo"] as const;
const DEMANDA_KEYS = [
  "demanda_consumo_familias",
  "demanda_consumo_governo",
  "demanda_fbcf",
  "demanda_exportacoes",
  "demanda_importacoes",
  "demanda_residuo",
] as const;

type ContribKey = (typeof OFERTA_KEYS)[number] | (typeof DEMANDA_KEYS)[number];

/** Rótulos curtos (legenda a 10px em card de meia largura). */
const KEY_LABEL: Record<ContribKey, string> = {
  oferta_agro: ROTULO_CURTO.agro,
  oferta_industria: ROTULO_CURTO.industria,
  oferta_servicos: ROTULO_CURTO.servicos,
  oferta_impostos: ROTULO_CURTO.impostos,
  oferta_residuo: "Resíduo",
  demanda_consumo_familias: ROTULO_CURTO.consumo_familias,
  demanda_consumo_governo: ROTULO_CURTO.consumo_governo,
  demanda_fbcf: ROTULO_CURTO.fbcf,
  demanda_exportacoes: ROTULO_CURTO.exportacoes,
  demanda_importacoes: "Importações (−)",
  demanda_residuo: "Estoques + resíduo",
};

const RESIDUO_KEY: Record<Otica, ContribKey> = { demanda: "demanda_residuo", oferta: "oferta_residuo" };
const RESIDUO_CHIP_LABEL: Record<Otica, string> = { demanda: "estoques + resíduo", oferta: "resíduo" };

/** Resíduo em slate (última cor da paleta categórica) — as demais ciclam a AZ_SERIES. */
const RESIDUO_COLOR = AZ_SERIES[7];

/** Paleta das barras SEM o navy (índice 1), reservado à linha do PIB YoY, e sem o slate do resíduo. */
const CORES_PILHA = [AZ_SERIES[0], AZ_SERIES[2], AZ_SERIES[3], AZ_SERIES[4], AZ_SERIES[5], AZ_SERIES[6]] as const;

function corDaPilha(key: ContribKey, i: number): string {
  if (key.endsWith("_residuo")) return RESIDUO_COLOR;
  return CORES_PILHA[i % CORES_PILHA.length];
}

/** Faixas CODACE trimestrais ("2014-Q1") → chaves de trim do eixo categórico, clipadas à janela visível. */
function codaceTrims(faixas: ReadonlyArray<CodaceFaixaAtividade> | undefined, trims: ReadonlyArray<string>): { x1: string; x2: string }[] {
  if (!faixas || trims.length === 0) return [];
  const out: { x1: string; x2: string }[] = [];
  for (const f of faixas) {
    if (f.tipo !== "recessao") continue;
    const pico = f.pico.replace(/-Q(\d)$/, (_, q: string) => `-T0${q}`);
    const vale = f.vale.replace(/-Q(\d)$/, (_, q: string) => `-T0${q}`);
    if (vale < trims[0] || pico > trims[trims.length - 1]) continue;
    const x1 = trims.find((t) => t >= pico) ?? trims[0];
    const x2 = [...trims].reverse().find((t) => t <= vale) ?? trims[trims.length - 1];
    if (x1 <= x2) out.push({ x1, x2 });
  }
  return out;
}

const SERIE_VAZIA: ReadonlyArray<PibContribPonto> = [];

export function ContribuicoesPibCard({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [otica, setOtica] = useState<Otica>("demanda");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const serie = pib.contribuicoes?.serie ?? SERIE_VAZIA;
  const minIso = serie.length > 0 ? trimIsoCentral(serie[0].trim) : "";
  const maxIso = serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : "";
  const codaceTrimestral = codace?.trimestral;

  // Janela visível e faixas CODACE no MESMO memo — a lista de trims visíveis
  // não vaza como dependência instável (array novo a cada render).
  const { rows, faixas } = useMemo(() => {
    if (serie.length === 0) return { rows: [] as PibContribPonto[], faixas: [] as { x1: string; x2: string }[] };
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    const visiveis = serie.filter((r) => {
      const iso = trimIsoCentral(r.trim);
      return iso >= from && iso <= to;
    });
    return { rows: visiveis, faixas: codaceTrims(codaceTrimestral, visiveis.map((r) => r.trim)) };
  }, [serie, period, minIso, maxIso, codaceTrimestral]);

  const keys: ReadonlyArray<ContribKey> = otica === "demanda" ? DEMANDA_KEYS : OFERTA_KEYS;

  // Estado do último trimestre: PIB YoY, maior componente (maior valor com
  // sinal, excl. resíduo) e o resíduo — que vira chip quando |resíduo| ≥ maior.
  const ult = serie.length > 0 ? serie[serie.length - 1] : null;
  const estado = useMemo(() => {
    if (!ult) return null;
    let top: { key: ContribKey; v: number } | null = null;
    for (const k of keys) {
      if (k.endsWith("_residuo")) continue;
      const v = num(ult, k);
      if (v != null && (top == null || v > top.v)) top = { key: k, v };
    }
    const residuo = num(ult, RESIDUO_KEY[otica]);
    const residuoDomina = residuo != null && top != null && Math.abs(residuo) >= Math.abs(top.v);
    return { pibYoy: num(ult, "pib_yoy"), top, residuo, residuoDomina };
  }, [ult, keys, otica]);

  return (
    <ChartCard
      id="contribuicoes-pib-cockpit"
      title="Contribuições ao PIB YoY (p.p.)"
      subtitle="SIDRA 1846 × 5932 · peso nominal t−4 × variação real · barras empilhadas por ótica (Demanda: C · G · FBCF · X · −M · estoques+resíduo | Oferta: agro · indústria · serviços · impostos · resíduo) · linha = PIB YoY"
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Ótica da decomposição"
            options={[
              { id: "demanda", label: "Demanda" },
              { id: "oferta", label: "Oferta" },
            ]}
            value={otica}
            onChange={(id) => setOtica(id as Otica)}
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
      footer={
        <div className="space-y-1.5">
          <p>
            <strong>Fórmula:</strong> contribuição do componente <em>i</em> no trimestre <em>t</em> = (peso nominal de{" "}
            <em>i</em> no PIB em <em>t−4</em>, mesmo trimestre do ano anterior, SIDRA 1846) × (variação real YoY de{" "}
            <em>i</em>, SIDRA 5932). YoY = vs mesmo trimestre do ano anterior; p.p. = pontos percentuais. As barras
            empilhadas somam a linha do PIB YoY.
          </p>
          <p>
            <strong>Sinal das importações:</strong> na ótica da demanda, PIB = C + G + FBCF + ΔE + X − M. O builder já
            grava as importações com o sinal trocado: importações crescendo aparecem como barra negativa (subtraem do
            PIB); importações caindo, como barra positiva.
          </p>
          <p>
            <strong>Resíduo:</strong> os índices de volume encadeados (base 1995) não são aditivos — a soma das
            contribuições dos componentes não fecha exatamente na variação do agregado. O resíduo absorve essa
            diferença. Na demanda ele inclui também a variação de estoques (a 5932 não publica volume de estoques,
            só o peso nominal na 1846); na oferta, a diferença entre valor adicionado + impostos e o PIB. Quando o
            resíduo é maior que o maior componente, o chip o destaca — omiti-lo daria uma leitura enganosa do que
            puxou o crescimento.
          </p>
          <p>
            <strong>CODACE:</strong> faixas cinzas = recessões datadas pelo Comitê de Datação de Ciclos Econômicos
            (FGV/IBRE), do pico ao vale. A cronologia é atualizada com anos de defasagem — serve ao contexto histórico,
            não para detectar recessão corrente.
          </p>
        </div>
      }
      stampGiro={geradoEm}
      stampDado={ult ? ult.trim : null}
    >
      {ult && estado ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <CockpitChip tom={tomPorSinal(estado.pibYoy)}>
            PIB YoY {fmtSignedPct(estado.pibYoy, 1)} ({fmtTrimCurto(ult.trim)})
          </CockpitChip>
          {estado.top ? (
            <CockpitChip tom={tomPorSinal(estado.top.v)}>
              maior componente: {KEY_LABEL[estado.top.key]} {fmtSignedNum(estado.top.v, 1)} p.p.
            </CockpitChip>
          ) : null}
          {estado.residuoDomina ? (
            <CockpitChip tom={tomPorSinal(estado.residuo)} title="Resíduo em módulo ≥ maior componente — ver ?">
              {RESIDUO_CHIP_LABEL[otica]} {fmtSignedNum(estado.residuo, 1)} p.p.
            </CockpitChip>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="flex h-[260px] items-center justify-center text-sm text-zinc-400">
          Contribuições indisponíveis nesta carga
        </p>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="trim" tickFormatter={fmtTrimCurto} minTickGap={28} />
              <YAxis {...azYAxisProps()} width={40} tickFormatter={(v: number) => fmtSignedNum(v, 0)} />

              {faixas.map((f, i) => (
                <ReferenceArea key={`codace-${i}`} x1={f.x1} x2={f.x2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
              ))}

              <ReferenceLine {...azZeroLineProps("y")} />

              <Tooltip
                content={
                  <AzTooltip
                    labelFmt={(l) => fmtTrimCurto(String(l))}
                    valueFmt={(v, name) => (name.startsWith("PIB") ? fmtSignedPct(v, 1) : `${fmtSignedNum(v, 2)} p.p.`)}
                  />
                }
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />

              {keys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  name={KEY_LABEL[k]}
                  stackId="contrib"
                  fill={corDaPilha(k, i)}
                  isAnimationActive={false}
                  maxBarSize={22}
                />
              ))}
              <Line
                type="monotone"
                dataKey="pib_yoy"
                name="PIB YoY"
                stroke={AZ_BRAND.navy}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
