"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePibData, AtividadePimData } from "@/lib/painel-atividade";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesCurto, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { num, ultimo } from "../shared";
import { AnchorNivelMomentumPim } from "./AnchorNivelMomentumPim";
import { CicloCategoriasCard } from "./CicloCategoriasCard";
import { SecoesCard } from "./SecoesCard";
import { ConstrucaoCard } from "./ConstrucaoCard";
import { DifusaoCard } from "./DifusaoCard";
import { AberturaSetorialCard } from "./AberturaSetorialCard";
import { AnaliseCompletaPim } from "./AnaliseCompletaPim";

/**
 * Painel PIM-PF v2 — template narrativo (manchete em prosa → 4 KPIs → âncora
 * nível × momentum → blocos numerados → ficha técnica). A história da página:
 * quanto a indústria produz vs o pico histórico, quem puxa o ciclo (categorias
 * de uso), oferta × demanda (seções), o sinal antecedente da construção e a
 * QUALIDADE da alta (difusão + abertura setorial).
 */

export function PimDashboardV2({
  pim,
  pib,
  codace,
}: {
  pim: AtividadePimData;
  pib: AtividadePibData | null;
  codace: AtividadeCodaceData | null;
}) {
  const mesRef = pim.mes_recente;

  const derivados = useMemo(() => {
    const geral = pim.geral.serie;
    const ult = geral.length > 0 ? geral[geral.length - 1] : null;
    const momSa = ult ? num(ult, "var_mom_sa") : null;
    const yoy = ult ? num(ult, "var_yoy") : null;
    const acum12 = ult ? num(ult, "var_acum_12m") : null;

    // Nível vs pico histórico — o pico vem CALCULADO da série pelo builder
    // (picos.industria_geral); a data nunca é hardcoded aqui.
    const pico = pim.picos?.industria_geral ?? null;
    const nivelUlt = ultimo(geral, "indice_sa");
    const pctVsPico =
      pico && pico.indice_sa > 0 && nivelUlt != null ? (nivelUlt.valor / pico.indice_sa - 1) * 100 : null;

    // Difusão suavizada mais recente (mm3).
    const difusaoUlt = ultimo(pim.difusao?.serie ?? [], "pct_mm3");
    const difusaoMm3 = difusaoUlt?.valor ?? null;

    return { momSa, yoy, acum12, pico, pctVsPico, difusaoMm3 };
  }, [pim]);

  const manchete = useMemo(() => {
    const { momSa, yoy, pico, pctVsPico, difusaoMm3 } = derivados;
    const partes: string[] = [];
    if (momSa != null) {
      const abertura =
        Math.abs(momSa) < 0.05
          ? `A indústria ficou praticamente estável em ${fmtMesCurto(mesRef)} ante o mês anterior (com ajuste sazonal)`
          : `A indústria ${momSa > 0 ? "avançou" : "recuou"} ${fmtPct(Math.abs(momSa), 1)} em ${fmtMesCurto(
              mesRef,
            )} ante o mês anterior (com ajuste sazonal)`;
      partes.push(
        abertura + (yoy != null ? ` e ${yoy >= 0 ? "cresce" : "cai"} ${fmtPct(Math.abs(yoy), 1)} sobre um ano antes` : ""),
      );
    }
    if (pico && pctVsPico != null) {
      partes.push(
        `o nível de produção segue ${fmtPct(Math.abs(pctVsPico), 1)} ${
          pctVsPico < 0 ? "abaixo" : "acima"
        } do pico de ${fmtMesCurto(pico.mes)}`,
      );
    }
    if (difusaoMm3 != null) {
      partes.push(
        `a difusão suavizada de ${fmtPct(difusaoMm3, 0)} indica alta ${
          difusaoMm3 >= 50 ? "disseminada entre as atividades" : "concentrada em poucos setores"
        }`,
      );
    }
    return partes.length > 0 ? `${partes.join("; ")}.` : null;
  }, [derivados, mesRef]);

  const kpis = useMemo(() => {
    const { momSa, yoy, acum12, difusaoMm3 } = derivados;
    return [
      <KpiCard
        key="mom"
        label={`Indústria ${fmtMesCurto(mesRef)} (MoM SA)`}
        value={fmtSignedPct(momSa, 1)}
        hint="vs mês anterior, com ajuste sazonal"
        size="lg"
      />,
      <KpiCard key="yoy" label="Variação interanual" value={fmtSignedPct(yoy, 1)} hint="vs mesmo mês do ano anterior" />,
      <KpiCard key="acum12" label="Acumulado 12 meses" value={fmtSignedPct(acum12, 1)} hint="ritmo do último ano" />,
      <KpiCard
        key="difusao"
        label="Difusão (mm3)"
        value={fmtPct(difusaoMm3, 0)}
        hint="% de atividades em alta — acima de 50% = disseminada"
      />,
    ];
  }, [derivados, mesRef]);

  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [
      {
        id: "categorias",
        eyebrow: "Decomposição cíclica",
        titulo: "Ciclo por categoria de uso",
        descricao:
          "Bens de capital antecipam o investimento, duráveis respondem ao crédito, semi e não duráveis seguem a renda — a ordem em que viram conta a fase do ciclo.",
        children: <CicloCategoriasCard pim={pim} codaceMensal={codace?.mensal} geradoEm={pim.gerado_em} />,
      },
      {
        id: "secoes",
        eyebrow: "Oferta × demanda",
        titulo: "Extrativa × Transformação",
        descricao:
          "A extrativa segue o cronograma de plataformas e minas; a transformação é o termômetro da demanda doméstica e dos juros.",
        children: <SecoesCard pim={pim} codaceMensal={codace?.mensal} geradoEm={pim.gerado_em} />,
      },
    ];
    if (pib && pim.construcao?.serie?.length) {
      out.push({
        id: "construcao",
        eyebrow: "Sinal antecedente",
        titulo: "Construção: os insumos antecipam o PIB?",
        descricao:
          "Os insumos típicos saem mensalmente e meses antes da rubrica Construção das Contas Nacionais — a sobreposição valida o papel antecedente.",
        children: <ConstrucaoCard pim={pim} pib={pib} codaceMensal={codace?.mensal} geradoEm={pim.gerado_em} />,
      });
    }
    if (pim.difusao?.serie?.length) {
      out.push({
        id: "difusao",
        eyebrow: "Qualidade da alta",
        titulo: "A alta é disseminada?",
        descricao:
          "O mesmo número de manchete pode vir de muitos setores ou de meia dúzia — a difusão separa expansão robusta de alta frágil.",
        children: <DifusaoCard difusao={pim.difusao.serie} codaceMensal={codace?.mensal} geradoEm={pim.gerado_em} />,
      });
    }
    out.push(
      {
        id: "abertura-setorial",
        eyebrow: "Esmiuçamento setorial",
        titulo: "Abertura setorial",
        descricao: "As ~24 atividades CNAE em mapa de calor (ordem fixa, escala constante) e ranking do mês.",
        children: <AberturaSetorialCard pim={pim} geradoEm={pim.gerado_em} />,
      },
      {
        id: "analise-completa",
        eyebrow: "Esmiuçamento",
        titulo: "Análise completa",
        descricao: "A série da indústria geral em todas as transformações, tabela e export CSV.",
        children: <AnaliseCompletaPim pim={pim} geradoEm={pim.gerado_em} />,
      },
    );
    return out;
  }, [pim, pib, codace]);

  return (
    <DashboardScaffold
      header={{
        titulo: "PIM-PF — Produção Industrial",
        subtitulo:
          "Pesquisa Industrial Mensal — Produção Física do IBGE: seções, categorias de uso, atividades CNAE, insumos da construção e difusão.",
        referencia: `Referência: ${fmtMesCurto(mesRef)} · série mensal desde ${
          pim.geral.serie.length > 0 ? fmtMesCurto(pim.geral.serie[0].mes) : "2002"
        }`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={<AnchorNivelMomentumPim pim={pim} codaceMensal={codace?.mensal} geradoEm={pim.gerado_em} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA — Pesquisa Industrial Mensal (Produção Física): 8888 (indústria
            geral, seções e atividades CNAE), 8887 (grandes categorias econômicas — bens de capital, intermediários e de
            consumo), 8889 (indicadores especiais), 8886 (insumos típicos da construção civil). Base 2022 = 100,
            retropolada a janeiro de 2002. PIB da construção (overlay do bloco de construção): Contas Nacionais
            Trimestrais. Recessões: cronologia CODACE/FGV (última datação oficial: 2020).
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Comparações de nível usam o índice SA rebasado para
            fev/2020 = 100 (último mês pré-pandemia); o pico histórico é CALCULADO da própria série SA pelo pipeline —
            nunca uma data fixa no código. YoY suavizada = média móvel de 3 meses (mm3). Difusão: cálculo próprio sobre as
            ~25 atividades CNAE (% com MoM SA &gt; 0; fallback YoY &gt; 0 quando o ajuste sazonal não está disponível) —
            não é o índice oficial de difusão por ~789 produtos do IBGE. No heatmap setorial, a YoY mm3 por atividade é a
            média simples da variação interanual do mês e dos dois anteriores. Faixas cinzas = recessões CODACE; a
            cronologia é atualizada com anos de defasagem — ausência de faixa recente não significa ausência de risco.
          </p>
          <p>Pipeline: data-pipeline/python/build_atividade_pim.py (schema v2) · GitHub Actions atividade-pipeline.yml.</p>
        </div>
      }
    />
  );
}
