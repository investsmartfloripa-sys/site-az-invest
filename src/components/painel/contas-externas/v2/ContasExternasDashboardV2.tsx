"use client";

import { useMemo } from "react";

import type { ContasExternasComexData, ContasExternasData } from "@/lib/painel-contas-externas";
import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtDataBR, fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { SaldoAnualCard } from "./SaldoAnualCard";
import { Decomposicao12mCard } from "./Decomposicao12mCard";
import { Balanca12mCard } from "./Balanca12mCard";
import { Servicos12mCard } from "./Servicos12mCard";
import { Renda12mCard } from "./Renda12mCard";
import { CoberturaCard } from "./CoberturaCard";
import { IdpQualidadeCard } from "./IdpQualidadeCard";
import { ReservasCard } from "./ReservasCard";
import { ComexCards } from "./ComexCards";
import { AnaliseCompletaContasExternas } from "./AnaliseCompletaContasExternas";
import { PipelinePendente, fmtUsBi, num } from "./shared";

/**
 * Dashboard PRINCIPAL de Contas Externas — v2, template narrativo AZ
 * (manchete em prosa → 4 KPIs → âncora → blocos numerados → ficha técnica).
 *
 * Decisões analíticas (revisor, 2026-06):
 * - ACUMULADO 12m é o default; fluxo mensal bruto sobrevive só como eco;
 * - cobertura do déficit pelo IDP em RAZÃO única vs régua de 100% (não duas
 *   linhas com déficit clipado);
 * - réguas declaradas: ±2% PIB (guia editorial), déficit > 4% (referência
 *   assimétrica de risco), 3 meses de importação (regra de bolso do FMI — não 6);
 * - cores exclusivamente de AZ_CHART/AZ_SERIES (variationFill por sinal).
 */
export function ContasExternasDashboardV2({
  data,
  comex,
  codace,
}: {
  data: ContasExternasData;
  comex: ContasExternasComexData | null;
  codace: AtividadeCodaceData | null;
}) {
  const { hero, bloco_a, bloco_b, bloco_c } = data;

  const derivados = useMemo(() => {
    const tc = hero.saldo_tc_pct_pib.valor;

    // Cobertura: último ponto da série v2; fallback no hero (idp/|tc|).
    const cobSerie = bloco_b.cobertura_idp ?? [];
    const ultCob = cobSerie.length > 0 ? cobSerie[cobSerie.length - 1] : null;
    let cobertura: number | null = null;
    let tcSuperavitaria = false;
    if (ultCob) {
      tcSuperavitaria = typeof ultCob.tc_pct_pib === "number" && ultCob.tc_pct_pib >= 0;
      cobertura = typeof ultCob.cobertura_pct === "number" ? ultCob.cobertura_pct : null;
    } else if (tc != null && hero.idp_pct_pib.valor != null) {
      tcSuperavitaria = tc >= 0;
      cobertura = tc < 0 ? +(100 * (hero.idp_pct_pib.valor / Math.abs(tc))).toFixed(1) : null;
    }

    // Delta da TC vs 12 meses antes (em p.p. do PIB), da série de cobertura.
    let tcDelta12m: number | null = null;
    if (cobSerie.length > 12) {
      const agora = num(cobSerie[cobSerie.length - 1], "tc_pct_pib");
      const antes = num(cobSerie[cobSerie.length - 13], "tc_pct_pib");
      if (agora != null && antes != null) tcDelta12m = +(agora - antes).toFixed(2);
    }

    // Meses de importação: série v2 (bens+serviços preferido) com fallback no hero.
    const mesesSerie = bloco_c.meses_importacao_serie ?? [];
    let meses: number | null = null;
    let mesesEhBensServicos = false;
    for (let i = mesesSerie.length - 1; i >= 0; i--) {
      // Para no mês mais recente com QUALQUER observação (preferindo bens+serviços
      // dentro do mesmo mês) — nunca mistura meses distintos.
      const bs = num(mesesSerie[i], "meses_bens_servicos");
      const b = num(mesesSerie[i], "meses_bens");
      if (bs != null) {
        meses = bs;
        mesesEhBensServicos = true;
        break;
      }
      if (b != null) {
        meses = b;
        break;
      }
    }
    if (meses == null) meses = hero.meses_importacao.valor;

    return { tc, cobertura, tcSuperavitaria, tcDelta12m, meses, mesesEhBensServicos, reservas: hero.reservas_us_bi.valor };
  }, [hero, bloco_b.cobertura_idp, bloco_c.meses_importacao_serie]);

  // ── Manchete em prosa, gerada por regra ───────────────────────────────────
  const manchete = useMemo(() => {
    const { tc, cobertura, tcSuperavitaria, meses, reservas } = derivados;
    const partes: string[] = [];
    if (tc != null) {
      if (tc >= 0) {
        partes.push(`O Brasil roda com superávit em conta corrente de ${fmtPct(tc, 2)} do PIB em 12 meses — situação rara na série`);
      } else {
        const abs = Math.abs(tc);
        const leitura =
          abs <= 2
            ? "dentro da banda de ±2% do PIB que tratamos como zona de conforto editorial"
            : abs <= 4
              ? "acima da banda editorial de ±2%, mas abaixo da referência de risco de 4%"
              : "acima da referência de 4% do PIB, historicamente associada a paradas bruscas de financiamento";
        partes.push(`O Brasil roda com déficit em conta corrente de ${fmtPct(abs, 2)} do PIB em 12 meses — ${leitura}`);
      }
    }
    if (tcSuperavitaria) {
      partes.push("não há déficit a financiar — o IDP entra como acumulação líquida de ativos");
    } else if (cobertura != null) {
      partes.push(
        cobertura >= 100
          ? `o déficit é integralmente financiado por investimento direto (o IDP cobre ${fmtPct(cobertura, 0)} do buraco)`
          : cobertura >= 70
            ? `o IDP cobre ${fmtPct(cobertura, 0)} do déficit — o restante depende de capital mais volátil`
            : `o IDP cobre só ${fmtPct(cobertura, 0)} do déficit — atenção à qualidade do financiamento`,
      );
    }
    if (reservas != null) {
      partes.push(
        `o colchão de reservas soma ${fmtUsBi(reservas, 0)}${meses != null ? ` (${fmtNum(meses, 0)} meses de importação)` : ""}`,
      );
    }
    return partes.length > 0 ? `${partes.join("; ")}.` : null;
  }, [derivados]);

  // ── KPIs (máx. 4) ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const { tc, cobertura, tcSuperavitaria, tcDelta12m, meses, mesesEhBensServicos, reservas } = derivados;
    return [
      <KpiCard
        key="tc"
        label="Saldo em conta corrente (12m)"
        value={tc != null ? fmtSignedPct(tc, 2) : "—"}
        unit="do PIB"
        delta={tcDelta12m}
        deltaUnit="p.p."
        deltaHint="vs 12m antes"
        hint="banda editorial ±2% · risco: déficit > 4%"
        size="lg"
      />,
      <KpiCard
        key="cobertura"
        label="Cobertura pelo IDP"
        value={tcSuperavitaria ? "—" : cobertura != null ? fmtPct(cobertura, 0) : "—"}
        hint={
          tcSuperavitaria
            ? "TC superavitária — sem déficit a financiar"
            : "≥100% = déficit financiado por capital de longo prazo"
        }
      />,
      <KpiCard
        key="reservas"
        label="Reservas internacionais"
        value={reservas != null ? fmtNum(reservas, 0) : "—"}
        unit="US$ bi"
        hint={`conceito liquidez${data.ultima_referencia_diaria ? ` · ${fmtDataBR(data.ultima_referencia_diaria)}` : ""}`}
      />,
      <KpiCard
        key="meses"
        label="Meses de importação"
        value={meses != null ? fmtNum(meses, 1) : "—"}
        unit="meses"
        hint={`regra de bolso FMI: 3 meses${mesesEhBensServicos ? " (bens e serviços)" : " (bens)"}`}
      />,
    ];
  }, [derivados, data.ultima_referencia_diaria]);

  // ── Blocos numerados (degrade gracioso por bloco) ─────────────────────────
  const blocos = useMemo<DashboardBloco[]>(() => {
    const out: DashboardBloco[] = [
      {
        id: "decomposicao",
        eyebrow: "Balanço de pagamentos",
        titulo: "De onde vem o saldo",
        descricao:
          "O comércio paga a conta dos lucros? A decomposição da conta corrente em 12 meses — e o eco do mês contra o mesmo mês do ano anterior.",
        children: bloco_a.decomposicao_12m?.length ? (
          <Decomposicao12mCard
            decomposicao12m={bloco_a.decomposicao_12m}
            decomposicaoMensal36m={bloco_a.decomposicao_mensal_36m}
            geradoEm={data.gerado_em}
          />
        ) : (
          <PipelinePendente oQue="a decomposição 12m (decomposicao_12m)" />
        ),
      },
      {
        id: "balanca",
        eyebrow: "Balança comercial",
        titulo: "Comércio: o superávit cresce?",
        descricao: "Exportações, importações e saldo de bens (BPM6) na janela de 12 meses, com o recorde da série anotado.",
        children: bloco_a.balanca_12m?.length ? (
          <Balanca12mCard balanca12m={bloco_a.balanca_12m} geradoEm={data.gerado_em} />
        ) : (
          <PipelinePendente oQue="a balança comercial 12m (balanca_12m)" />
        ),
      },
      {
        id: "servicos",
        eyebrow: "Serviços",
        titulo: "Onde mora o rombo de serviços",
        descricao: "O déficit estrutural de serviços aberto por conta: transportes, viagens, telecom, propriedade intelectual.",
        children: data.bloco_servicos?.serie_12m?.length ? (
          <Servicos12mCard
            serie12m={data.bloco_servicos.serie_12m}
            nota={data.bloco_servicos._nota}
            geradoEm={data.gerado_em}
          />
        ) : (
          <PipelinePendente oQue="a decomposição de serviços 12m (bloco_servicos)" />
        ),
      },
      {
        id: "renda",
        eyebrow: "Renda primária",
        titulo: "Lucros e juros: por que o déficit não vai embora",
        descricao:
          "A remuneração do capital estrangeiro instalado no país — o componente mais estável (e mais negativo) da conta corrente.",
        children: data.bloco_renda?.serie_12m?.length ? (
          <Renda12mCard
            serie12m={data.bloco_renda.serie_12m}
            decomposicao12m={bloco_a.decomposicao_12m ?? []}
            nota={data.bloco_renda._nota}
            geradoEm={data.gerado_em}
          />
        ) : (
          <PipelinePendente oQue="a decomposição da renda primária 12m (bloco_renda)" />
        ),
      },
      {
        id: "financiamento",
        eyebrow: "Financiamento",
        titulo: "O financiamento é sadio?",
        descricao:
          "Quanto do déficit o investimento direto cobre — e de que tipo de IDP estamos falando (participação ≠ quase-dívida intercompanhia).",
        children: (
          <div className="grid gap-4 xl:grid-cols-2">
            {bloco_b.cobertura_idp?.length ? (
              <CoberturaCard cobertura={bloco_b.cobertura_idp} geradoEm={data.gerado_em} />
            ) : (
              <PipelinePendente oQue="a razão de cobertura (cobertura_idp)" />
            )}
            {bloco_b.idp_decomposicao_12m?.length ? (
              <IdpQualidadeCard serie12m={bloco_b.idp_decomposicao_12m} geradoEm={data.gerado_em} />
            ) : (
              <PipelinePendente oQue="a decomposição do IDP 12m (idp_decomposicao_12m)" />
            )}
          </div>
        ),
      },
      {
        id: "reservas",
        eyebrow: "Reservas",
        titulo: "O colchão",
        descricao: "Quantos meses de importação as reservas pagam — e o nível do estoque em US$ bilhões.",
        children: <ReservasCard blocoC={bloco_c} geradoEm={data.gerado_em} />,
      },
    ];

    if (comex) {
      out.push({
        id: "comex",
        eyebrow: "Comércio exterior",
        titulo: "Comex em 3 cards",
        descricao: "Composição da pauta por categoria e por parceiro — SECEX/MDIC, com a concentração na China em destaque.",
        children: <ComexCards comex={comex} />,
      });
    }

    out.push({
      id: "analise-completa",
      eyebrow: "Esmiuçamento",
      titulo: "Análise completa",
      descricao: "As séries 12m lado a lado, mês a mês, e o export CSV de cada bloco.",
      children: <AnaliseCompletaContasExternas data={data} />,
    });

    return out;
  }, [data, comex, bloco_a, bloco_b, bloco_c]);

  const referencia = [
    `Referência: ${data.ultima_referencia_mensal ? fmtMesCurto(data.ultima_referencia_mensal) : "—"}`,
    data.ultima_referencia_diaria ? `Reservas em ${fmtDataBR(data.ultima_referencia_diaria)}` : null,
    comex ? `Comex ${comex.periodo_12m.from} a ${comex.periodo_12m.to}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DashboardScaffold
      header={{
        titulo: "Contas Externas — Brasil",
        subtitulo:
          "Balanço de pagamentos BPM6 do BCB em acumulado de 12 meses, financiamento por investimento direto, reservas e a pauta de comércio da SECEX/MDIC.",
        referencia,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={
        <SaldoAnualCard
          saldoAnual={bloco_a.saldo_anual}
          codaceTrimestral={codace?.trimestral}
          geradoEm={data.gerado_em}
          ultimaReferencia={data.ultima_referencia_mensal}
        />
      }
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries (BCB/SGS, BPM6).</strong> Transações correntes 22701; bens 22707 (exportações 22711,
            importações por identidade); serviços 22719 (transportes 22728, viagens 22740, telecom/computação/informação
            22776, propriedade intelectual 22779; demais = residual auditado); renda primária 22800 (lucros e dividendos de
            IDP 22812, lucros reinvestidos 22815, salários 22803; juros e demais = residual auditado da renda de
            investimento 22806); renda secundária 22838; IDP 22885 (participação 22891, reinvestimento 22892,
            intercompanhia = residual); reservas internacionais 13982 (diária, conceito liquidez). Denominador dos % do
            PIB: PIB acumulado em 12 meses em US$ (SGS 4192). Comércio por produto e país: SECEX/MDIC Comex Stat (NCM).
            Recessões: cronologia CODACE/FGV.
          </p>
          <p>
            <strong>Correção histórica (importante).</strong> Na versão anterior deste painel, a série apresentada como
            &quot;renda primária&quot; era na verdade VIAGENS (SGS 22740) — corrigido para a renda primária de fato (22800). O
            denominador dos percentuais do PIB também foi corrigido para o PIB de 12 meses em US$ (SGS 4192). Com as duas
            correções, os números em % do PIB mudaram na casa de 2× — a leitura econômica anterior estava distorcida.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Todas as séries analíticas em ACUMULADO 12m: o fluxo
            mensal bruto do BP é dominado por sazonalidade (soja no 1º semestre, remessas de lucros no fim do ano) e só
            aparece como &quot;eco mensal&quot; contra o mesmo mês do ano anterior. Identidades (componentes = total) auditadas no
            builder com tolerância absoluta; resíduos são gravados como série própria, nunca forçados. Cobertura do déficit
            = IDP 12m ÷ |TC 12m|, sem leitura quando a TC está superavitária. Meses de importação = reservas ÷ média mensal
            12m das importações (bens e serviços quando disponível).
          </p>
          <p>
            <strong>Réguas editoriais (declaradas, não &quot;científicas&quot;).</strong> Banda de ±2% do PIB para a conta corrente é
            guia editorial — não há consenso de literatura; a referência de RISCO é assimétrica: déficits acima de 4% do
            PIB. Cobertura de 100% pelo IDP = déficit integralmente financiado por capital de longo prazo. Reservas: a
            regra de bolso do FMI é 3 MESES de importação (não 6) — o Brasil opera muito acima e a régua é contexto.
          </p>
          <p>
            <strong>Evoluções registradas.</strong> Contribuições YoY por seção do Comex (exige nível t-12 no builder);
            Guidotti–Greenspan (reservas ≥ dívida externa de curto prazo — sem série integrada); métrica ARA do FMI.
          </p>
          <p>Pipeline: data-pipeline/python/build_contas_externas.py (schema v2) · workflow contas-externas-pipeline.yml.</p>
        </div>
      }
    />
  );
}
