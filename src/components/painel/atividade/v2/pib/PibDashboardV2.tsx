"use client";

import { useMemo, type ReactNode } from "react";

import type { AtividadeCodaceData, AtividadeIbcBrData, AtividadePibData } from "@/lib/painel-atividade";
import { KpiCard } from "@/components/painel/core";
import { fmtSignedPct } from "@/lib/format-br";
import { fmtTrimCurto, num } from "../shared";
import { AnchorContribuicoesPib } from "./AnchorContribuicoesPib";
import { TamanhoEconomiaPib } from "./TamanhoEconomiaPib";
import { RitmoTrimestralCard } from "./RitmoTrimestralCard";
import { IbcBrPibCard } from "./IbcBrPibCard";
import { DecomposicaoPib } from "./DecomposicaoPib";
import { HeatmapSetorialPib } from "./HeatmapSetorialPib";
import { PesoSetorialPib } from "./PesoSetorialPib";
import { ComposicaoVaPib } from "./ComposicaoVaPib";
import { SetorLupaPib } from "./SetorLupaPib";
import { TabelaMestraOfertaPib } from "./TabelaMestraOfertaPib";
import { ComponentesDemandaPib } from "./ComponentesDemandaPib";
import { EstruturaDemandaPib } from "./EstruturaDemandaPib";
import { AberturaComercialPib } from "./AberturaComercialPib";
import { ComponenteLupaDemandaPib } from "./ComponenteLupaDemandaPib";
import { TabelaMestraDemandaPib } from "./TabelaMestraDemandaPib";
import { FocusPibCard } from "./FocusPibCard";
import { RealizadoFocusCard } from "./RealizadoFocusCard";
import { PerCapitaCard } from "./PerCapitaCard";
import { AnaliseCompletaPib } from "./AnaliseCompletaPib";

/**
 * Painel PIB v2 — ESCRUTÍNIO dos dados em cadeia, SEM narrativa/manchete em
 * prosa: KPIs → âncora → blocos numerados → ficha técnica. O título afirmativo
 * de cada card + a pergunta econômica no subtítulo carregam a leitura; nada de
 * storytelling. Duas camadas: leitura rápida em cima, esmiuçamento embaixo.
 */

/** As 5 faces do circuito macro — cada uma é uma seção da página, sem numeração. */
const FACES = [
  { id: "producao", nome: "Produção", sub: "ótica da oferta — quem produz" },
  { id: "demanda", nome: "Demanda", sub: "ótica da despesa — quem gasta" },
  { id: "renda", nome: "Renda", sub: "distribuição da renda e poupança" },
  { id: "financiamento", nome: "Financiamento", sub: "como o país se financia" },
  { id: "sintese", nome: "Síntese", sub: "expectativas e fecho macro" },
] as const;

/** Barra de âncoras (sticky) que salta entre as faces. */
function FaceNav() {
  return (
    <nav className="sticky top-[var(--az-header-h,0px)] z-20 flex flex-wrap gap-1.5 rounded-xl border border-[#132960]/10 bg-white/90 px-2 py-2 backdrop-blur">
      {FACES.map((f) => (
        <a
          key={f.id}
          href={`#${f.id}`}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#027DFC]/10 hover:text-[#027DFC]"
        >
          {f.nome}
        </a>
      ))}
    </nav>
  );
}

/** Seção de uma face: cabeçalho (nome + subtítulo) + os cards diretos, sem número. */
function FaceSection({ id, nome, sub, children }: { id: string; nome: string; sub: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-4 border-b-2 border-[#027DFC]/30 pb-1.5">
        <h2 className="text-xl font-bold text-[#132960]">{nome}</h2>
        <p className="text-sm text-zinc-500">{sub}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function EmConstrucao({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#132960]/20 bg-zinc-50/60 p-6 text-sm text-zinc-500">
      {texto}
    </div>
  );
}

export function PibDashboardV2({
  pib,
  ibcbr,
  codace,
}: {
  pib: AtividadePibData;
  ibcbr: AtividadeIbcBrData | null;
  codace: AtividadeCodaceData | null;
}) {
  const trimRef = pib.trim_recente;
  const anoCorrente = parseInt(trimRef.slice(0, 4), 10);

  const derivados = useMemo(() => {
    const ult = pib.variacao.serie[pib.variacao.serie.length - 1];
    const qoq = num(ult, "qoq_sa_pib");
    const yoy = num(ult, "yoy_pib");
    const acum4t = num(ult, "acum_4t_pib");
    const carrego = pib.carrego && pib.carrego.ano === anoCorrente ? pib.carrego : null;

    // Mediana Focus mais recente do ano corrente (contraste do carrego).
    let focusMediana: number | null = null;
    const arrFocus = pib.focus[String(anoCorrente)] ?? [];
    for (let i = arrFocus.length - 1; i >= 0; i--) {
      if (arrFocus[i].mediana != null) {
        focusMediana = arrFocus[i].mediana;
        break;
      }
    }

    return { qoq, yoy, acum4t, carrego, focusMediana };
  }, [pib, anoCorrente]);

  const kpis = useMemo(() => {
    const { qoq, yoy, acum4t, carrego, focusMediana } = derivados;
    const cards = [
      <KpiCard
        key="qoq"
        label={`PIB ${fmtTrimCurto(trimRef)} (QoQ SA)`}
        value={fmtSignedPct(qoq, 1)}
        hint="vs trimestre anterior, com ajuste sazonal"
        size="lg"
      />,
      <KpiCard key="yoy" label="Variação interanual" value={fmtSignedPct(yoy, 1)} hint="vs mesmo trimestre do ano anterior" />,
    ];
    if (carrego) {
      cards.push(
        <KpiCard
          key="carrego"
          label={`Carrego para ${carrego.ano}`}
          value={fmtSignedPct(carrego.valor, 1)}
          delta={focusMediana != null ? +(carrego.valor - focusMediana).toFixed(2) : undefined}
          deltaUnit="p.p."
          deltaHint="vs mediana Focus"
          hint={`crescimento já contratado com ${carrego.trimestres_divulgados} trim divulgado${carrego.trimestres_divulgados > 1 ? "s" : ""}`}
        />,
      );
    }
    cards.push(
      <KpiCard key="acum4t" label="Acumulado 4 trimestres" value={fmtSignedPct(acum4t, 1)} hint="ritmo dos últimos 12 meses" />,
    );
    return cards;
  }, [derivados, trimRef]);

  const ibcbrCard = ibcbr ? (
    <IbcBrPibCard ibcbr={ibcbr} pib={pib} codaceMensal={codace?.mensal} geradoEm={pib.gerado_em} />
  ) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-[#132960]">PIB — Atividade Econômica</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Contas Nacionais Trimestrais do IBGE, esmiuçadas pelas faces do circuito macroeconômico.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Referência: {fmtTrimCurto(trimRef)} · IBC-Br até {ibcbr?.mes_recente ?? "—"}
        </p>
      </header>

      {kpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi, i) => (
            <div key={i} className="min-w-0">
              {kpi}
            </div>
          ))}
        </div>
      ) : null}

      <FaceNav />

      <FaceSection id="producao" nome="Produção" sub="ótica da oferta — quem produz">
        <TamanhoEconomiaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <AnchorContribuicoesPib pib={pib} codaceTrimestral={codace?.trimestral} geradoEm={pib.gerado_em} />
        <RitmoTrimestralCard pib={pib} codaceTrimestral={codace?.trimestral} geradoEm={pib.gerado_em} />
        {ibcbrCard}
        <DecomposicaoPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <HeatmapSetorialPib pib={pib} geradoEm={pib.gerado_em} />
        <PesoSetorialPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <ComposicaoVaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <SetorLupaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <TabelaMestraOfertaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
      </FaceSection>

      <FaceSection id="demanda" nome="Demanda" sub="ótica da despesa — quem gasta">
        <ComponentesDemandaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <EstruturaDemandaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <AberturaComercialPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <ComponenteLupaDemandaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
        <TabelaMestraDemandaPib pib={pib} codace={codace} geradoEm={pib.gerado_em} />
      </FaceSection>

      <FaceSection id="renda" nome="Renda" sub="distribuição da renda, poupança e investimento">
        <EmConstrucao texto="Cascata PIB → renda nacional bruta → renda disponível → poupança, e a estrutura nominal por setor — em construção." />
      </FaceSection>

      <FaceSection id="financiamento" nome="Financiamento" sub="como o país se financia (conta financeira)">
        <EmConstrucao texto="Capacidade/necessidade líquida de financiamento (B.9), investimento direto e instrumentos financeiros — em construção." />
      </FaceSection>

      <FaceSection id="sintese" nome="Síntese" sub="expectativas, per capita e o fecho macro">
        <div className="grid gap-5 xl:grid-cols-2">
          <FocusPibCard pib={pib} geradoEm={pib.gerado_em} />
          <RealizadoFocusCard pib={pib} geradoEm={pib.gerado_em} />
        </div>
        {pib.per_capita?.serie?.length ? <PerCapitaCard pib={pib} geradoEm={pib.gerado_em} /> : null}
        <AnaliseCompletaPib pib={pib} geradoEm={pib.gerado_em} />
      </FaceSection>

      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Ficha técnica — fontes e metodologia
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA — Contas Nacionais Trimestrais (10 tabelas): 5932 (variações), 1620/1621
            (índice de volume NS/SA), 6612/6613 (valores reais a preços de 1995), 1846 (valores correntes e % do PIB nominal),
            2072 (contas econômicas/renda), 2205 (conta financeira), 6726/6727 (taxas de poupança e investimento), 6784 (per
            capita anual). BCB: SGS 24363/24364 (IBC-Br NS/SA), Olinda (Focus PIB Total). Recessões: cronologia CODACE/FGV-IBRE.
          </p>
          <p>
            <strong>Metodologia.</strong> PIB potencial = filtro Hodrick-Prescott (λ=1600) sobre o log do índice de volume.
            Contribuições ao crescimento: peso nominal t-4 × variação real YoY (importações com sinal trocado); índices de volume
            encadeados são não-aditivos (o resíduo absorve a diferença — nunca forçamos a soma). Pipeline:
            data-pipeline/python/build_atividade_pib.py · GitHub Actions atividade-pipeline.yml.
          </p>
        </div>
      </details>
    </div>
  );
}
