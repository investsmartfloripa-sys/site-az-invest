"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { FiscalClassicosData } from "@/lib/painel-fiscal";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesLongo, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { deltaPp12m, ultimoPct, ultimoYoY } from "./shared";
import { TesouraCard } from "./TesouraCard";
import { PrimarioMetaCard } from "./PrimarioMetaCard";
import { MetaYtdCard } from "./MetaYtdCard";
import { ReceitaFamiliasCard } from "./ReceitaFamiliasCard";
import { ContribuicoesTributoCard } from "./ContribuicoesTributoCard";
import { DespesaRubricasCard } from "./DespesaRubricasCard";
import { RigidezCard } from "./RigidezCard";
import { ArcaboucoCard } from "./ArcaboucoCard";
import { NfspDecompostaCard } from "./NfspDecompostaCard";
import { AnaliseCompletaFiscal } from "./AnaliseCompletaFiscal";

/**
 * Painel Receita e Gastos v2 — template narrativo AZ (manchete em prosa →
 * 4 KPIs → âncora da tesoura → blocos numerados → ficha técnica).
 *
 * Princípios herdados da crítica do revisor: recessões CODACE no lugar de
 * regimes hardcoded; bandas LDO por ano; estabilizador SEMPRE do pipeline
 * (nunca recalculado no front); stacks fixos que fecham o total; séries
 * reais deflacionadas no builder; números da prosa interpolados do JSON.
 */

export function PainelReceitaGastosV2({
  data,
  codace,
}: {
  data: FiscalClassicosData;
  codace: AtividadeCodaceData | null;
}) {
  const rg = data.receita_e_gastos;

  const derivados = useMemo(() => {
    const receita = ultimoPct(rg.receita_liquida_pct_pib);
    const despesa = ultimoPct(rg.despesa_total_pct_pib);
    const primario = ultimoPct(rg.primario_central_pct_pib);
    const deltaReceita = deltaPp12m(rg.receita_liquida_pct_pib);
    const deltaDespesa = deltaPp12m(rg.despesa_total_pct_pib);
    const deltaPrimario = deltaPp12m(rg.primario_central_pct_pib);

    // Estabilizador: SEMPRE o último ponto pronto do pipeline (perímetro consolidado).
    let estab: number | null = null;
    const sustSerie = data.sustentabilidade?.serie ?? [];
    for (let i = sustSerie.length - 1; i >= 0; i--) {
      const v = sustSerie[i].primario_estabilizador_pct_pib;
      if (v != null && Number.isFinite(v)) {
        estab = v;
        break;
      }
    }

    // Tesoura em termos REAIS — séries deflacionadas do builder (arcabouco.*).
    const despReal = ultimoYoY(data.arcabouco?.despesa_real_12m_yoy_pct);
    const recReal = ultimoYoY(data.arcabouco?.receita_real_12m_yoy_pct);

    // Meta LDO do ano corrente (se houver meta vigente).
    const anoCorrente = data.mes_recente ? Number(data.mes_recente.slice(0, 4)) : null;
    const meta = anoCorrente != null ? (data.metas_ldo?.anos?.[String(anoCorrente)] ?? null) : null;

    return { receita, despesa, primario, deltaReceita, deltaDespesa, deltaPrimario, estab, despReal, recReal, anoCorrente, meta };
  }, [rg, data]);

  const manchete = useMemo(() => {
    const { receita, despesa, primario, despReal, recReal, anoCorrente, meta } = derivados;
    if (!receita || !despesa || !primario) return null;
    const partes: string[] = [];
    partes.push(
      `O governo central arrecada ${fmtPct(receita.valor, 1)} do PIB e gasta ${fmtPct(despesa.valor, 1)} em 12 meses — primário de ${fmtSignedPct(primario.valor, 2)}`,
    );
    if (despReal && recReal) {
      partes.push(
        despReal.valor > recReal.valor
          ? `a tesoura abre: em termos reais, a despesa cresce ${fmtSignedPct(despReal.valor, 1)} em 12 meses contra ${fmtSignedPct(recReal.valor, 1)} da receita`
          : `a tesoura fecha: em termos reais, a receita cresce ${fmtSignedPct(recReal.valor, 1)} em 12 meses contra ${fmtSignedPct(despReal.valor, 1)} da despesa`,
      );
    }
    if (meta && anoCorrente != null) {
      const status =
        primario.valor < meta.banda_inf
          ? `roda abaixo do piso da banda da meta LDO de ${anoCorrente} (${fmtSignedPct(meta.banda_inf, 2)} a ${fmtSignedPct(meta.banda_sup, 2)})`
          : primario.valor > meta.banda_sup
            ? `roda acima do teto da banda da meta LDO de ${anoCorrente} (${fmtSignedPct(meta.banda_inf, 2)} a ${fmtSignedPct(meta.banda_sup, 2)})`
            : `cabe na banda da meta LDO de ${anoCorrente} (${fmtSignedPct(meta.banda_inf, 2)} a ${fmtSignedPct(meta.banda_sup, 2)})`;
      partes.push(`no acumulado em 12 meses, o primário ${status} — a aferição oficial é no ano-calendário, com abatimentos`);
    }
    return `${partes.join("; ")}.`;
  }, [derivados]);

  const kpis = useMemo(() => {
    const { receita, despesa, primario, deltaReceita, deltaDespesa, deltaPrimario, estab } = derivados;
    return [
      <KpiCard
        key="receita"
        label="Receita líquida (12m)"
        value={fmtPct(receita?.valor ?? null, 1)}
        unit="do PIB"
        delta={deltaReceita}
        deltaUnit="p.p."
        deltaHint="vs 12m atrás"
        hint="RTN, acumulado 12 meses"
      />,
      <KpiCard
        key="despesa"
        label="Despesa total (12m)"
        value={fmtPct(despesa?.valor ?? null, 1)}
        unit="do PIB"
        delta={deltaDespesa}
        deltaUnit="p.p."
        deltaHint="vs 12m atrás"
        invertColor
        hint="RTN, acumulado 12 meses"
      />,
      <KpiCard
        key="primario"
        label="Primário central (12m)"
        value={fmtSignedPct(primario?.valor ?? null, 2)}
        unit="do PIB"
        delta={deltaPrimario}
        deltaUnit="p.p."
        deltaHint="vs 12m atrás"
        hint="positivo = superávit"
        size="lg"
      />,
      <KpiCard
        key="estabilizador"
        label="Primário estabilizador"
        value={fmtSignedPct(derivados.estab, 2)}
        unit="do PIB"
        hint={estab != null ? "p/ a dívida parar de crescer · perímetro consolidado (DLSP)" : "aguardando pipeline v2"}
      />,
    ];
  }, [derivados]);

  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [
      {
        id: "primario-meta",
        eyebrow: "Meta e sustentabilidade",
        titulo: "Primário × estabilizador × metas LDO",
        descricao:
          "O resultado entregue contra a régua que importa (o primário que estabiliza a dívida, calculado no pipeline) e as bandas das metas por ano.",
        children: <PrimarioMetaCard data={data} codace={codace} />,
      },
    ];
    if (data.acompanhamento_meta?.primario_central_ytd_brl_mm) {
      out.push({
        id: "meta-no-ano",
        eyebrow: "Ano-calendário",
        titulo: "Acompanhamento da meta no ano",
        descricao:
          "A meta LDO é aferida no ano-calendário: o primário acumulado jan→mês do ano corrente contra o padrão sazonal dos cinco anteriores.",
        children: <MetaYtdCard data={data} />,
      });
    }
    if (data.receita_familias) {
      out.push({
        id: "receita",
        eyebrow: "Receita",
        titulo: "De onde vem a receita — e o que a puxou",
        descricao:
          "As quatro famílias do RTN em stack fixo (o total é a receita bruta) e o Δ de participação no PIB por tributo em 12 meses.",
        children: (
          <div className="grid gap-4 xl:grid-cols-2">
            <ReceitaFamiliasCard data={data} />
            <ContribuicoesTributoCard data={data} />
          </div>
        ),
      });
    }
    if (data.despesa_rubricas_v2) {
      out.push({
        id: "despesa",
        eyebrow: "Despesa",
        titulo: "Onde o dinheiro vai — e quanto ainda é escolha",
        descricao:
          "As nove fatias que fecham a despesa total, do mais rígido ao discricionário, e a parcela do orçamento que sobra para decisão alocativa.",
        children: (
          <div className="grid gap-4 xl:grid-cols-2">
            <DespesaRubricasCard data={data} />
            <RigidezCard data={data} />
          </div>
        ),
      });
    }
    if (data.arcabouco) {
      out.push({
        id: "arcabouco",
        eyebrow: "Regra fiscal",
        titulo: "Arcabouço: a despesa cabe no corredor?",
        descricao:
          "Crescimento real 12m de despesa e receita (deflacionados no builder) contra o corredor legal de 0,6–2,5% a.a. da LC 200/2023.",
        children: <ArcaboucoCard data={data} />,
      });
    }
    out.push({
      id: "nfsp",
      eyebrow: "Setor público consolidado",
      titulo: "O nominal decomposto: primário × juros",
      descricao:
        "O formato canônico do resultado nominal — quanto do rombo é fluxo primário e quanto é serviço da dívida, com a identidade fechando por construção.",
      children: <NfspDecompostaCard data={data} codace={codace} />,
    });
    out.push({
      id: "analise-completa",
      eyebrow: "Esmiuçamento",
      titulo: "Análise completa",
      descricao: "Os últimos 12 meses em tabela e a série completa em CSV — fluxo, famílias de receita e rubricas de despesa.",
      children: <AnaliseCompletaFiscal data={data} />,
    });
    return out;
  }, [data, codace]);

  return (
    <DashboardScaffold
      header={{
        titulo: "Receita e Gastos — Painel Fiscal",
        subtitulo:
          "O fluxo fiscal brasileiro em dois perímetros declarados: governo central (Tesouro/RTN) e setor público consolidado (BCB), sempre em 12 meses móveis sobre o PIB.",
        referencia: data.mes_recente ? `Referência: ${fmtMesLongo(data.mes_recente)} · RTN/STN e BCB SGS` : undefined,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={<TesouraCard data={data} codace={codace} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> Tesouro Nacional — Resultado do Tesouro Nacional (RTN, XLSX da série histórica
            desde 1997, leitura com validação de rótulo linha a linha): receita líquida, transferências a E&M, famílias de
            receita (linhas 1.1–1.4), rubricas de despesa (4.x, incl. o residual &quot;demais obrigatórias&quot; e as obrigatórias com
            controle de fluxo) e primário do governo central. BCB SGS: 13762 (DBGG), 4513 (DLSP), 5717/5718 (primário e juros do
            setor público 12m), 5727/5728 (NFSP nominal), 4382 (PIB nominal 12m), 12001 (composição da DPMFi), entre outras.
            Metas: LDOs 2024–2027 (trajetória vigente do PLDO 2025; banda ±0,25 p.p. da LC 200/2023). Recessões: cronologia
            CODACE/FGV (mensal).
          </p>
          <p>
            <strong>Convenções de sinal e perímetros.</strong> Primário positivo = superávit (convenção STN) em TODO o painel.
            A NFSP do BCB publica déficit com sinal positivo — a série já vem convertida do pipeline para a convenção única.
            Juros aparecem sempre como custo. Perímetros declarados gráfico a gráfico: governo central (RTN) na tesoura,
            famílias, rubricas e meta; setor público consolidado (BCB) no estabilizador e no nominal decomposto — não são
            comparáveis linha a linha.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Primário estabilizador: p* = (r − g)/(1 + g) × DLSP/PIB
            t−12, com r = taxa implícita da DLSP (juros nominais 12m ÷ DLSP média) e g = crescimento nominal 12m do PIB — UMA
            fórmula, calculada exclusivamente no pipeline; o front nunca recalcula. Crescimento real do arcabouço: deflação mês
            a mês pelo índice composto do IPCA no builder (não pelo IPCA YoY sobre o agregado). Metas LDO valem por
            ano-calendário e a aferição oficial admite abatimentos (ex.: precatórios EC 114) — comparações com o 12m móvel são
            aproximação, sinalizada nos rodapés. No front, só razões e Δs de apresentação (rigidez, Δ por tributo) sobre séries
            prontas do JSON.
          </p>
          <p>Pipeline: data-pipeline/python/build_fiscal.py (schema v2) · GitHub Actions fiscal-pipeline.yml.</p>
        </div>
      }
    />
  );
}
