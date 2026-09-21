"use client";

import { useMemo, useState } from "react";

import { AtividadeTabs } from "@/components/painel/atividade/v2/AtividadeTabs";
import { DifusaoBar, Divisor, KpiCard } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtDataBR, fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { formatGiroDia } from "@/lib/data-stamp";
import type { AtividadeCodaceData, AtividadeIbcBrData, AtividadePibData } from "@/lib/painel-atividade";
import { fmtTrimCurto, mesIso, num } from "../../shared";
import { difusao, lentePib, nowcastQtd, RECORTES_OFERTA, rebaseMedia, seriePib, ultimoPib } from "../cockpit-shared";
import { AnualPibCard } from "./AnualPibCard";
import { ContaFinanceiraCard } from "./ContaFinanceiraCard";
import { ContribuicoesPibCard } from "./ContribuicoesPibCard";
import { EstadoNoTempoPib } from "./EstadoNoTempoPib";
import { FocusPibCard } from "./FocusPibCard";
import { IbcBrNowcastCard } from "./IbcBrNowcastCard";
import { IndiceVolumeRecortesCard } from "./IndiceVolumeRecortesCard";
import { InstrumentosFinanceirosPib } from "./InstrumentosFinanceirosPib";
import { PoupancaInvestimentoCard } from "./PoupancaInvestimentoCard";
import { RitmoQoqCard } from "./RitmoQoqCard";
import { SerieMestraPibCard } from "./SerieMestraPibCard";
import { TabelaDemandaPib } from "./TabelaDemandaPib";
import { TabelaOfertaPib } from "./TabelaOfertaPib";
import { TabelaRendaPib } from "./TabelaRendaPib";

/**
 * PIB — COCKPIT de acompanhamento das Contas Nacionais Trimestrais (decisão do
 * dono, 21/09/2026: "cockpit, não história"). Esqueleto do cockpit fiscal
 * (PainelRiscoFiscalV2): abas → header técnico com barra de difusão → KPIs →
 * divisores de uma linha + grade densa → ficha técnica. Títulos fixos, número
 * em chip/KPI, editorial atrás do (?). Uma grandeza, uma casa.
 *
 * Cobertura 100% da CNT: 5932 · 1620 · 1621 · 1846 · 2072 · 2205 · 6612 · 6613 ·
 * 6726 · 6727 · 6784, mais IBC-Br (SGS 24363/24364), Focus e CODACE.
 */

const CHAVE_B9 = "(=) Capacidade / necessidade líquida de financiamento";
const CHAVE_RENDA_PROP = "(+) Rendas de propriedade (líquidas recebidas do exterior)";

function ultimoValor(rows: ReadonlyArray<Record<string, unknown>> | undefined, campo: string): number | null {
  if (!rows) return null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = num(rows[i], campo);
    if (v != null) return v;
  }
  return null;
}

/** KPI compacto com âncora para a casa canônica do dado. */
function KpiLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="block min-w-0 rounded-xl transition hover:ring-1 hover:ring-[#027DFC]/40">
      {children}
    </a>
  );
}

export function PibCockpit({
  pib,
  ibcbr,
  codace,
}: {
  pib: AtividadePibData;
  ibcbr: AtividadeIbcBrData | null;
  codace: AtividadeCodaceData | null;
}) {
  const geradoEm = pib.gerado_em;
  const trimRef = pib.trim_recente;
  const [trimTabela, setTrimTabela] = useState<string>(trimRef);

  const d = useMemo(() => {
    const serie = pib.variacao.serie;
    const ult = serie[serie.length - 1];
    const ant = serie[serie.length - 2];
    const qoq = num(ult, "qoq_sa_pib");
    const yoy = num(ult, "yoy_pib");
    const acum4t = num(ult, "acum_4t_pib");
    const acumAno = num(ult, "acum_ano_pib");
    const dQoq = qoq != null && num(ant, "qoq_sa_pib") != null ? +(qoq - (num(ant, "qoq_sa_pib") as number)).toFixed(2) : null;
    const dYoy = yoy != null && num(ant, "yoy_pib") != null ? +(yoy - (num(ant, "yoy_pib") as number)).toFixed(2) : null;
    const dAcum = acum4t != null && num(ant, "acum_4t_pib") != null ? +(acum4t - (num(ant, "acum_4t_pib") as number)).toFixed(2) : null;

    const carrego = pib.carrego ?? null;
    const anoFocus = carrego?.ano ?? parseInt(trimRef.slice(0, 4), 10);
    const arrFocus = pib.focus[String(anoFocus)] ?? [];
    let focusMediana: number | null = null;
    let focusData: string | null = null;
    for (let i = arrFocus.length - 1; i >= 0; i--) {
      if (arrFocus[i].mediana != null) {
        focusMediana = arrFocus[i].mediana;
        focusData = arrFocus[i].data;
        break;
      }
    }

    // Nível SA vs média 2019 = 100 (base única da página).
    const nivel = rebaseMedia(seriePib(pib, lentePib("idx_sa"), "pib"));
    const nivelVs2019 = nivel.length ? +(nivel[nivel.length - 1][1] - 100).toFixed(1) : null;

    // PIB nominal acumulado em 4 trimestres (1846), R$ trilhões.
    const vc = pib.valores_correntes?.serie ?? [];
    const ult4 = vc.slice(-4).map((r) => num(r, "pib"));
    const pibNominal4T = ult4.length === 4 && ult4.every((v) => v != null) ? (ult4 as number[]).reduce((a, b) => a + b, 0) / 1e6 : null;
    const trimNominal = vc.length ? String(vc[vc.length - 1].trim) : trimRef;

    const taxaInv = ultimoPib(pib, lentePib("pct_pib"), "fbcf");
    const poup = pib.taxa_poupanca?.serie?.length ? pib.taxa_poupanca.serie[pib.taxa_poupanca.serie.length - 1] : null;
    const pct = pib.contas_economicas_pct_pib?.serie;
    const b9Pct = ultimoValor(pct, CHAVE_B9);
    const rendaProp = ultimoValor(pct, CHAVE_RENDA_PROP);

    const nowcast = ibcbr ? nowcastQtd(ibcbr) : null;

    // Difusão QoQ SA nas 12 atividades-folha da oferta, no trimestre de referência.
    const folhas = RECORTES_OFERTA.filter((r) => r.folha).map((r) => num(ult, `qoq_sa_${r.key}`));
    const dif = difusao(folhas);

    return {
      qoq,
      yoy,
      acum4t,
      acumAno,
      dQoq,
      dYoy,
      dAcum,
      carrego,
      focusMediana,
      focusData,
      nivelVs2019,
      pibNominal4T,
      trimNominal,
      taxaInv,
      poup,
      b9Pct,
      rendaProp,
      nowcast,
      dif,
    };
  }, [pib, ibcbr, trimRef]);

  const segmentosDifusao = [
    { label: "sobem", count: d.dif.sobe, color: AZ_CHART.pos },
    { label: "estáveis (±0,05 p.p.)", count: d.dif.estavel, color: AZ_CHART.neutral },
    { label: "caem", count: d.dif.cai, color: AZ_CHART.neg },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AtividadeTabs />

      {/* ── Status geral ── */}
      <header className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#132960]">
            PIB — Contas Nacionais Trimestrais
            <MethodInfo className="ml-2 align-middle">
              Cockpit de acompanhamento da divulgação trimestral do IBGE, na ordem em que a mesa confere o dado:
              ritmo (QoQ SA e YoY), prévia mensal (IBC-Br) e expectativas (Focus), composição (contribuições por ótica
              e índice por recorte), estado no tempo dos 17 recortes da oferta e 6 da demanda, tabelas mestras da
              divulgação, o circuito poupança → investimento → financiamento (2072, 6726/6727, 2205) e as grandezas
              anuais. Cada grandeza tem UMA casa; o número vive no chip ou no KPI, nunca no título. Leitura e
              metodologia ficam atrás deste ícone em cada card e na ficha técnica, no fim da página.
            </MethodInfo>
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Referência: {fmtTrimCurto(trimRef)} (IBGE CNT) · IBC-Br {ibcbr ? fmtMesCurto(mesIso(ibcbr.mes_recente)) : "—"}{" "}
            · Focus {d.focusData ? fmtDataBR(d.focusData) : "—"} · giro do pipeline {formatGiroDia(geradoEm) ?? "—"} · SIDRA
            5932 · 1620 · 1621 · 1846 · 2072 · 2205 · 6612 · 6613 · 6726 · 6727 · 6784 · BCB SGS · Olinda · CODACE
          </p>
        </div>
        <div className="mt-4">
          <DifusaoBar
            titulo={`Difusão setorial · QoQ SA · ${fmtTrimCurto(trimRef)} · 12 atividades da oferta`}
            segmentos={segmentosDifusao}
            nota={`É contagem, não nota — ${d.dif.n} atividades (agregados excluídos).`}
          />
        </div>
      </header>

      {/* ── KPIs principais ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="PIB — QoQ SA"
          value={fmtSignedPct(d.qoq, 1)}
          delta={d.dQoq}
          deltaUnit="p.p."
          deltaHint="vs trim. anterior"
          hint={`${fmtTrimCurto(trimRef)} · vs trimestre anterior, com ajuste sazonal · SIDRA 5932`}
          size="lg"
        />
        <KpiCard
          label="PIB — YoY"
          value={fmtSignedPct(d.yoy, 1)}
          delta={d.dYoy}
          deltaUnit="p.p."
          deltaHint="vs trim. anterior"
          hint="vs mesmo trimestre do ano anterior"
        />
        <KpiCard
          label="PIB — acum. 4 trimestres"
          value={fmtSignedPct(d.acum4t, 1)}
          delta={d.dAcum}
          deltaUnit="p.p."
          deltaHint="vs trim. anterior"
          hint={`acum. no ano ${fmtSignedPct(d.acumAno, 1)}`}
        />
        <KpiCard
          label="Carrego estatístico"
          value={d.carrego ? fmtSignedPct(d.carrego.valor, 1) : "—"}
          delta={d.carrego && d.focusMediana != null ? +(d.carrego.valor - d.focusMediana).toFixed(2) : undefined}
          deltaUnit="p.p."
          deltaHint={`vs mediana Focus${d.focusMediana != null ? ` ${fmtPct(d.focusMediana, 2)}` : ""}`}
          hint={
            d.carrego
              ? `ano ${d.carrego.ano} · ${d.carrego.trimestres_divulgados} trim. divulgado${d.carrego.trimestres_divulgados > 1 ? "s" : ""} · índice SA congelado`
              : "índice SA congelado no último trimestre"
          }
        />
      </div>

      {/* ── KPIs secundários (grandezas rebaixadas de card para indicador) ── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiLink href="#ibcbr-nowcast">
          <KpiCard
            size="sm"
            label="IBC-Br — prévia do trimestre"
            value={d.nowcast ? fmtSignedPct(d.nowcast.valor, 1) : "—"}
            hint={
              d.nowcast
                ? `${fmtTrimCurto(d.nowcast.trimCorrente)} · ${d.nowcast.mesesDivulgados} de 3 meses · calculado`
                : "sem série"
            }
          />
        </KpiLink>
        <KpiLink href="#indice-recortes">
          <KpiCard
            size="sm"
            label="PIB SA vs média 2019"
            value={d.nivelVs2019 != null ? fmtSignedPct(d.nivelVs2019, 1) : "—"}
            hint="índice de volume SA · SIDRA 1621"
          />
        </KpiLink>
        <KpiLink href="#tabela-renda">
          <KpiCard
            size="sm"
            label="PIB nominal — 4 trim."
            value={d.pibNominal4T != null ? `R$ ${fmtNum(d.pibNominal4T, 2)} tri` : "—"}
            hint={`até ${fmtTrimCurto(d.trimNominal)} · preços correntes · SIDRA 1846`}
          />
        </KpiLink>
        <KpiLink href="#poupanca-investimento">
          <KpiCard
            size="sm"
            label="Taxa de investimento"
            value={d.taxaInv ? fmtPct(d.taxaInv.valor, 1) : "—"}
            hint={`FBCF / PIB nominal · ${d.taxaInv ? fmtTrimCurto(d.taxaInv.trim) : "—"}`}
          />
        </KpiLink>
        <KpiLink href="#poupanca-investimento">
          <KpiCard
            size="sm"
            label="Poupança bruta"
            value={d.poup?.valor != null ? fmtPct(d.poup.valor, 1) : "—"}
            hint={`% PIB · ${d.poup ? fmtTrimCurto(d.poup.trim) : "—"} · SIDRA 6726`}
          />
        </KpiLink>
        <KpiLink href="#conta-financeira">
          <KpiCard
            size="sm"
            label="Cap./nec. de financiamento"
            value={d.b9Pct != null ? fmtSignedPct(d.b9Pct, 1) : "—"}
            hint={`% PIB · renda de propriedade líq. ${d.rendaProp != null ? fmtSignedPct(d.rendaProp, 1) : "—"} PIB`}
          />
        </KpiLink>
      </div>

      {/* ── Ritmo ── */}
      <Divisor
        label="Ritmo — PIB a preços de mercado"
        info="A variação trimestral com ajuste sazonal (QoQ SA) é o número-manchete da divulgação; a banda p25–p75 dos últimos 40 trimestres situa o ritmo sem juízo de valor. A série-mestra mostra a mesma grandeza nas outras transformações (YoY, acumulados e nível)."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div id="ritmo-qoq" className="scroll-mt-24">
          <RitmoQoqCard pib={pib} codace={codace} geradoEm={geradoEm} />
        </div>
        <div id="serie-mestra" className="scroll-mt-24">
          <SerieMestraPibCard pib={pib} codace={codace} geradoEm={geradoEm} />
        </div>
      </div>

      {/* ── Prévia e expectativas ── */}
      <Divisor
        label="Prévia do trimestre e expectativas"
        info="O IBC-Br (BCB) é a proxy mensal do PIB: com 1 ou 2 meses divulgados dá a prévia do trimestre corrente. O Focus registra o consenso de mercado para o ano — a trajetória da mediana ao longo das coletas é a série de acompanhamento; o carrego estatístico é a régua do que já está contratado."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {ibcbr ? (
          <div id="ibcbr-nowcast" className="scroll-mt-24">
            <IbcBrNowcastCard ibcbr={ibcbr} pib={pib} codace={codace} geradoEm={geradoEm} />
          </div>
        ) : null}
        <div id="focus" className="scroll-mt-24">
          <FocusPibCard pib={pib} geradoEm={geradoEm} />
        </div>
      </div>

      {/* ── Composição ── */}
      <Divisor
        label="Composição do crescimento"
        info="Contribuições em pontos percentuais somam (≈) o PIB YoY — é o gráfico canônico do Relatório de Inflação. O índice de volume por recorte, rebasado na média de 2019, mostra quem recuperou o pré-pandemia e em que ritmo relativo ao PIB."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div id="contribuicoes" className="scroll-mt-24">
          <ContribuicoesPibCard pib={pib} codace={codace} geradoEm={geradoEm} />
        </div>
        <div id="indice-recortes" className="scroll-mt-24">
          <IndiceVolumeRecortesCard pib={pib} codace={codace} geradoEm={geradoEm} />
        </div>
      </div>

      {/* ── Estado no tempo ── */}
      <Divisor
        label="Estado no tempo — oferta e demanda"
        info="Small multiples dos recortes-folha da SCN (os agregados vivem nas tabelas). Cada tile mostra o último valor da métrica ativa, o peso no PIB nominal e a trajetória de 20 trimestres; clicar abre a lupa do recorte com as 9 lentes da CNT — 4 variações (5932), índices SA e NS (1621/1620), R$ SA e NS a preços de 1995 (6613/6612) e peso no PIB nominal (1846)."
      />
      <div id="estado-no-tempo" className="scroll-mt-24">
        <EstadoNoTempoPib pib={pib} codace={codace} geradoEm={geradoEm} />
      </div>

      {/* ── Tabelas mestras ── */}
      <Divisor
        label="Tabelas mestras — raio-X da divulgação"
        info="As três planilhas de referência da divulgação. Oferta e demanda compartilham o seletor de trimestre (4 últimos) e o fundo de calor nas colunas de variação. A sequência da renda (2072) lê da produção à capacidade/necessidade de financiamento."
      />
      <div id="tabela-oferta" className="scroll-mt-24">
        <TabelaOfertaPib pib={pib} geradoEm={geradoEm} trimSel={trimTabela} onTrimSel={setTrimTabela} />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div id="tabela-demanda" className="scroll-mt-24">
          <TabelaDemandaPib pib={pib} geradoEm={geradoEm} trimSel={trimTabela} />
        </div>
        <div id="tabela-renda" className="scroll-mt-24">
          <TabelaRendaPib pib={pib} geradoEm={geradoEm} />
        </div>
      </div>

      {/* ── Poupança, investimento e financiamento ── */}
      <Divisor
        label="Poupança, investimento e financiamento"
        info="Fecho do circuito macro: taxa de poupança bruta (6726) e taxa de investimento (6727) em % do PIB; a diferença poupança − formação bruta de capital é a capacidade (+) ou necessidade (−) líquida de financiamento (2072), o mesmo saldo B.9 que a conta financeira (2205) detalha por instrumento — e que o IDP cobre ou não."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div id="poupanca-investimento" className="scroll-mt-24">
          <PoupancaInvestimentoCard pib={pib} codace={codace} geradoEm={geradoEm} />
        </div>
        <div id="conta-financeira" className="scroll-mt-24">
          <ContaFinanceiraCard pib={pib} geradoEm={geradoEm} />
        </div>
      </div>
      <div id="instrumentos" className="scroll-mt-24">
        <InstrumentosFinanceirosPib pib={pib} geradoEm={geradoEm} />
      </div>

      {/* ── Anual ── */}
      <Divisor
        label="Anual e estrutura"
        info="Grandezas de frequência anual ou com defasagem de 1 a 2 anos: crescimento anual realizado contra as medianas Focus dos próximos anos e o PIB per capita (SIDRA 6784)."
      />
      <div id="anual" className="scroll-mt-24">
        <AnualPibCard pib={pib} geradoEm={geradoEm} />
      </div>

      {/* ── Ficha técnica ── */}
      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Ficha técnica — fontes, metodologia e convenções
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
          <p>
            <strong>Fontes e séries.</strong> IBGE/SIDRA — Contas Nacionais Trimestrais: 5932 (variações reais: v6564 QoQ SA,
            v6561 YoY, v6562 acum. 4T, v6563 acum. ano, 22 recortes), 1620/1621 (índice de volume NS/SA, média 1995 = 100),
            6612/6613 (valores encadeados a preços de 1995, NS/SA, R$), 1846 (valores correntes e % do PIB nominal por
            recorte), 2072 (contas econômicas integradas: sequência da renda, R$ e % PIB), 2205 (conta financeira por
            instrumento F.1–F.8, B.9 e IDP; trimestral e acumulado em 4T), 6726 (taxa de poupança bruta, % PIB), 6727
            (taxa de investimento, FBCF % PIB), 6784 (PIB per capita anual). BCB: SGS 24363/24364 (IBC-Br NS/SA), Olinda
            ExpectativasMercadoAnuais (Focus PIB Total, mediana/dp/mín/máx por data de coleta). Recessões: cronologia
            CODACE/FGV-IBRE (última datação 2020; recessão nova exige edição manual do builder).
          </p>
          <p>
            <strong>Derivadas do builder</strong> (data-pipeline/python/build_atividade_pib.py · GitHub Actions
            atividade-pipeline.yml, dias 1–3 de mar/jun/set/dez): contribuições ao PIB YoY = peso nominal do mesmo
            trimestre do ano anterior (1846, convenção t−4) × variação real YoY (5932), importações com sinal trocado;
            índices encadeados são não-aditivos e o resíduo absorve a diferença (na demanda inclui a variação de
            estoques). Carrego = média do índice SA do ano com o último trimestre divulgado congelado ÷ média do ano
            anterior − 1. Estrutura nominal = recorte (1846) ÷ PIB nominal × 100.
          </p>
          <p>
            <strong>Derivadas leves calculadas no site</strong> (rotuladas &quot;calculado&quot;): banda p25–p75, mediana,
            mínimo e máximo do QoQ SA nos últimos 40 trimestres (sempre lidos do dado, nunca fixos); difusão setorial
            (contagem das 12 atividades-folha da oferta com variação acima/abaixo de ±0,05 p.p.); nowcast do IBC-Br
            alinhado ao calendário (média SA dos meses divulgados do trimestre ÷ média do trimestre anterior − 1 — o
            campo var_ritmo_trimestral do builder é média móvel rolante); rebase para média de 2019 = 100 (base única
            desta página, válida para mensal e trimestral); médias móveis de 4 trimestres; Δ de peso vs t−4; líquido =
            ativo − passivo na conta financeira quando o campo vem nulo.
          </p>
          <p>
            <strong>Convenções.</strong> QoQ sobre o índice SA; YoY, acum. 4T e acum. ano sobre o índice NS (convenção
            oficial). Nível e variação nunca no mesmo eixo. Verde = subiu, vermelho = caiu (direção literal do número).
            B.9 negativo = necessidade de financiamento externo (no payload o saldo vive no campo b9_passivo). R$ das
            séries encadeadas são a preços de 1995 e aparecem em R$ bilhões. Nulos estruturais: a 1621/5932 não publicam
            impostos com ajuste sazonal (índice SA e QoQ SA) e a 1621/6613 não publicam variação de estoques (só % do
            PIB nominal, 1846); a 2205 não traz passivo/líquido de F.1 e F.89 nem os líquidos de B.9, IDP e totais.
          </p>
          <p>
            <strong>Calendário e revisões.</strong> O PIB sai com ~60 dias de defasagem e cada divulgação revisa
            trimestres anteriores; o payload guarda só a última vintage. O Focus embutido neste payload é o da data do
            giro trimestral (a mediana muda toda semana). O IBC-Br é publicado ~45 dias após o mês de referência; o
            trimestre corrente é parcial até o terceiro mês. O que ainda não existe no builder e por isso não aparece:
            data da próxima divulgação, surpresa vs Focus na véspera, tabela de revisões e PIB potencial (o filtro HP
            saiu do site até ser gravado no pipeline).
          </p>
          <p>
            <strong>Casa canônica por grandeza.</strong> IBC-Br solo, heatmap ano × mês e médias anuais → Visão geral da
            área; PIM-PF, PMC e PMS → abas próprias; balanço de pagamentos e cobertura do IDP em frequência mensal →
            Contas Externas; poupança bruta como denominador do serviço da dívida → Indicadores de Risco Fiscal. Cache:
            rota em ISR de 24 h, purgada por tag pelo pipeline ao publicar (POST /api/revalidate).
          </p>
        </div>
      </details>
    </div>
  );
}
