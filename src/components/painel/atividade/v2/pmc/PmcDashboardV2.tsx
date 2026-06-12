"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePmcData } from "@/lib/painel-atividade";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesCurto, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { num, rebase100, toPointsMes } from "../shared";
import { AnchorNivelPmc } from "./AnchorNivelPmc";
import { DeflatorCard } from "./DeflatorCard";
import { MomentumPmc } from "./MomentumPmc";
import { AberturaPmcCard } from "./AberturaPmcCard";
import { AnaliseCompletaPmc } from "./AnaliseCompletaPmc";

/**
 * Painel PMC v2 — template narrativo (manchete em prosa → 4 KPIs → âncora de
 * nível vs fev/2020 → blocos numerados → ficha técnica). Convenções da área:
 * nunca eixo duplo; receita nominal nunca em nível; gap como KPI (métrica de
 * 2ª ordem); o deflator implícito É plotado, não inferido.
 */

export function PmcDashboardV2({ pmc, codace }: { pmc: AtividadePmcData; codace: AtividadeCodaceData | null }) {
  const mesRef = pmc.mes_recente;

  const derivados = useMemo(() => {
    const ult = pmc.serie[pmc.serie.length - 1];
    const momSa = num(ult, "restrito_volume_var_mom_sa");
    const yoyRestrito = num(ult, "restrito_volume_var_yoy");
    const yoyAmpliado = num(ult, "ampliado_volume_var_yoy");
    const gap = num(ult, "gap_yoy");

    // Nível do restrito vs fev/2020 (rebase 100 do índice SA): valor atual − 100.
    const rebasado = rebase100(toPointsMes(pmc.serie, "restrito_volume_indice_sa"));
    const nivelVsFev = rebasado.length > 0 ? +(rebasado[rebasado.length - 1][1] - 100).toFixed(1) : null;

    return { momSa, yoyRestrito, yoyAmpliado, gap, nivelVsFev };
  }, [pmc.serie]);

  const manchete = useMemo(() => {
    const { momSa, gap, nivelVsFev } = derivados;
    if (momSa == null && nivelVsFev == null && gap == null) return null;
    const partes: string[] = [];
    if (momSa != null) {
      partes.push(
        `O volume do varejo restrito ${momSa >= 0 ? "cresceu" : "caiu"} ${fmtPct(Math.abs(momSa), 1)} em ${fmtMesCurto(
          mesRef,
        )} ante o mês anterior (com ajuste sazonal)`,
      );
    }
    if (nivelVsFev != null) {
      partes.push(
        `o consumo de bens está ${fmtPct(Math.abs(nivelVsFev), 1)} ${
          nivelVsFev >= 0 ? "acima" : "abaixo"
        } do nível pré-pandemia (fev/2020)`,
      );
    }
    if (gap != null) {
      partes.push(
        gap > 0
          ? `no agregado ampliado, veículos e construção puxam o consumo ${fmtSignedNum(gap, 1)} p.p. acima do varejo essencial`
          : gap < 0
            ? `veículos e construção seguram o varejo ampliado (${fmtSignedNum(gap, 1)} p.p. ante o restrito)`
            : `o varejo ampliado anda colado no restrito`,
      );
    }
    return `${partes.join("; ")}.`;
  }, [derivados, mesRef]);

  const kpis = useMemo(() => {
    const { momSa, yoyRestrito, yoyAmpliado, gap } = derivados;
    return [
      <KpiCard
        key="mom"
        label={`Varejo restrito ${fmtMesCurto(mesRef)} (MoM SA)`}
        value={fmtSignedPct(momSa, 1)}
        hint="volume, vs mês anterior com ajuste sazonal"
        size="lg"
      />,
      <KpiCard
        key="yoy-restrito"
        label="Restrito (YoY)"
        value={fmtSignedPct(yoyRestrito, 1)}
        hint="volume vs mesmo mês do ano anterior"
      />,
      <KpiCard
        key="yoy-ampliado"
        label="Ampliado (YoY)"
        value={fmtSignedPct(yoyAmpliado, 1)}
        hint="inclui veículos e materiais de construção"
      />,
      <KpiCard
        key="gap"
        label="Gap ampliado − restrito"
        value={gap != null ? `${fmtSignedNum(gap, 1)} p.p.` : "—"}
        hint="positivo = autos/construção puxando"
      />,
    ];
  }, [derivados, mesRef]);

  const blocos = useMemo<DashboardBloco[]>(
    () => [
      {
        id: "deflator",
        eyebrow: "Preços",
        titulo: "Quanta inflação há nas vendas?",
        descricao:
          "Volume × receita nominal × deflator implícito — o vão entre as duas primeiras curvas, plotado explicitamente, é a inflação da cesta do varejo.",
        children: <DeflatorCard pmc={pmc} codaceMensal={codace?.mensal} geradoEm={pmc.gerado_em} />,
      },
      {
        id: "momentum",
        eyebrow: "Margem",
        titulo: "Momentum",
        descricao: "A variação mensal com ajuste sazonal, suavizada (mm3) — o varejo acelera ou perde fôlego na margem.",
        children: <MomentumPmc pmc={pmc} geradoEm={pmc.gerado_em} />,
      },
      {
        id: "abertura",
        eyebrow: "Composição",
        titulo: "Abertura por atividade",
        descricao:
          "Mapa de calor e ranking das atividades do varejo — quem puxa (supermercados? combustíveis?) e quem trava o agregado.",
        children: <AberturaPmcCard pmc={pmc} geradoEm={pmc.gerado_em} />,
      },
      {
        id: "analise-completa",
        eyebrow: "Esmiuçamento",
        titulo: "Análise completa",
        descricao: "A série em todas as transformações e escopos, tabela dos últimos 12 meses e export CSV.",
        children: <AnaliseCompletaPmc pmc={pmc} geradoEm={pmc.gerado_em} />,
      },
    ],
    [pmc, codace],
  );

  return (
    <DashboardScaffold
      header={{
        titulo: "PMC — Comércio Varejista",
        subtitulo:
          "Pesquisa Mensal de Comércio do IBGE: volume e receita do varejo restrito e ampliado, com o deflator implícito das vendas.",
        referencia: `Referência: ${fmtMesCurto(mesRef)}`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={<AnchorNivelPmc pmc={pmc} codaceMensal={codace?.mensal} geradoEm={pmc.gerado_em} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA — Pesquisa Mensal de Comércio: 8880/8881 (varejo restrito: índices e
            variações de volume e receita nominal, com e sem ajuste sazonal, e aberturas por ~11 atividades) e 8882/8883
            (varejo ampliado, que soma veículos, motos e partes e material de construção; ~14 atividades). Base fixa
            2022 = 100; o restrito retropola a ~2000 e o ampliado a ~2003/04. Recessões: cronologia CODACE/FGV (última
            datação oficial: 2020).
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Nível = índice de volume SA rebasado para fev/2020 = 100
            (último mês antes do choque covid); cada série rebasa no próprio ponto-base. Tendências interanuais suavizadas
            por média móvel de 3 meses. Deflator implícito do varejo = (1 + receita nominal YoY) ÷ (1 + volume YoY) − 1,
            calculado no builder (schema v2) — aproxima a inflação da cesta do varejo; compare com o IPCA de bens. O gap
            ampliado − restrito é métrica de 2ª ordem: entra como KPI, não como gráfico.
          </p>
          <p>
            <strong>Réguas editoriais.</strong> Receita NOMINAL nunca em gráfico de nível (sobe sempre, por inflação — só
            aparece em variação, ao lado do volume e do deflator). Variações sempre com a linha do zero. Faixas cinzas =
            recessões CODACE em janelas de 5+ anos; a cronologia é atualizada com anos de defasagem — ausência de faixa
            recente não significa ausência de risco.
          </p>
          <p>Pipeline: data-pipeline/python/build_atividade_pmc.py (schema v2) · GitHub Actions atividade-pipeline.yml.</p>
        </div>
      }
    />
  );
}
