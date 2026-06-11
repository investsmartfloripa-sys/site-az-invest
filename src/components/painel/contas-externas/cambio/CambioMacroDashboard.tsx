"use client";

import { useMemo } from "react";

import type { CambioMacroData } from "@/lib/painel-contas-externas";
import { DashboardScaffold, KpiCard, type DashboardBloco } from "@/components/painel/core";
import { fmtDataBR, fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { CambioRealCard } from "./CambioRealCard";
import { ParidadeJurosCard } from "./ParidadeJurosCard";
import { UipScatterCard } from "./UipScatterCard";
import { ModelosPrevisaoCard } from "./ModelosPrevisaoCard";
import { TabelaMensalCard } from "./TabelaMensalCard";
import { leituraDesvio } from "./shared";

/**
 * Sub-área CÂMBIO ECONÔMICO (Contas Externas → Câmbio).
 *
 * Duas camadas: leitura rápida (manchete em prosa + 4 KPIs) e esmiuçamento
 * (01 câmbio real · 02 paridade de juros · 03 UIP na prática · 04 modelos de
 * previsão em construção · 05 tabela mensal com CSV).
 *
 * Regras de ouro herdadas do plano 2026-06-11:
 * - convenção ÚNICA e explícita: ALTA do índice de câmbio real = DEPRECIAÇÃO
 *   real do BRL (REER 11752 e bilateral) — leitura invertida já foi pega em
 *   revisão e não pode voltar;
 * - toda régua é honesta: média histórica ± 1 dp NÃO é taxa de equilíbrio;
 * - a UIP é mostrada FALHANDO (dispersão) — é o que a literatura documenta.
 */
export function CambioMacroDashboard({ data }: { data: CambioMacroData }) {
  const derivados = useMemo(() => {
    const hero = data.hero;
    const nominal = data.nominal.serie;
    const difSerie = data.juros.diferencial.serie;

    // Variação 12m da PTAX média mensal (último mês fechado vs 12 antes).
    const uN = nominal[nominal.length - 1] ?? null;
    const uN12 = nominal.length > 12 ? nominal[nominal.length - 13] : null;
    const ptaxVar12m =
      uN && uN12 && uN12.ptax_media > 0 ? (uN.ptax_media / uN12.ptax_media - 1) * 100 : null;

    const uD = difSerie[difSerie.length - 1] ?? null;
    const uD12 = difSerie.length > 12 ? difSerie[difSerie.length - 13] : null;
    const difDelta12m = uD && uD12 ? uD.diferencial_pp - uD12.diferencial_pp : null;

    const bilateral = data.cambio_real.bilateral;
    const dpPct = bilateral.media_hist > 0 ? (bilateral.dp_hist / bilateral.media_hist) * 100 : 0;
    const leitura =
      hero.bilateral_vs_media_pct != null ? leituraDesvio(hero.bilateral_vs_media_pct, dpPct) : null;

    return { ptaxVar12m, difAtual: uD, difDelta12m, leitura };
  }, [data]);

  const hero = data.hero;
  const bilateral = data.cambio_real.bilateral;
  const reer = data.cambio_real.reer;
  const { ptaxVar12m, difAtual, difDelta12m, leitura } = derivados;

  // ── Manchete em prosa, gerada por regra ───────────────────────────────────
  const manchete = useMemo(() => {
    const partes: string[] = [];
    if (hero.bilateral_vs_media_pct != null && leitura) {
      partes.push(
        leitura === "em linha"
          ? `O real opera em linha com a própria média histórica em termos reais (${fmtSignedPct(hero.bilateral_vs_media_pct, 1)} vs média ${bilateral.janela_regua})`
          : `O real opera ${fmtPct(Math.abs(hero.bilateral_vs_media_pct), 1)} ${leitura} que a própria média histórica em termos reais (bilateral vs EUA, ${bilateral.janela_regua})`,
      );
    }
    if (hero.reer_var_12m_pct != null) {
      partes.push(
        `em 12 meses o câmbio efetivo real teve ${
          hero.reer_var_12m_pct > 0 ? "depreciação" : "apreciação"
        } de ${fmtPct(Math.abs(hero.reer_var_12m_pct), 1)} (REER do BCB)`,
      );
    }
    if (hero.diferencial_pp != null) {
      partes.push(
        `e o diferencial de juros de ${fmtNum(hero.diferencial_pp, 1)} p.p. sobre os EUA ${
          hero.diferencial_pp >= 5 ? "segue entre os maiores entre as grandes economias" : "segue relevante"
        }`,
      );
    }
    return partes.length > 0 ? `${partes.join("; ")}.` : null;
  }, [hero, leitura, bilateral.janela_regua]);

  // ── KPIs (máx. 4) ─────────────────────────────────────────────────────────
  const kpis = [
    <KpiCard
      key="ptax"
      label="PTAX (venda)"
      value={hero.ptax ? `R$ ${fmtNum(hero.ptax.valor, 4)}` : "—"}
      delta={ptaxVar12m}
      deltaUnit="%"
      deltaHint="em 12m"
      invertColor
      hint={hero.ptax ? `em ${fmtDataBR(hero.ptax.data)}` : undefined}
    />,
    <KpiCard
      key="real"
      label="Câmbio real vs média"
      value={fmtSignedPct(hero.bilateral_vs_media_pct, 1)}
      hint={
        leitura
          ? leitura === "em linha"
            ? `em linha com a média ${bilateral.janela_regua}`
            : `${leitura} que a média ${bilateral.janela_regua}`
          : undefined
      }
    />,
    <KpiCard
      key="reer"
      label="REER — 12 meses"
      value={fmtSignedPct(hero.reer_var_12m_pct, 1)}
      hint={
        hero.reer_var_12m_pct != null
          ? hero.reer_var_12m_pct > 0
            ? "depreciação real no ano (alta = depreciação)"
            : "apreciação real no ano (alta = depreciação)"
          : undefined
      }
    />,
    <KpiCard
      key="dif"
      label="Diferencial Selic − Fed"
      value={fmtNum(hero.diferencial_pp, 1)}
      unit="p.p."
      delta={difDelta12m}
      deltaUnit="p.p."
      deltaHint="em 12m"
      hint={
        difAtual ? `Selic ${fmtNum(difAtual.selic_meta, 2)}% − Fed ${fmtNum(difAtual.fed_funds, 2)}%` : undefined
      }
    />,
  ];

  // ── Blocos numerados ──────────────────────────────────────────────────────
  const blocos: DashboardBloco[] = [
    {
      id: "cambio-real",
      eyebrow: "O real está caro ou barato?",
      titulo: "Câmbio real",
      descricao:
        "Competitividade é REAL, não nominal: o nível do dólar só informa depois de descontar a inflação dos dois lados.",
      children: <CambioRealCard data={data} />,
    },
    {
      id: "paridade-juros",
      eyebrow: "O prêmio do carry",
      titulo: "Paridade de juros",
      descricao: "Quanto o Brasil paga a mais que os EUA — o diferencial que atrai (e desancora) capital.",
      children: <ParidadeJurosCard data={data} />,
    },
    {
      id: "uip",
      eyebrow: "Teoria vs realidade",
      titulo: "UIP na prática",
      descricao:
        "A paridade descoberta de juros prevê que o diferencial antecipa a depreciação. A amostra brasileira mostra o contrário do que o senso comum espera.",
      children: <UipScatterCard data={data} />,
    },
    {
      id: "previsao",
      eyebrow: "O que vem pela frente",
      titulo: "Modelos de previsão",
      descricao: "Estrutura pronta para os modelos proprietários — sem números antes de modelo publicado.",
      children: <ModelosPrevisaoCard data={data} />,
    },
    {
      id: "tabela",
      eyebrow: "Esmiuçamento",
      titulo: "Dados mês a mês",
      descricao: "Todas as séries do painel em tabela única + download CSV do histórico completo.",
      children: <TabelaMensalCard data={data} />,
    },
  ];

  const referencia = [
    `Referência: PTAX até ${hero.ptax ? fmtDataBR(hero.ptax.data) : fmtMesCurto(data.ultima_referencia_mensal)}`,
    `câmbio real bilateral até ${fmtMesCurto(bilateral.ultimo.mes)}`,
    `REER até ${fmtMesCurto(reer.ultimo.mes)}`,
  ].join(" · ");

  return (
    <DashboardScaffold
      header={{
        titulo: "Câmbio econômico",
        subtitulo:
          "Sub-área de Contas Externas — câmbio real, paridade de juros e a base dos futuros modelos de previsão.",
        referencia,
      }}
      manchete={manchete}
      kpis={kpis}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes e séries.</strong> BCB/SGS: 1 (PTAX venda diária, agregada aqui em média mensal —
            conferida contra a 3698, média de período oficial), 11752 (índice da taxa de câmbio efetiva real,
            IPCA, jun/1994 = 100), 433 (IPCA variação mensal, composta em número-índice no pipeline — a 433 NÃO é
            índice), 432 (meta Selic, média mensal das observações diárias). FRED: CPIAUCSL (CPI EUA) e Fed Funds
            efetiva ({data.metadata.fed_funds_rota}).
          </p>
          <p>
            <strong>Convenção de leitura — não inverta.</strong> Nos DOIS índices de câmbio real (REER 11752 e
            bilateral construído), ALTA = DEPRECIAÇÃO real do BRL (mais reais por dólar descontada a inflação dos
            dois lados). O pipeline valida a convenção a cada build: base jun/1994 ≈ 100 e pico da crise de 2002
            acima dos níveis de 1997.
          </p>
          <p>
            <strong>Metodologia do bilateral.</strong> PTAX venda média mensal × (CPI EUA ÷ IPCA número-índice),
            reindexado para 100 em {fmtMesCurto(bilateral.base_100)}. Régua = média {bilateral.janela_regua} ± 1
            desvio-padrão. <em>Honestidade:</em> média histórica não é taxa de equilíbrio — a banda informa posição
            relativa, não &quot;preço justo&quot;. A série defasa 1–2 meses vs a PTAX (espera CPI/IPCA).
          </p>
          <p>
            <strong>Paridade de juros e UIP.</strong> Diferencial = meta Selic − Fed Funds efetiva, médias mensais,
            p.p. a.a. O scorecard UIP compara o diferencial de 12 meses atrás com a variação cambial efetivamente
            realizada nos 12m seguintes (PTAX média mensal): se a paridade valesse, os pontos cairiam em y = x. A
            evidência empírica clássica (Fama, 1984) é de falha no curto prazo — e a amostra brasileira desde 2001
            reproduz isso ({data.juros.uip.stats.n} janelas, correlação {fmtNum(data.juros.uip.stats.correlacao, 2)}
            , desvio-padrão do erro {fmtNum(data.juros.uip.stats.erro_dp_pp, 1)} p.p.).
          </p>
          <p>
            Pipeline: data-pipeline/python/build_cambio_macro.py (schema v{data.schema_version}) · validações
            automáticas a cada build (falhou, não publica) · atualização diária via GitHub Actions
            (contas-externas-pipeline.yml).
          </p>
        </div>
      }
    />
  );
}
