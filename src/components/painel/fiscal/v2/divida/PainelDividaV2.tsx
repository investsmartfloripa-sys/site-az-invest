"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { FiscalClassicosData, PontoMensal } from "@/lib/painel-fiscal";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { dataIso, deltaDozeMeses } from "./shared";
import { TrajetoriaDividaCard } from "./TrajetoriaDividaCard";
import { PorQueSubiuCard } from "./PorQueSubiuCard";
import { RMenosGCard } from "./RMenosGCard";
import { ComposicaoDpmfiCard } from "./ComposicaoDpmfiCard";
import { ContextoCreditoCard } from "./ContextoCreditoCard";
import { AnaliseCompletaDivida } from "./AnaliseCompletaDivida";

/**
 * Painel Dívida v2 — template narrativo AZ (manchete em prosa → 4 KPIs →
 * âncora da trajetória → blocos numerados → ficha técnica).
 *
 * A manchete é POR REGRA, montada do dado: nível e direção 12m da DBGG +
 * r − g atual + primário estabilizador — nunca texto fixo. Crédito privado
 * saiu do gráfico principal p/ um card de contexto próprio (Big Debt Cycle),
 * e as réguas sem fonte ("80% atenção FMI", "100% Reinhart-Rogoff") foram
 * substituídas por ~70% (FMI p/ emergentes) + máximo histórico calculado.
 */

export function PainelDividaV2({ data, codace }: { data: FiscalClassicosData; codace: AtividadeCodaceData | null }) {
  const sust = data.sustentabilidade?.serie ?? [];
  const ultSust = sust.length > 0 ? sust[sust.length - 1] : null;

  const derivados = useMemo(() => {
    const dbgg = deltaDozeMeses(data.divida.dbgg_pct_pib);
    const dlsp = deltaDozeMeses(data.divida.dlsp_total_pct_pib);
    // r − g como PontoMensal p/ reaproveitar o delta de 12 meses.
    const gapSerie: PontoMensal[] = sust.map((p) => ({ data: p.data, valor: p.r_menos_g_pp }));
    const gap = deltaDozeMeses(gapSerie);
    return { dbgg, dlsp, gap };
  }, [data.divida, sust]);

  const manchete = useMemo(() => {
    const { dbgg } = derivados;
    if (!dbgg) return null;
    const partes: string[] = [];

    let frase = `A dívida bruta do governo geral está em ${fmtPct(dbgg.valor, 1)} do PIB`;
    if (dbgg.delta12m != null) {
      if (dbgg.delta12m > 0.1) frase += `, em alta de ${fmtNum(dbgg.delta12m, 1)} p.p. em 12 meses`;
      else if (dbgg.delta12m < -0.1) frase += `, em queda de ${fmtNum(Math.abs(dbgg.delta12m), 1)} p.p. em 12 meses`;
      else frase += ", praticamente estável em 12 meses";
    }
    partes.push(frase);

    if (ultSust) {
      const gap = ultSust.r_menos_g_pp;
      const estab = ultSust.primario_estabilizador_pct_pib;
      const realizado = ultSust.primario_realizado_sp_pct_pib;
      if (gap > 0) {
        let f = `o custo implícito da dívida supera o crescimento nominal em ${fmtNum(gap, 1)} p.p. (r − g) — a dívida cresce sozinha`;
        if (estab != null) f += ` sem um primário de ${fmtPct(estab, 1)} do PIB`;
        if (realizado != null) f += ` (realizado em 12 meses: ${fmtSignedPct(realizado, 1)})`;
        partes.push(f);
      } else if (gap < 0) {
        let f = `o crescimento nominal supera o custo implícito da dívida em ${fmtNum(Math.abs(gap), 1)} p.p. (r − g) — vento a favor da dinâmica`;
        if (estab != null) f += ` (primário estabilizador: ${fmtPct(estab, 1)} do PIB`;
        if (estab != null && realizado != null) f += `; realizado: ${fmtSignedPct(realizado, 1)})`;
        else if (estab != null) f += ")";
        partes.push(f);
      }
    }
    return `${partes.join("; ")}.`;
  }, [derivados, ultSust]);

  const kpis = useMemo(() => {
    const { dbgg, dlsp, gap } = derivados;
    return [
      <KpiCard
        key="dbgg"
        label="DBGG (% PIB)"
        value={fmtPct(dbgg?.valor ?? null, 1)}
        delta={dbgg?.delta12m ?? undefined}
        deltaUnit="p.p."
        deltaHint="12m"
        invertColor
        hint="dívida bruta do governo geral"
        size="lg"
      />,
      <KpiCard
        key="dlsp"
        label="DLSP (% PIB)"
        value={fmtPct(dlsp?.valor ?? null, 1)}
        delta={dlsp?.delta12m ?? undefined}
        deltaUnit="p.p."
        deltaHint="12m"
        invertColor
        hint="líquida, setor público consolidado"
      />,
      <KpiCard
        key="rg"
        label="r − g"
        value={ultSust ? fmtSignedNum(ultSust.r_menos_g_pp, 1) : "—"}
        unit="p.p."
        delta={gap?.delta12m ?? undefined}
        deltaUnit="p.p."
        deltaHint="12m"
        invertColor
        hint="perímetro consolidado (DLSP) — alto = contra a dívida"
      />,
      <KpiCard
        key="estabilizador"
        label="Primário estabilizador"
        value={ultSust?.primario_estabilizador_pct_pib != null ? fmtPct(ultSust.primario_estabilizador_pct_pib, 1) : "—"}
        unit="do PIB"
        hint={
          ultSust?.primario_realizado_sp_pct_pib != null
            ? `realizado 12m: ${fmtSignedPct(ultSust.primario_realizado_sp_pct_pib, 1)}`
            : "primário que congela a dívida/PIB"
        }
      />,
    ];
  }, [derivados, ultSust]);

  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [];
    if (data.decomposicao_dlsp?.anos?.length) {
      out.push({
        id: "por-que-subiu",
        eyebrow: "Decomposição",
        titulo: "Por que a dívida subiu?",
        descricao: "A variação anual da DLSP/PIB separada em juros, primário, crescimento e ajustes — quem empurrou, quem segurou.",
        children: <PorQueSubiuCard anos={data.decomposicao_dlsp.anos} geradoEm={data.gerado_em} />,
      });
    }
    if (sust.length > 0) {
      out.push({
        id: "r-menos-g",
        eyebrow: "Sustentabilidade",
        titulo: "r − g: a aritmética da dívida",
        descricao: "O custo implícito da dívida contra o crescimento nominal — quando r > g, só superávit primário segura a dívida.",
        children: <RMenosGCard serie={sust} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />,
      });
    }
    if (data.composicao_dpmfi) {
      out.push({
        id: "composicao-dpmfi",
        eyebrow: "Estrutura",
        titulo: "De que é feita a dívida",
        descricao: "A DPMFi por indexador, agora com as seis fatias fechando 100% — onde mora a vulnerabilidade a juros, inflação e câmbio.",
        children: <ComposicaoDpmfiCard composicao={data.composicao_dpmfi} geradoEm={data.gerado_em} />,
      });
    }
    if (data.credito_economia?.credito_total_pct_pib?.length) {
      out.push({
        id: "contexto-credito",
        eyebrow: "Contexto",
        titulo: "Big Debt Cycle — o endividamento agregado",
        descricao: "Crédito privado e dívida total da economia: leitura de ciclo, separada de propósito da sustentabilidade fiscal.",
        children: (
          <ContextoCreditoCard
            credito={data.credito_economia.credito_total_pct_pib}
            dbgg={data.divida.dbgg_pct_pib}
            geradoEm={data.gerado_em}
          />
        ),
      });
    }
    out.push({
      id: "analise-completa",
      eyebrow: "Esmiuçamento",
      titulo: "Análise completa",
      descricao: "Os últimos 12 meses em tabela e as séries completas em CSV.",
      children: <AnaliseCompletaDivida data={data} geradoEm={data.gerado_em} />,
    });
    return out;
  }, [data, sust, codace]);

  const mesRef = derivados.dbgg ? fmtMesCurto(dataIso(derivados.dbgg.data)) : data.mes_recente ? fmtMesCurto(data.mes_recente) : "—";

  return (
    <DashboardScaffold
      header={{
        titulo: "Dívida pública — Fiscal",
        subtitulo:
          "Trajetória, dinâmica (r − g) e estrutura da dívida do governo brasileiro, com o crédito privado como contexto separado.",
        referencia: `Referência: ${mesRef} · BCB (SGS) + pipeline fiscal AZ`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={<TrajetoriaDividaCard divida={data.divida} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> BCB SGS: 13762 (DBGG % PIB), 4513 (DLSP total), 4503 (DLSP governo
            central); 4174–4178 + 12001 (composição da DPMFi por indexador — a 12001 é a fatia de índices de
            preços/NTN-B que faltava p/ o stack fechar 100%); 20622 (crédito total à economia). Recessões: cronologia
            CODACE/FGV (última datação oficial: 2020).
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> A série de sustentabilidade (r, g, r − g, primário
            estabilizador) e a decomposição anual da dívida são calculadas SÓ no pipeline, com fórmula única e
            perímetro único (setor público consolidado — DLSP): r = taxa implícita nominal (juros nominais 12m ÷
            estoque médio); g = crescimento do PIB nominal acumulado em 12 meses. O painel r − g é nominal-nominal — o
            canônico p/ dinâmica de dívida. A decomposição oficial da DBGG (Nota de Imprensa do BCB) entra quando
            coletada.
          </p>
          <p>
            <strong>Réguas editoriais.</strong> ~70% do PIB = referência indicativa do FMI p/ EMERGENTES (Fiscal
            Monitor / análise de sustentabilidade da dívida) — limiar de atenção, não gatilho. O limiar de 90% de
            Reinhart-Rogoff (2010) foi contestado na replicação (Herndon, Ash &amp; Pollin, 2013) — por isso NÃO o
            usamos, nem o antigo "80% atenção FMI" (sem fonte). O máximo histórico da DBGG é calculado da própria
            série, nunca fixado no código.
          </p>
          <p>Pipeline: data-pipeline/python/build_fiscal.py (schema v2) · GitHub Actions fiscal-pipeline.yml.</p>
        </div>
      }
    />
  );
}
