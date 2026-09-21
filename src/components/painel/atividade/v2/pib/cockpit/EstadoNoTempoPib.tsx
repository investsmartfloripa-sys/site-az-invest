"use client";

import { useMemo, useState } from "react";

import { AzSegmented, ChartCard, CockpitChip, MiniSpark } from "@/components/painel/core";
import { AZ_CHART, variationFill, variationText } from "@/lib/az-chart-theme";
import { fmtPct, fmtSignedPct } from "@/lib/format-br";
import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { fmtTrimCurto } from "../../shared";
import {
  BANDA_ESTAVEL_PP,
  RECORTES_DEMANDA,
  RECORTES_OFERTA,
  ROTULO_CURTO,
  difusao,
  lentePib,
  rotuloRecorte,
  seriePib,
  ultimoPib,
  type LentePibId,
} from "../cockpit-shared";
import { LupaPibCard } from "./LupaPibCard";

/**
 * Estado no tempo (cockpit do PIB): grade de small multiples com os 12 recortes-
 * folha da oferta e os 5 da demanda (SIDRA 5932). Cada tile traz o último valor
 * da métrica ativa (QoQ SA | YoY), o peso do recorte no PIB nominal (SIDRA 1846)
 * e uma sparkline dos 20 trimestres mais recentes; clicar abre a LupaPibCard do
 * recorte abaixo do grupo. Análogo do SemaforoTempoGrid do cockpit fiscal.
 */

type MetricaId = Extract<LentePibId, "qoq_sa" | "yoy">;

const METRICAS: { id: MetricaId; label: string }[] = [
  { id: "qoq_sa", label: "QoQ SA" },
  { id: "yoy", label: "YoY" },
];

/** Quantos trimestres a sparkline do tile cobre (5 anos). */
const SPARK_N = 20;

type Tile = {
  key: string;
  rotulo: string;
  rotuloLongo: string;
  ultimo: { trim: string; valor: number } | null;
  peso: { trim: string; valor: number } | null;
  spark: ReadonlyArray<readonly [string, number]>;
};

const OFERTA_FOLHAS = RECORTES_OFERTA.filter((r) => r.folha).map((r) => r.key);
const DEMANDA_FOLHAS = RECORTES_DEMANDA.filter((r) => r.folha).map((r) => r.key);
/**
 * Todos os recortes de cada grupo (folhas + agregados + estoques). A lupa aberta
 * tem um seletor com os 23 recortes; se o usuário trocar para um agregado
 * ("pib", "industria", "variacao_estoque"…) a lupa continua ancorada no grupo
 * do recorte — só não há tile destacado, porque agregados vivem nas tabelas.
 */
const OFERTA_KEYS = RECORTES_OFERTA.map((r) => r.key);
const DEMANDA_KEYS = RECORTES_DEMANDA.map((r) => r.key);

function montarTiles(pib: AtividadePibData, metrica: MetricaId, keys: readonly string[]): Tile[] {
  const lente = lentePib(metrica);
  const lentePeso = lentePib("pct_pib");
  return keys.map((key) => ({
    key,
    rotulo: ROTULO_CURTO[key] ?? key,
    rotuloLongo: rotuloRecorte(pib, key),
    ultimo: ultimoPib(pib, lente, key),
    peso: ultimoPib(pib, lentePeso, key),
    spark: seriePib(pib, lente, key).slice(-SPARK_N),
  }));
}

function textoDifusao(d: { sobe: number; estavel: number; cai: number }): string {
  const s = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;
  return `${s(d.sobe, "sobe", "sobem")} · ${s(d.estavel, "estável", "estáveis")} · ${s(d.cai, "cai", "caem")}`;
}

function TileButton({
  tile,
  metricaLabel,
  selecionado,
  onClick,
}: {
  tile: Tile;
  metricaLabel: string;
  selecionado: boolean;
  onClick: () => void;
}) {
  const v = tile.ultimo?.valor ?? null;
  const corValor = v == null ? AZ_CHART.ticks : variationText(v, BANDA_ESTAVEL_PP);
  const corPonto = v == null ? AZ_CHART.ticks : variationFill(v, BANDA_ESTAVEL_PP);
  const tituloTip = [
    tile.rotuloLongo,
    tile.ultimo ? `${metricaLabel} ${fmtSignedPct(tile.ultimo.valor)} (${fmtTrimCurto(tile.ultimo.trim)})` : `${metricaLabel} —`,
    tile.peso ? `peso ${fmtPct(tile.peso.valor)} do PIB nominal (${fmtTrimCurto(tile.peso.trim)})` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      title={tituloTip}
      aria-pressed={selecionado}
      className={`group flex min-w-0 cursor-pointer flex-col rounded-xl border bg-white p-3 text-left shadow-sm transition ${
        selecionado ? "border-[#027DFC] ring-1 ring-[#027DFC]/40" : "border-[#132960]/10 hover:border-[#027DFC]/60"
      }`}
    >
      <span className="text-[11px] font-semibold leading-tight text-[#132960]">{tile.rotulo}</span>
      <div className="mt-1 text-lg font-bold tabular-nums leading-tight" style={{ color: corValor }}>
        {v == null ? "—" : fmtSignedPct(v)}
      </div>
      <div className="text-[10px] tabular-nums text-zinc-500">
        {tile.peso ? `peso ${fmtPct(tile.peso.valor)} do PIB` : "peso —"}
      </div>
      <div className="mt-1.5">
        <MiniSpark data={tile.spark} height={44} zeroLine lastDotColor={corPonto} />
        <div className="mt-1 text-[9px] uppercase tracking-wide text-zinc-400 transition-colors group-hover:text-[#027DFC]">
          {selecionado ? "fechar" : "ver série ↗"}
        </div>
      </div>
    </button>
  );
}

export function EstadoNoTempoPib({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [metrica, setMetrica] = useState<MetricaId>("qoq_sa");
  const [aberto, setAberto] = useState<string | null>(null);
  // Mobile (<md): o grupo Oferta começa colapsado; em ≥md a grade aparece sempre.
  const [ofertaExpandida, setOfertaExpandida] = useState(false);

  const metricaLabel = METRICAS.find((m) => m.id === metrica)?.label ?? metrica;

  const tilesOferta = useMemo(() => montarTiles(pib, metrica, OFERTA_FOLHAS), [pib, metrica]);
  const tilesDemanda = useMemo(() => montarTiles(pib, metrica, DEMANDA_FOLHAS), [pib, metrica]);

  const trimRef = pib.trim_recente;

  // Difusão só com valores DO trimestre de referência: um recorte cujo último
  // valor não-nulo for de trimestre anterior não entra na contagem do chip.
  const difOferta = useMemo(
    () => difusao(tilesOferta.map((t) => (t.ultimo?.trim === trimRef ? t.ultimo.valor : null)), BANDA_ESTAVEL_PP),
    [tilesOferta, trimRef],
  );
  const difDemanda = useMemo(
    () => difusao(tilesDemanda.map((t) => (t.ultimo?.trim === trimRef ? t.ultimo.valor : null)), BANDA_ESTAVEL_PP),
    [tilesDemanda, trimRef],
  );

  const abertoOferta = aberto && OFERTA_KEYS.includes(aberto) ? aberto : null;
  const abertoDemanda = aberto && DEMANDA_KEYS.includes(aberto) ? aberto : null;

  const alternarTile = (key: string) => setAberto((atual) => (atual === key ? null : key));

  const alternarOferta = () => {
    // Ao colapsar o grupo no mobile, fecha a lupa de um tile da oferta.
    if (ofertaExpandida && abertoOferta) setAberto(null);
    setOfertaExpandida(!ofertaExpandida);
  };

  const gridClass = "grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6";

  return (
    <ChartCard
      id="pib-estado-no-tempo"
      title="Estado no tempo — oferta e demanda"
      subtitle="SIDRA 5932 · 12 atividades da oferta · 5 componentes da demanda · tile = último valor da métrica ativa · peso no PIB nominal · sparkline de 20 trimestres · clique abre a lupa do recorte"
      toolbar={
        <AzSegmented
          options={METRICAS}
          value={metrica}
          onChange={(id) => setMetrica(id === "yoy" ? "yoy" : "qoq_sa")}
          ariaLabel="Métrica dos tiles"
        />
      }
      stampGiro={geradoEm}
      stampDado={trimRef}
      footer={
        <span>
          <strong>Leitura.</strong> Cada tile mostra o último valor da métrica ativa para um recorte das Contas
          Nacionais Trimestrais (SIDRA 5932). QoQ SA = variação real vs trimestre anterior, com ajuste sazonal; YoY =
          variação real vs mesmo trimestre do ano anterior. Verde = subiu, vermelho = caiu, azul = dentro da banda
          ±0,05 p.p. — direção literal do número, sem juízo de bom/ruim. A linha &quot;peso&quot; é a participação do
          recorte no PIB nominal a preços correntes no último trimestre (SIDRA 1846). A sparkline cobre os {SPARK_N}{" "}
          trimestres mais recentes (5 anos) da métrica ativa, com a régua do zero; o ponto final repete a cor do valor.
          <br />
          <br />
          <strong>Difusão (cálculo próprio).</strong> Os chips contam, entre as 12 atividades da oferta e os 5
          componentes da demanda, quantos sobem (valor &gt; +0,05 p.p.), ficam estáveis (|valor| ≤ 0,05 p.p.) e caem
          (valor &lt; −0,05 p.p.) na métrica ativa — banda de ±0,05 p.p. compatível com a casa decimal única do IBGE.
          É contagem, não média ponderada.
          <br />
          <br />
          <strong>Curadoria.</strong> Os agregados (indústria total, serviços total, valor adicionado, impostos
          líquidos sobre produtos e o próprio PIB) não viram tile: são subtotais dos mesmos números e vivem nas
          tabelas mestras. A variação de estoques só existe em % do PIB nominal (a 5932/1621/6613 não publicam este
          recorte), por isso não entra na grade de variações. Clicar num tile abre a lupa do recorte (todas as lentes,
          com seletor de período) abaixo do grupo; um tile aberto por vez. Se, dentro da lupa, o recorte for trocado
          para um agregado ou para estoques, a lupa permanece sob o grupo correspondente, sem tile destacado.
        </span>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip
          tom="navy"
          title={`Difusão nas ${tilesOferta.length} atividades da oferta (cálculo próprio, banda ±0,05 p.p.)`}
        >
          {fmtTrimCurto(trimRef)} · {metricaLabel} · oferta · {textoDifusao(difOferta)}
        </CockpitChip>
        <CockpitChip
          tom="navy"
          title={`Difusão nos ${tilesDemanda.length} componentes da demanda (cálculo próprio, banda ±0,05 p.p.)`}
        >
          {fmtTrimCurto(trimRef)} · {metricaLabel} · demanda · {textoDifusao(difDemanda)}
        </CockpitChip>
      </div>

      <div className="space-y-6">
        {/* OFERTA */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#132960]">
              Oferta — {tilesOferta.length} atividades
            </h3>
            <button
              type="button"
              onClick={alternarOferta}
              aria-expanded={ofertaExpandida}
              className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#132960] transition-colors hover:bg-zinc-50 md:hidden"
            >
              {ofertaExpandida ? "ocultar atividades" : `ver ${tilesOferta.length} atividades`}
            </button>
          </div>
          <div className={`${ofertaExpandida ? "grid" : "hidden md:grid"} ${gridClass}`}>
            {tilesOferta.map((t) => (
              <TileButton
                key={t.key}
                tile={t}
                metricaLabel={metricaLabel}
                selecionado={abertoOferta === t.key}
                onClick={() => alternarTile(t.key)}
              />
            ))}
          </div>
          {abertoOferta ? (
            <div className="mt-3">
              <LupaPibCard
                pib={pib}
                codace={codace}
                geradoEm={geradoEm}
                recorte={abertoOferta}
                onRecorteChange={setAberto}
                lente={metrica}
              />
            </div>
          ) : null}
        </div>

        {/* DEMANDA */}
        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#132960]">
            Demanda — {tilesDemanda.length} componentes
          </h3>
          <div className={`grid ${gridClass}`}>
            {tilesDemanda.map((t) => (
              <TileButton
                key={t.key}
                tile={t}
                metricaLabel={metricaLabel}
                selecionado={abertoDemanda === t.key}
                onClick={() => alternarTile(t.key)}
              />
            ))}
          </div>
          {abertoDemanda ? (
            <div className="mt-3">
              <LupaPibCard
                pib={pib}
                codace={codace}
                geradoEm={geradoEm}
                recorte={abertoDemanda}
                onRecorteChange={setAberto}
                lente={metrica}
              />
            </div>
          ) : null}
        </div>
      </div>
    </ChartCard>
  );
}
