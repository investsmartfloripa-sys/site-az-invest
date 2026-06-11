"use client";

import { useMemo } from "react";

import type { IpcaData } from "@/lib/painel-ipca";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtMesCurto, fmtMesLongo, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { AnchorContribuicoes } from "./v2/AnchorContribuicoes";
import { NucleosCard } from "./v2/NucleosCard";
import { AberturaCards } from "./v2/AberturaCards";
import { DifusaoCard } from "./v2/DifusaoCard";
import { SazonalidadeCard } from "./v2/SazonalidadeCard";
import { InfluenciasCard } from "./v2/InfluenciasCard";
import { FocusCard } from "./v2/FocusCard";
import { AnaliseCompleta } from "./v2/AnaliseCompleta";
import { leituraMeta, leituraSazonal, num } from "./v2/shared";

/**
 * Painel IPCA v2 — vitrine da reforma analítica da área de economia.
 *
 * Duas camadas p/ dois públicos: leitura rápida no topo (manchete em prosa +
 * 4 KPIs + âncora de contribuições) e esmiuçamento profissional nos blocos
 * numerados (núcleos, abertura, difusão, sazonalidade, influências,
 * expectativas, análise completa com CSV).
 *
 * Regras de ouro herdadas do plano 2026-06-11:
 * - acumulado 12m SEMPRE composto/encadeado e SEMPRE vindo do builder;
 * - meta contínua (3,0% ± 1,5 p.p.) visível em todo gráfico de 12m;
 * - toda leitura de "alto/baixo" tem régua (média histórica, banda, mediana);
 * - um gráfico = uma pergunta; títulos afirmativos gerados por regra
 *   (thresholds documentados em v2/shared.ts).
 *
 * Requer ipca.json com schema_version ≥ 2 (a page faz o fallback).
 */
export function IpcaDashboardV2({ data }: { data: IpcaData }) {
  const mesRef = data.mes_recente;

  const derivados = useMemo(() => {
    const ultima = data.ipca_cheio.serie.find((r) => r.mes === mesRef);
    const ipcaM = num(ultima, "IPCA cheio");
    const ipca12m = num(ultima, "IPCA 12m");

    const sazMes = data.sazonalidade?.por_mes[mesRef.slice(5, 7)];
    const medianaSaz = sazMes?.mediana ?? null;

    const nucU = data.nucleos.serie_12m?.[data.nucleos.serie_12m.length - 1];
    const mediaNucleos = nucU ? num(nucU, "media_nucleos") : null;

    const difU = data.difusao.serie[data.difusao.serie.length - 1];
    const difusaoM = typeof difU?.difusao === "number" ? difU.difusao : null;
    const difMedia = data.difusao.media_historica?.media ?? null;

    return { ipcaM, ipca12m, medianaSaz, mediaNucleos, difusaoM, difMedia };
  }, [data, mesRef]);

  const { ipcaM, ipca12m, medianaSaz, mediaNucleos, difusaoM, difMedia } = derivados;

  // ── Manchete em prosa, gerada por regra (thresholds em v2/shared.ts) ──────
  const manchete = useMemo(() => {
    if (ipcaM == null || ipca12m == null) return null;
    const partes: string[] = [];
    const relSaz = medianaSaz != null ? leituraSazonal(ipcaM, medianaSaz) : null;
    partes.push(
      `O IPCA de ${fmtMesCurto(mesRef)} veio em ${fmtSignedPct(ipcaM, 2)}` +
        (relSaz != null && medianaSaz != null
          ? relSaz === "em linha"
            ? `, em linha com o padrão sazonal do mês (mediana histórica de ${fmtSignedPct(medianaSaz, 2)})`
            : `, ${relSaz} do padrão sazonal do mês (mediana histórica de ${fmtSignedPct(medianaSaz, 2)})`
          : ""),
    );
    partes.push(`em 12 meses acumula ${fmtPct(ipca12m, 2)}, ${leituraMeta(ipca12m)}`);
    if (mediaNucleos != null) partes.push(`a média dos 5 núcleos do BC está em ${fmtPct(mediaNucleos, 2)}`);
    if (difusaoM != null && difMedia != null) {
      partes.push(
        `e a difusão de ${fmtPct(difusaoM, 0)} indica alta ${difusaoM > difMedia ? "mais espalhada" : "menos espalhada"} que a média histórica`,
      );
    }
    return `${partes.join("; ")}.`;
  }, [ipcaM, ipca12m, medianaSaz, mediaNucleos, difusaoM, difMedia, mesRef]);

  // ── KPIs (máx. 4) — todos com régua explícita no badge ───────────────────
  const kpis = [
    <KpiCard
      key="mes"
      label="IPCA do mês"
      value={fmtSignedPct(ipcaM, 2)}
      delta={ipcaM != null && medianaSaz != null ? ipcaM - medianaSaz : null}
      deltaUnit="p.p."
      deltaHint="vs padrão do mês"
      invertColor
      hint={medianaSaz != null ? `mediana hist.: ${fmtSignedPct(medianaSaz, 2)}` : undefined}
    />,
    <KpiCard
      key="12m"
      label="IPCA 12 meses"
      value={fmtPct(ipca12m, 2)}
      delta={ipca12m != null ? ipca12m - 3.0 : null}
      deltaUnit="p.p."
      deltaHint="vs meta 3,0%"
      invertColor
      hint="banda: 1,5% a 4,5%"
    />,
    <KpiCard
      key="nucleos"
      label="Núcleos 12m (média)"
      value={fmtPct(mediaNucleos, 2)}
      delta={mediaNucleos != null ? mediaNucleos - 3.0 : null}
      deltaUnit="p.p."
      deltaHint="vs meta 3,0%"
      invertColor
      hint="EX0 · EX3 · MS · DP · P"
    />,
    <KpiCard
      key="difusao"
      label="Difusão do mês"
      value={fmtPct(difusaoM, 1)}
      delta={difusaoM != null && difMedia != null ? difusaoM - difMedia : null}
      deltaUnit="p.p."
      deltaHint={`vs média ${data.difusao.media_historica?.desde.slice(0, 4) ?? "hist."}+`}
      invertColor
      hint="% de subitens em alta"
    />,
  ];

  // ── Blocos numerados (esmiuçamento) ───────────────────────────────────────
  const blocos: DashboardBloco[] = [
    {
      id: "nucleos",
      eyebrow: "Tendência subjacente",
      titulo: "Núcleos de inflação",
      descricao: "O que sobra da inflação quando se tiram os choques de alimentos e energia.",
      children: <NucleosCard nucleos={data.nucleos} geradoEm={data.gerado_em} />,
    },
    {
      id: "abertura",
      eyebrow: "Composição",
      titulo: "Livres, monitorados e serviços",
      descricao: "Dois recortes, duas perguntas — sem conjuntos sobrepostos no mesmo gráfico.",
      children: <AberturaCards categorias={data.categorias} nucleos={data.nucleos} geradoEm={data.gerado_em} />,
    },
    {
      id: "difusao",
      eyebrow: "Espalhamento",
      titulo: "Índice de difusão",
      descricao: "Quantos preços sobem ao mesmo tempo — com a média histórica como régua.",
      children: <DifusaoCard difusao={data.difusao} geradoEm={data.gerado_em} />,
    },
    {
      id: "sazonalidade",
      eyebrow: "Padrão do calendário",
      titulo: "Sazonalidade",
      descricao: "O número do mês comparado ao padrão histórico do próprio mês civil.",
      children: <SazonalidadeCard data={data} />,
    },
    {
      id: "influencias",
      eyebrow: "Microscópio do mês",
      titulo: "Maiores influências",
      descricao: "Itens que fizeram o índice — barras que somam o IPCA cheio + tabela completa.",
      children: <InfluenciasCard data={data} />,
    },
  ];

  if (data.focus && Object.keys(data.focus).length > 0) {
    blocos.push({
      id: "expectativas",
      eyebrow: "O que vem pela frente",
      titulo: "Expectativas (Focus)",
      descricao: "O que o mercado projeta para os próximos anos — contra a banda da meta.",
      children: <FocusCard focus={data.focus} geradoEm={data.gerado_em} />,
    });
  }

  blocos.push({
    id: "analise-completa",
    eyebrow: "Esmiuçamento",
    titulo: "Análise completa",
    descricao: "A mesma série em múltiplas transformações + download dos dados em CSV.",
    children: <AnaliseCompleta data={data} />,
  });

  return (
    <DashboardScaffold
      header={{
        titulo: "Painel IPCA",
        subtitulo: "Inflação ao consumidor — leitura rápida no topo, esmiuçamento profissional abaixo.",
        referencia: `Referência: ${fmtMesLongo(mesRef)} · IPCA-15 disponível até ${fmtMesCurto(data.ipca_15.mes_recente)}`,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={<AnchorContribuicoes indice={data.ipca_cheio} geradoEm={data.gerado_em} />}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA tabela 7060 (IPCA: v63 variação mensal, v66 peso, v2265
            acumulado 12m; nível Índice geral + 9 grupos; subitens do mês corrente p/ influências) e tabela 7062
            (IPCA-15: v355/v357/v1120). BCB/SGS: 433 (IPCA mensal, base da sazonalidade), núcleos 4466 (MA), 16121
            (MS), 11427 (EX0), 27838 (EX3), 27839 (DP), 28751 (P), difusão 21379, categorias 4448 (livres), 4449
            (monitorados), 11428 (serviços), 27864 (comercializáveis), 13522 (IPCA 12m, crosscheck). BCB/Olinda:
            ExpectativasMercadoAnuais (Focus). Última observação: {fmtMesLongo(mesRef)}.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Todo acumulado de 12 meses é COMPOSTO
            (Π(1+v/100)−1), nunca soma aritmética. A pilha de contribuições em 12m é encadeada
            [contrib·Π(1+IPCA/100) dos meses seguintes] e carrega um resíduo de arredondamento (≈ centésimos),
            realocado pró-rata para fechar exatamente com o IPCA 12m oficial — o resíduo pré-ajuste fica gravado no
            JSON. Contribuição mensal = variação × peso ÷ 100 (convenção do release do IBGE).
          </p>
          <p>
            <strong>Réguas e thresholds editoriais.</strong> Meta contínua do CMN: 3,0% ± 1,5 p.p. Difusão: média e
            desvio-padrão desde {data.difusao.media_historica?.desde ?? "2012-01"} (regime de metas maduro);
            “espalhada/concentrada” = MM3 fora de média ± 1 dp. Sazonalidade: mediana/mín–máx por mês civil na
            janela {data.sazonalidade?.janela ?? "—"}; “em linha com o padrão” = desvio ≤ 0,05 p.p. da mediana.
            Média dos núcleos = EX0·EX3·MS·DP·P (MA fora — versão não suavizada da MS).
          </p>
          <p>
            <strong>Próxima fase.</strong> Momentum 3m dessazonalizado anualizado (X-13/STL) p/ núcleos e serviços,
            realizado × Focus (expectativa 12 meses à frente), serviços subjacentes e recessões CODACE nas janelas
            longas.
          </p>
          <p>Pipeline: data-pipeline/python/build_ipca.py (schema v2) · atualização diária via GitHub Actions.</p>
        </div>
      }
    />
  );
}
