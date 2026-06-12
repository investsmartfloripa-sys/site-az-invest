"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { PnadData } from "@/lib/painel-emprego";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { fmtTrimCurto, num } from "@/components/painel/atividade/v2/shared";
import { PNAD_KEYS, findTrim, mediana, trimAnoAnterior } from "./shared";
import { DesocupacaoHistoricaCard } from "./DesocupacaoHistoricaCard";
import { ParticipacaoOcupacaoCard } from "./ParticipacaoOcupacaoCard";
import { SubutilizacaoCard } from "./SubutilizacaoCard";
import { QualidadeCard } from "./QualidadeCard";
import { SetoresPnadCard } from "./SetoresPnadCard";
import { MassaCard } from "./MassaCard";
import { AnaliseCompletaPnad } from "./AnaliseCompletaPnad";

/**
 * Painel PNAD v2 — template narrativo AZ (manchete em prosa → 4 KPIs →
 * âncora histórica da desocupação → blocos numerados com pergunta própria →
 * ficha técnica). Substitui as abas-gaveta do dashboard antigo e desmembra o
 * spaghetti de 5 taxas no mesmo eixo em gráficos com pergunta econômica
 * própria. Manchete e títulos são DERIVADOS do dado por regra — "mínima da
 * série" só aparece quando verificada.
 */

export function PnadDashboardV2({ data, codace }: { data: PnadData; codace: AtividadeCodaceData | null }) {
  const taxas = data.taxas.serie;
  const ult = taxas[taxas.length - 1];
  const trimRef = ult?.trim ?? data.trim_recente;

  const derivados = useMemo(() => {
    const prev = findTrim(taxas, trimAnoAnterior(trimRef));
    const des = num(ult, PNAD_KEYS.desocupacao);
    const desSa = num(ult, PNAD_KEYS.desocupacaoSa);
    const part = num(ult, PNAD_KEYS.participacao);
    const inform = num(ult, PNAD_KEYS.informalidade);

    const desPrev = num(prev, PNAD_KEYS.desocupacao);
    const partPrev = num(prev, PNAD_KEYS.participacao);
    const informPrev = num(prev, PNAD_KEYS.informalidade);

    const dDes = des != null && desPrev != null ? +(des - desPrev).toFixed(2) : null;
    const dPart = part != null && partPrev != null ? +(part - partPrev).toFixed(2) : null;
    const dInform = inform != null && informPrev != null ? +(inform - informPrev).toFixed(2) : null;

    // Posição histórica da desocupação observada (série completa desde 2012).
    const desVals = taxas.map((r) => num(r, PNAD_KEYS.desocupacao)).filter((v): v is number => v != null);
    const desMin = desVals.length > 0 ? Math.min(...desVals) : null;
    const desMax = desVals.length > 0 ? Math.max(...desVals) : null;
    const desMed = mediana(desVals);

    // Última leitura YoY da massa real (trimestre móvel) + mês de referência.
    let massaYoy: number | null = null;
    let massaMes: string | null = null;
    const massaSerie = data.massa_rendimento?.serie ?? [];
    for (let i = massaSerie.length - 1; i >= 0; i--) {
      const v = massaSerie[i].massa_yoy_pct;
      if (v != null && Number.isFinite(v)) {
        massaYoy = v;
        massaMes = massaSerie[i].mes;
        break;
      }
    }

    return { des, desSa, part, inform, dDes, dPart, dInform, desMin, desMax, desMed, massaYoy, massaMes };
  }, [taxas, ult, trimRef, data.massa_rendimento]);

  // Manchete por regra: nível + leitura histórica + o motivo (certo ou errado) + massa.
  const manchete = useMemo(() => {
    const { des, dDes, dPart, desMin, desMax, desMed, massaYoy } = derivados;
    if (des == null) return null;
    const eps = 1e-9;
    const partes: string[] = [];

    let frase = `A desocupação ficou em ${fmtPct(des, 1)} no ${fmtTrimCurto(trimRef)}`;
    if (desMin != null && des <= desMin + eps) {
      frase += ", o menor nível da série iniciada em 2012";
    } else if (desMax != null && des >= desMax - eps) {
      frase += ", o maior nível da série iniciada em 2012";
    } else if (desMed != null) {
      frase +=
        Math.abs(des - desMed) <= 0.05
          ? `, em linha com a mediana histórica (${fmtPct(desMed, 1)})`
          : `, ${des < desMed ? "abaixo" : "acima"} da mediana histórica de ${fmtPct(desMed, 1)}`;
    }
    partes.push(frase);

    if (dDes != null && dPart != null) {
      if (dDes < -0.03) {
        if (dPart < -0.1) {
          partes.push(
            `a queda de ${fmtNum(Math.abs(dDes), 1)} p.p. em um ano veio em parte com menos gente procurando trabalho (participação ${fmtSignedNum(dPart, 1)} p.p.)`,
          );
        } else if (dPart > 0.1) {
          partes.push(
            `a queda de ${fmtNum(Math.abs(dDes), 1)} p.p. em um ano veio pelo motivo certo: mais gente na força de trabalho (participação ${fmtSignedNum(dPart, 1)} p.p.) e ainda assim o desemprego cedeu`,
          );
        } else {
          partes.push(
            `a queda de ${fmtNum(Math.abs(dDes), 1)} p.p. em um ano é genuína — a participação ficou estável, o que recuou foi o desemprego mesmo`,
          );
        }
      } else if (dDes > 0.03) {
        partes.push(
          dPart > 0.1
            ? `a alta de ${fmtNum(dDes, 1)} p.p. em um ano reflete em parte mais gente entrando na força de trabalho (participação ${fmtSignedNum(dPart, 1)} p.p.)`
            : `a desocupação subiu ${fmtNum(dDes, 1)} p.p. em um ano`,
        );
      } else {
        partes.push("a taxa está estável na comparação interanual");
      }
    }

    if (massaYoy != null) {
      partes.push(
        `o poder de compra agregado do trabalho ${massaYoy >= 0 ? "cresce" : "cai"} ${fmtPct(Math.abs(massaYoy), 1)} em um ano`,
      );
    }

    return `${partes.join("; ")}.`;
  }, [derivados, trimRef]);

  const kpis = useMemo(() => {
    const { des, desSa, part, inform, dDes, dPart, dInform, massaYoy } = derivados;
    return [
      <KpiCard
        key="desocupacao"
        label={`Desocupação ${fmtTrimCurto(trimRef)}`}
        value={fmtPct(des, 1)}
        delta={dDes}
        deltaUnit="p.p."
        deltaHint="YoY"
        invertColor
        hint={desSa != null ? `${fmtPct(desSa, 1)} dessaz. (estimativa própria)` : undefined}
        size="lg"
      />,
      <KpiCard
        key="participacao"
        label="Participação"
        value={fmtPct(part, 1)}
        delta={dPart}
        deltaUnit="p.p."
        deltaHint="YoY"
        hint="força de trabalho ÷ PIA"
      />,
      <KpiCard
        key="informalidade"
        label="Informalidade"
        value={fmtPct(inform, 1)}
        delta={dInform}
        deltaUnit="p.p."
        deltaHint="YoY"
        invertColor
        hint="série desde 4T2015"
      />,
      <KpiCard
        key="massa"
        label="Massa de rendimento real (YoY)"
        value={fmtSignedPct(massaYoy, 1)}
        hint="motor do consumo — trimestre móvel"
      />,
    ];
  }, [derivados, trimRef]);

  const blocos = useMemo<DashboardBloco[]>(
    () => [
      {
        id: "participacao-ocupacao",
        eyebrow: "O teste do motivo",
        titulo: "O desemprego caiu pelo motivo certo?",
        descricao:
          "Participação e nível da ocupação na mesma unidade (% da PIA): a queda da desocupação só é boa notícia quando vem de mais gente ocupada, não de gente desistindo de procurar.",
        children: <ParticipacaoOcupacaoCard data={data} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />,
      },
      {
        id: "subutilizacao",
        eyebrow: "Folga do mercado",
        titulo: "Quanta força de trabalho sobra?",
        descricao:
          "Desocupação, subutilização composta e informalidade em escala própria — a medida ampla da folga que a taxa-manchete não captura.",
        children: <SubutilizacaoCard data={data} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />,
      },
      {
        id: "qualidade",
        eyebrow: "Vínculo",
        titulo: "A ocupação que cresce é de qualidade?",
        descricao:
          "Com × sem carteira no setor privado (mil pessoas) e o share de conta própria — formalidade é a diferença entre emprego com proteção e bico.",
        children: <QualidadeCard data={data} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />,
      },
      {
        id: "setores",
        eyebrow: "Decomposição",
        titulo: "Quais setores criam ocupação?",
        descricao:
          "A variação da ocupação decomposta por grupamento de atividade, em barras divergentes — quem cria e quem destrói postos, em vez do empilhado de 100 milhões onde nada se via.",
        children: <SetoresPnadCard data={data} geradoEm={data.gerado_em} />,
      },
      {
        id: "massa",
        eyebrow: "Renda agregada",
        titulo: "Massa de rendimento real",
        descricao:
          "Ocupação × rendimento médio real: o canal que liga o mercado de trabalho ao consumo das famílias.",
        children: <MassaCard data={data} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />,
      },
      {
        id: "analise-completa",
        eyebrow: "Esmiuçamento",
        titulo: "Análise completa",
        descricao: "Os últimos 8 trimestres em tabela e a série completa em CSV (taxas, carteira e massa).",
        children: <AnaliseCompletaPnad data={data} geradoEm={data.gerado_em} />,
      },
    ],
    [data, codace],
  );

  return (
    <DashboardScaffold
      header={{
        titulo: "PNAD Contínua — Mercado de Trabalho",
        subtitulo:
          "O retrato amplo do trabalho no Brasil (formais, informais, conta própria e quem desistiu de procurar) — da taxa de desocupação à massa real de rendimentos.",
        referencia: `Referência: ${fmtTrimCurto(trimRef)} (trimestre calendário)${
          derivados.massaMes ? ` · massa de rendimento até ${fmtMesCurto(derivados.massaMes)} (trimestre móvel)` : ""
        }`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={<DesocupacaoHistoricaCard data={data} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA — PNAD Contínua Trimestral: 4099 (desocupação, % da força de
            trabalho), 6461 (participação, nível da ocupação e subutilização composta), 8529 (informalidade, % dos ocupados —
            série iniciada no 4T2015), 4096 (composição da ocupação por posição), 5434 (ocupados por grupamento de atividade,
            mil pessoas), 4097 (setor privado com/sem carteira, exclusive domésticos, mil pessoas) e 6392 (massa de rendimento
            mensal real habitual). Recessões: cronologia CODACE/FGV.
          </p>
          <p>
            <strong>Janelas amostrais distintas — declaradas.</strong> As taxas e os recortes por setor/vínculo usam o
            trimestre CALENDÁRIO (1T = jan–mar); a massa de rendimento (6392) usa trimestre MÓVEL terminado no mês de
            referência. As duas janelas não coincidem — compare tendências, não pontos. Algumas tabelas têm hiato no período
            pandêmico (suspensão da coleta presencial entre 2020 e 2022).
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> desocupacao_sa é dessazonalização PRÓPRIA (STL robusta a
            2020): o IBGE não publica ajuste sazonal oficial da PNAD — trate como estimativa da casa. A massa real já vem
            deflacionada pelo IBGE (deflator oficial) — não re-deflacionamos. Variações de taxas são sempre YoY em PONTOS
            PERCENTUAIS (vs mesmo trimestre do ano anterior — a comparação que controla a sazonalidade); variações de
            contingentes (mil pessoas) são diferenças absolutas. A "taxa combinada" (4114) foi descartada do painel:
            redundante com a subutilização composta (segue disponível no CSV).
          </p>
          <p>Pipeline: data-pipeline/python/build_emprego_pnad.py (schema v2) · GitHub Actions (cron mensal, dia 16).</p>
        </div>
      }
    />
  );
}
