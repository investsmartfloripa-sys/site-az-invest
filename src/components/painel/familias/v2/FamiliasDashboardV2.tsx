"use client";

import { useMemo } from "react";

import type { FamiliasData } from "@/lib/painel-familias";
import type { PnadData } from "@/lib/painel-emprego";
import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtBRL, fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { delta12m, fmtTrimMovel, pontosData, serieToPoints } from "./shared";
import { RendaRealCard } from "./RendaRealCard";
import { MassaFamiliasCard } from "./MassaFamiliasCard";
import { RendaPosicaoCard } from "./RendaPosicaoCard";
import { EndividamentoCard } from "./EndividamentoCard";
import { ComprometimentoCard } from "./ComprometimentoCard";
import { JurosPfCard } from "./JurosPfCard";
import { InadimplenciaCard } from "./InadimplenciaCard";
import { EstoqueCard } from "./EstoqueCard";
import { CestaCard } from "./CestaCard";
import { SmRealCard } from "./SmRealCard";
import { SmDolarCard } from "./SmDolarCard";
import { FipezapCard } from "./FipezapCard";
import { ConcentracaoCard } from "./ConcentracaoCard";
import { PobrezaCard } from "./PobrezaCard";
import { TransferenciasReaisCard } from "./TransferenciasReaisCard";
import { GiniCard } from "./GiniCard";
import { IpcaFaixaCard } from "./IpcaFaixaCard";
import { AnaliseCompletaFamilias } from "./AnaliseCompletaFamilias";

/**
 * Painel Famílias v2 — template narrativo (manchete em prosa → 4 KPIs →
 * âncora da renda real → blocos numerados → ficha técnica). Substitui o
 * dashboard de 12 hero-KPIs: leitura rápida em cima, esmiuçamento
 * profissional embaixo. Cada bloco degrada graciosamente quando o JSON
 * correspondente está ausente (poder_compra pode estar null no Blob).
 */

export function FamiliasDashboardV2({
  data,
  massaPnad,
  codace,
}: {
  data: FamiliasData;
  massaPnad: PnadData | null;
  codace: AtividadeCodaceData | null;
}) {
  const { renda, endividamento, poder_compra, estrutura_social } = data;
  const codaceMensal = codace?.mensal;

  // ------------------------------------------------------------------
  // Derivados p/ manchete e KPIs
  // ------------------------------------------------------------------
  const derivados = useMemo(() => {
    const heroRenda = renda?.hero?.renda_real ?? null;

    const endivPts = serieToPoints(endividamento?.bloco_endividamento.series_pontos["total"]);
    const endivUlt = endivPts.length > 0 ? endivPts[endivPts.length - 1][1] : null;
    const endivDelta = delta12m(endivPts);

    const compPts = serieToPoints(endividamento?.bloco_comprometimento.series_pontos["servico_divida"]);
    const compUlt = compPts.length > 0 ? compPts[compPts.length - 1][1] : null;
    const compDelta = delta12m(compPts);

    const cestaPts = pontosData(poder_compra?.bloco_cesta_basica.serie, "horas_sm");
    const cestaUlt = cestaPts.length > 0 ? cestaPts[cestaPts.length - 1][1] : null;
    const cestaDelta = delta12m(cestaPts);
    const cestaPctSm = poder_compra?.hero?.cesta_horas_sm?.pct_sm ?? null;

    const smUsd = poder_compra?.hero?.sm_usd_ptax?.valor ?? null;
    const top10 = estrutura_social?.hero?.concentracao_top10?.valor ?? null;
    const pobreza = estrutura_social?.hero?.pobreza_pct_830?.valor ?? null;

    return { heroRenda, endivUlt, endivDelta, compUlt, compDelta, cestaUlt, cestaDelta, cestaPctSm, smUsd, top10, pobreza };
  }, [renda, endividamento, poder_compra, estrutura_social]);

  // ------------------------------------------------------------------
  // Manchete por regra — prosa de 3-4 frases; cada frase só entra com dado.
  // ------------------------------------------------------------------
  const manchete = useMemo(() => {
    const frases: string[] = [];
    const r = derivados.heroRenda;
    if (r?.valor != null) {
      const v = r.var_pct_aa_real;
      const dir =
        v == null
          ? "na comparação anual"
          : v > 0.5
            ? `alta real de ${fmtPct(v, 1)} em 12 meses`
            : v < -0.5
              ? `queda real de ${fmtPct(Math.abs(v), 1)} em 12 meses`
              : "praticamente estável em termos reais";
      frases.push(
        `No trimestre móvel ${r.trim ? fmtTrimMovel(r.trim) : "mais recente"}, o trabalhador brasileiro ganhou em média ${fmtBRL(
          r.valor,
          0,
        )} por mês, ${dir}.`,
      );
    }
    if (derivados.endivUlt != null && derivados.compUlt != null) {
      frases.push(
        `As famílias devem aos bancos o equivalente a ${fmtPct(derivados.endivUlt, 1)} da renda acumulada em 12 meses e destinam ${fmtPct(
          derivados.compUlt,
          1,
        )} da renda do mês ao serviço da dívida.`,
      );
    }
    if (derivados.cestaUlt != null) {
      frases.push(
        `Uma cesta básica custa ${fmtNum(derivados.cestaUlt, 0)} horas de salário mínimo${
          derivados.smUsd != null ? `, e o mínimo equivale a US$ ${fmtNum(derivados.smUsd, 0)} pela PTAX` : ""
        }.`,
      );
    }
    if (derivados.top10 != null && derivados.pobreza != null) {
      frases.push(
        `Na estrutura social, os 10% mais ricos concentram ${fmtPct(derivados.top10, 1)} da renda e ${fmtPct(
          derivados.pobreza,
          1,
        )} da população vive com menos de US$ 8,30 por dia (PPC).`,
      );
    }
    return frases.length > 0 ? frases.join(" ") : null;
  }, [derivados]);

  // ------------------------------------------------------------------
  // 4 KPIs (era 12 — os demais viraram destaques dos blocos)
  // ------------------------------------------------------------------
  const kpis = useMemo(() => {
    const r = derivados.heroRenda;
    return [
      <KpiCard
        key="renda"
        label="Renda real do trabalho"
        value={r?.valor != null ? fmtBRL(r.valor, 0) : "—"}
        unit="por mês"
        delta={r?.var_pct_aa_real ?? undefined}
        deltaUnit="%"
        deltaHint="real, 12m"
        hint={r?.trim ? `trim. móvel ${fmtTrimMovel(r.trim)}` : undefined}
        size="lg"
      />,
      <KpiCard
        key="endividamento"
        label="Endividamento total"
        value={derivados.endivUlt != null ? fmtPct(derivados.endivUlt, 1) : "—"}
        unit="da renda 12m"
        delta={derivados.endivDelta ?? undefined}
        deltaUnit="p.p."
        deltaHint="vs 12m"
        invertColor
        hint="dívida bancária ÷ renda anual"
      />,
      <KpiCard
        key="comprometimento"
        label="Comprometimento mensal"
        value={derivados.compUlt != null ? fmtPct(derivados.compUlt, 1) : "—"}
        unit="da renda do mês"
        delta={derivados.compDelta ?? undefined}
        deltaUnit="p.p."
        deltaHint="vs 12m"
        invertColor
        hint="juros + amortização"
      />,
      <KpiCard
        key="cesta"
        label="Cesta básica"
        value={derivados.cestaUlt != null ? `${fmtNum(derivados.cestaUlt, 0)} h` : "—"}
        unit="de salário mínimo"
        delta={derivados.cestaDelta ?? undefined}
        deltaUnit="abs"
        deltaHint="h vs 12m"
        invertColor
        hint={derivados.cestaPctSm != null ? `${fmtPct(derivados.cestaPctSm, 0)} do SM bruto` : undefined}
      />,
    ];
  }, [derivados]);

  // ------------------------------------------------------------------
  // Blocos numerados
  // ------------------------------------------------------------------
  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [];

    if (massaPnad?.massa_rendimento?.serie?.length) {
      out.push({
        id: "massa",
        eyebrow: "Renda agregada",
        titulo: "O bolo de salários",
        descricao: "A massa real de rendimento do trabalho — renda média × ocupados, o combustível do consumo das famílias.",
        children: <MassaFamiliasCard massa={massaPnad.massa_rendimento} codaceMensal={codaceMensal} geradoEm={massaPnad.gerado_em} />,
      });
    }

    if (renda) {
      out.push({
        id: "renda-posicao",
        eyebrow: "Renda relativa",
        titulo: "Renda: quem ganha a corrida?",
        descricao: "O prêmio da carteira assinada (razão formal ÷ informal) e a trajetória das 4 posições em base 100.",
        children: <RendaPosicaoCard renda={renda} codaceMensal={codaceMensal} geradoEm={renda.gerado_em} />,
      });
    }

    if (endividamento) {
      out.push({
        id: "endividamento",
        eyebrow: "Balanço das famílias",
        titulo: "Dívida: patrimônio ou consumo?",
        descricao: "O estoque de dívida em % da renda anual, separando a casa própria do crédito de consumo.",
        children: <EndividamentoCard endividamento={endividamento} geradoEm={endividamento.gerado_em} />,
      });
      out.push({
        id: "comprometimento",
        eyebrow: "Fluxo mensal",
        titulo: "Quanto do salário vai ao banco?",
        descricao: "O serviço da dívida decomposto em juros e amortização — e o efeito dos ciclos de aperto da Selic.",
        children: (
          <ComprometimentoCard endividamento={endividamento} codaceMensal={codaceMensal} geradoEm={endividamento.gerado_em} />
        ),
      });
      if (endividamento.bloco_juros && Object.keys(endividamento.bloco_juros.series_pontos ?? {}).length > 0) {
        out.push({
          id: "juros",
          eyebrow: "Preço do crédito",
          titulo: "A que preço?",
          descricao: "As taxas que a família paga por modalidade, contra a Selic — o spread é o resto da história.",
          children: <JurosPfCard juros={endividamento.bloco_juros} geradoEm={endividamento.gerado_em} />,
        });
      }
      out.push({
        id: "inadimplencia",
        eyebrow: "Qualidade do crédito",
        titulo: "Estresse de crédito",
        descricao: "Atrasos acima de 90 dias por modalidade — com o rotativo na escala certa: a do chip.",
        children: <InadimplenciaCard endividamento={endividamento} geradoEm={endividamento.gerado_em} />,
      });
      if (endividamento.bloco_estoque.composicao_pct?.length) {
        out.push({
          id: "estoque",
          eyebrow: "Estrutura da dívida",
          titulo: "Onde mora a dívida",
          descricao: "A composição do saldo de crédito PF ao longo do tempo — a foto estrutural, com os marcos regulatórios.",
          children: <EstoqueCard endividamento={endividamento} geradoEm={endividamento.gerado_em} />,
        });
      }
    }

    const temSmReal = (renda?.bloco_salario_minimo?.real_serie?.length ?? 0) > 0;
    if (poder_compra || temSmReal) {
      out.push({
        id: "poder-compra",
        eyebrow: "Régua estrutural",
        titulo: "Poder de compra",
        descricao:
          "O salário medido em coisas: salário mínimo real, cesta básica em horas, dólar (PTAX × PPC) e imóveis contra a inflação.",
        children: (
          <div className="flex flex-col gap-4">
            {poder_compra ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <CestaCard poderCompra={poder_compra} geradoEm={poder_compra.gerado_em} />
                <SmDolarCard poderCompra={poder_compra} geradoEm={poder_compra.gerado_em} />
              </div>
            ) : null}
            <div className="grid gap-4 xl:grid-cols-2">
              {renda && temSmReal ? <SmRealCard renda={renda} geradoEm={renda.gerado_em} /> : null}
              {poder_compra ? <FipezapCard poderCompra={poder_compra} geradoEm={poder_compra.gerado_em} /> : null}
            </div>
          </div>
        ),
      });
    }

    if (estrutura_social) {
      out.push({
        id: "estrutura-social",
        eyebrow: "Distribuição",
        titulo: "Estrutura social",
        descricao:
          "Concentração, pobreza, transferências em termos reais, Gini e a inflação que cada faixa de renda realmente sente.",
        children: (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <ConcentracaoCard estruturaSocial={estrutura_social} geradoEm={estrutura_social.gerado_em} />
              <PobrezaCard estruturaSocial={estrutura_social} geradoEm={estrutura_social.gerado_em} />
            </div>
            <TransferenciasReaisCard estruturaSocial={estrutura_social} geradoEm={estrutura_social.gerado_em} />
            <div className="grid gap-4 xl:grid-cols-2">
              <GiniCard estruturaSocial={estrutura_social} geradoEm={estrutura_social.gerado_em} />
              <IpcaFaixaCard estruturaSocial={estrutura_social} geradoEm={estrutura_social.gerado_em} />
            </div>
          </div>
        ),
      });
    }

    out.push({
      id: "analise-completa",
      eyebrow: "Esmiuçamento",
      titulo: "Análise completa",
      descricao: "Tabela dos últimos 12 meses e as séries integrais de cada bloco em CSV.",
      children: <AnaliseCompletaFamilias data={data} geradoEm={endividamento?.gerado_em ?? renda?.gerado_em ?? ""} />,
    });

    return out;
  }, [data, renda, endividamento, poder_compra, estrutura_social, massaPnad, codaceMensal]);

  const referencia = [
    renda?.trim_recente ? `PNAD: trim. móvel ${fmtTrimMovel(renda.trim_recente)}` : null,
    endividamento?.ultima_referencia_mensal ? `BCB: ${fmtMesCurto(endividamento.ultima_referencia_mensal)}` : null,
    poder_compra?.mes_recente ? `Poder de compra: ${fmtMesCurto(poder_compra.mes_recente)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DashboardScaffold
      header={{
        titulo: "Famílias — Brasil",
        subtitulo:
          "A saúde financeira das famílias em quatro perguntas: quanto o trabalho rende, quanto custa a dívida, o que o salário compra e como a renda se distribui.",
        referencia: referencia ? `Referência: ${referencia}` : undefined,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={renda ? <RendaRealCard renda={renda} codaceMensal={codaceMensal} geradoEm={renda.gerado_em} /> : undefined}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes por bloco.</strong> Renda: IBGE/SIDRA PNAD Contínua 6390 (rendimento médio), 6389 (por posição na
            ocupação) e 6392 (massa de rendimento, via painel Emprego). Endividamento: BCB SGS 29037/29038 (endividamento),
            29033/29034/29036 (comprometimento), inadimplência e taxas por modalidade (recursos livres PF), saldos 20541+
            (composição do estoque). Poder de compra: DIEESE via Ipeadata (cesta básica, painel fixo de capitais), BCB SGS
            1619/3697 (SM e PTAX), Ipeadata/IPEA (SM em US$ PPC), FipeZap (Ipeadata FIPE12_VENBR12) e IPCA 12m (SGS 13522).
            Estrutura social: IBGE/SIDRA 7530 (concentração) e 7435 (Gini), Ipeadata (pobreza, transferências MDS, IPCA por
            faixa de renda do IPEA). Recessões: cronologia CODACE/FGV (última datação oficial: 2020).
          </p>
          <p>
            <strong>Deflatores — declarados.</strong> As séries da PNAD Contínua (renda, posição, massa) já chegam
            DEFLACIONADAS pelo próprio IBGE, com deflatores do IPCA específicos da pesquisa — não usamos INPC nem
            re-deflacionamos nada. Salário mínimo real (Ipeadata GAC12_SALMINRE12) e transferências sociais (PBF/BPC, R$
            constantes no builder, base = último mês com índice publicado) usam INPC. FipeZap é comparado ao IPCA acumulado
            em 12 meses no mesmo eixo — a distância é a variação real.
          </p>
          <p>
            <strong>Janelas e réguas.</strong> PNAD Contínua é TRIMESTRE MÓVEL: cada ponto agrega 3 meses terminados no mês do
            rótulo — compare sempre com o mesmo trimestre móvel do ano anterior. Cesta básica usa painel FIXO de capitais
            (média simples) e a régua própria SM bruto ÷ 220h — difere da conta oficial do DIEESE. Endividamento sem &quot;faixa de
            risco&quot;: não há limiar técnico consensual, e na comparação da OCDE (dívida ÷ renda disponível) o nível brasileiro é
            baixo ante economias avançadas — com denominadores e cobertura (só SFN) diferentes, a comparação é indicativa.
            Faixas editoriais (ciclos de aperto Selic, regimes do salário mínimo, marcos regulatórios) são sempre declaradas
            nos footers dos cards.
          </p>
          <p>Pipeline: data-pipeline (familias-pipeline.yml, diário 23h30 UTC) · schema v2 dos JSONs no Blob.</p>
        </div>
      }
    />
  );
}
