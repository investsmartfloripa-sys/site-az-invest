"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePmsData } from "@/lib/painel-atividade";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesCurto, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { num, rebase100, toPointsMes } from "../shared";
import { AnchorNivelMomentumPms } from "./AnchorNivelMomentumPms";
import { TurismoCard } from "./TurismoCard";
import { TransportesCard } from "./TransportesCard";
import { AberturaPmsCard } from "./AberturaPmsCard";
import { AnaliseCompletaPms } from "./AnaliseCompletaPms";

/**
 * Painel PMS v2 — template narrativo (manchete em prosa → 4 KPIs → âncora
 * nível + momentum → blocos numerados → ficha técnica). Serviços é o setor
 * mais acima do pré-pandemia (não o único — o varejo restrito também está);
 * o contraste editorial correto é serviços fortes × indústria estagnada.
 */

export function PmsDashboardV2({ pms, codace }: { pms: AtividadePmsData; codace: AtividadeCodaceData | null }) {
  const mesRef = pms.mes_recente;

  const derivados = useMemo(() => {
    const ult = pms.serie[pms.serie.length - 1];
    const momSa = num(ult, "volume_var_mom_sa");
    const yoy = num(ult, "volume_var_yoy");
    const acum12 = num(ult, "volume_var_acum_12m");

    const nivelPts = rebase100(toPointsMes(pms.serie, "volume_indice_sa"));
    const gapNivel = nivelPts.length > 0 ? +(nivelPts[nivelPts.length - 1][1] - 100).toFixed(1) : null;

    const turismoPts = rebase100(toPointsMes(pms.turismo?.serie ?? [], "volume_indice_sa"));
    const gapTurismo = turismoPts.length > 0 ? +(turismoPts[turismoPts.length - 1][1] - 100).toFixed(1) : null;

    return { momSa, yoy, acum12, gapNivel, gapTurismo };
  }, [pms]);

  const manchete = useMemo(() => {
    const { momSa, gapNivel, gapTurismo } = derivados;
    if (momSa == null && gapNivel == null) return null;
    const partes: string[] = [];
    if (momSa != null) {
      partes.push(
        `O volume de serviços ${momSa >= 0 ? "cresceu" : "recuou"} ${fmtSignedPct(momSa, 1)} em ${fmtMesCurto(
          mesRef,
        )} ante o mês anterior (com ajuste sazonal)`,
      );
    }
    if (gapNivel != null) {
      partes.push(
        gapNivel >= 0
          ? `o motor do PIB pós-pandemia segue ${fmtPct(gapNivel, 1)} acima de fev/2020`
          : `o setor opera ${fmtPct(Math.abs(gapNivel), 1)} abaixo de fev/2020`,
      );
    }
    if (gapTurismo != null) {
      partes.push(
        gapTurismo >= 0
          ? `até o turismo, o segmento mais atingido em 2020, já roda ${fmtPct(gapTurismo, 1)} acima do patamar pré-pandemia`
          : `o turismo, o segmento mais atingido em 2020, ainda roda ${fmtPct(Math.abs(gapTurismo), 1)} abaixo do patamar pré-pandemia`,
      );
    }
    return `${partes.join("; ")}.`;
  }, [derivados, mesRef]);

  const kpis = useMemo(
    () => [
      <KpiCard
        key="mom"
        label={`Serviços ${fmtMesCurto(mesRef)} (MoM SA)`}
        value={fmtSignedPct(derivados.momSa, 1)}
        hint="vs mês anterior, com ajuste sazonal"
        size="lg"
      />,
      <KpiCard key="yoy" label="Variação interanual" value={fmtSignedPct(derivados.yoy, 1)} hint="vs mesmo mês do ano anterior" />,
      <KpiCard key="acum12" label="Acumulado 12 meses" value={fmtSignedPct(derivados.acum12, 1)} hint="ritmo dos últimos 12 meses" />,
      <KpiCard
        key="turismo"
        label="Turismo vs fev/2020"
        value={fmtSignedPct(derivados.gapTurismo, 1)}
        hint="volume, ajuste sazonal"
      />,
    ],
    [derivados, mesRef],
  );

  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [];
    if (pms.turismo?.serie?.length) {
      out.push({
        id: "turismo",
        eyebrow: "Setor-símbolo da pandemia",
        titulo: "Turismo: a recuperação completa?",
        descricao: "O sub-índice mais castigado em 2020 — aqui a pergunta é de nível: voltou ao patamar pré-pandemia?",
        children: <TurismoCard serie={pms.turismo.serie} codaceMensal={codace?.mensal} geradoEm={pms.gerado_em} />,
      });
    }
    if (pms.transportes?.serie?.length) {
      out.push({
        id: "transportes",
        eyebrow: "Termômetro do ciclo",
        titulo: "Logística e mobilidade",
        descricao: "Cargas antecipam o ciclo de indústria e varejo; passageiros refletem renda das famílias e turismo.",
        children: (
          <TransportesCard transportes={pms.transportes} codaceMensal={codace?.mensal} geradoEm={pms.gerado_em} />
        ),
      });
    }
    out.push({
      id: "abertura",
      eyebrow: "Composição",
      titulo: "Abertura setorial",
      descricao: "Quem sustenta (e quem trava) o agregado — 20 segmentos ou 29 atividades, em mapa de calor ou ranking.",
      children: <AberturaPmsCard pms={pms} geradoEm={pms.gerado_em} />,
    });
    out.push({
      id: "analise-completa",
      eyebrow: "Esmiuçamento",
      titulo: "Análise completa",
      descricao: "A série em todas as transformações, volume × receita, tabela e export CSV.",
      children: <AnaliseCompletaPms pms={pms} geradoEm={pms.gerado_em} />,
    });
    return out;
  }, [pms, codace]);

  return (
    <DashboardScaffold
      header={{
        titulo: "PMS — Pesquisa Mensal de Serviços",
        subtitulo:
          "O maior setor da economia brasileira no dado do IBGE: volume e receita de serviços, turismo, transportes e a abertura por segmentos e atividades.",
        referencia: `Referência: ${fmtMesCurto(mesRef)}`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={<AnchorNivelMomentumPms pms={pms} codaceMensal={codace?.mensal} geradoEm={pms.gerado_em} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA — PMS, base 2022 = 100: 5906 (geral — volume e receita nominal),
            8163 (20 segmentos), 8688 (29 atividades e subdivisões), 8694 (atividades turísticas), 8695 (transporte de
            passageiros × cargas). Recessões: cronologia CODACE/FGV (última datação oficial: 2020). A PMS existe desde
            jan/2011 e o IBGE não retropola além disso — comparações com décadas anteriores não são possíveis nesta
            pesquisa.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Volume = receita deflacionada (a manchete do IBGE);
            receita nominal aparece SÓ em variação — nível nominal mistura atividade e inflação. Ciclo longo em nível SA
            rebasado para fev/2020 = 100 (último mês "normal" pré-covid; rebase feito no site). YoY suavizada por média
            móvel de 3 meses (mm3) — amortece efeitos de base e dilui meses extremos. Turismo lido em NÍVEL
            dessazonalizado: a pergunta do bloco é "voltou ao patamar?", não "quanto variou?". Difusão setorial (% de
            categorias com YoY mm3 positiva) calculada no site.
          </p>
          <p>
            <strong>Réguas editoriais.</strong> Faixas cinzas = recessões CODACE; a cronologia é atualizada com anos de
            defasagem (última datação: 2020) — ausência de faixa recente não significa ausência de risco. Serviços é o
            setor mais acima do pré-pandemia, mas não o único — o contraste relevante é com a indústria, que segue
            estagnada.
          </p>
          <p>Pipeline: data-pipeline/python/build_atividade_pms.py (schema v2) · GitHub Actions atividade-pipeline.yml.</p>
        </div>
      }
    />
  );
}
