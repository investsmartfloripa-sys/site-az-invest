"use client";

import { useMemo, type ReactNode } from "react";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { FiscalClassicosData } from "@/lib/painel-fiscal";
import { KpiCard } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { FiscalTabs } from "@/components/painel/fiscal/v2/FiscalTabs";
import { fmtMesLongo, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { deltaPp12m, ultimoPct } from "./shared";
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
 * Painel Receita e Gastos v2 — COCKPIT de monitoramento (§10 do
 * PADRAO-VISUAL, mesmo padrão do PainelRiscoFiscalV2): tab bar → header
 * compacto → 4 KPIs → âncora da tesoura → grade densa por seção (Meta fiscal /
 * Receita / Despesa / Regra fiscal e consolidado) → análise completa e ficha
 * técnica em <details>. Títulos técnicos FIXOS; número dinâmico vira chip;
 * todo texto editorial atrás de MethodInfo (?) ou da ficha.
 *
 * Princípios herdados da crítica do revisor: recessões CODACE no lugar de
 * regimes hardcoded; bandas LDO por ano; estabilizador SEMPRE do pipeline
 * (nunca recalculado no front); stacks fixos que fecham o total; séries
 * reais deflacionadas no builder.
 */

function Divisor({ label, info }: { label: string; info?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
        {info ? <MethodInfo className="ml-1.5 align-middle">{info}</MethodInfo> : null}
      </span>
      <div className="h-px flex-1 bg-[#132960]/10" />
    </div>
  );
}

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

    // Δ m/m do primário: último ponto válido vs o imediatamente anterior.
    let deltaPrimarioMm: number | null = null;
    {
      const validos: number[] = [];
      for (const p of rg.primario_central_pct_pib) {
        if (p.valor_pct != null && Number.isFinite(p.valor_pct)) validos.push(p.valor_pct);
      }
      if (validos.length >= 2) {
        deltaPrimarioMm = +(validos[validos.length - 1] - validos[validos.length - 2]).toFixed(4);
      }
    }

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

    return { receita, despesa, primario, deltaReceita, deltaDespesa, deltaPrimarioMm, estab };
  }, [rg, data]);

  const temMetaYtd = Boolean(data.acompanhamento_meta?.primario_central_ytd_brl_mm);

  return (
    <div className="flex flex-col gap-4">
      <FiscalTabs />

      {/* ── Status geral ── */}
      <header className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#132960]">
            Receita e gastos
            <MethodInfo className="ml-2 align-middle">
              O fluxo fiscal brasileiro em dois perímetros declarados, nunca misturados na mesma linha: governo central
              (GC — Tesouro/RTN) e setor público consolidado (SP — BCB), sempre em 12 meses móveis sobre o PIB. A
              pergunta central é a tesoura: o governo arrecada menos do que gasta? O primário que ela produz é comparado
              com duas réguas — a meta LDO (aferida no ano-calendário, com abatimentos; o 12m móvel é aproximação) e o
              primário estabilizador p* calculado no pipeline (perímetro consolidado, DLSP). Convenção única: primário
              positivo = superávit (STN); juros sempre como custo.
            </MethodInfo>
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Referência: {data.mes_recente ? fmtMesLongo(data.mes_recente) : "—"} · Tesouro RTN/STN + BCB SGS · pipeline
            fiscal AZ (diário)
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Receita líquida (12m)"
          value={fmtPct(derivados.receita?.valor ?? null, 1)}
          unit="do PIB"
          delta={derivados.deltaReceita ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          hint="RTN, acumulado 12 meses"
        />
        <KpiCard
          label="Despesa total (12m)"
          value={fmtPct(derivados.despesa?.valor ?? null, 1)}
          unit="do PIB"
          delta={derivados.deltaDespesa ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          invertColor
          hint="RTN, acumulado 12 meses"
        />
        <KpiCard
          label="Primário 12m (GC)"
          value={fmtSignedPct(derivados.primario?.valor ?? null, 2)}
          unit="do PIB"
          delta={derivados.deltaPrimarioMm ?? undefined}
          deltaUnit="p.p."
          deltaHint="m/m"
          hint="positivo = superávit"
          size="lg"
        />
        <KpiCard
          label="Estabilizador (SP)"
          value={fmtSignedPct(derivados.estab, 1)}
          unit="do PIB"
          hint={
            derivados.estab != null
              ? "p/ a dívida parar de crescer · perímetro consolidado (DLSP)"
              : "aguardando pipeline v2"
          }
        />
      </div>

      {/* ── Âncora: a tesoura ── */}
      <TesouraCard data={data} codace={codace} />

      {/* ── Meta fiscal ── */}
      <Divisor
        label="Meta fiscal"
        info="O primário entregue contra as duas réguas: a meta LDO do ano-calendário (acumulado jan→mês vs padrão sazonal) e o estabilizador da dívida calculado no pipeline (perímetro consolidado). Perímetros declarados card a card."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {temMetaYtd ? <MetaYtdCard data={data} /> : null}
        <PrimarioMetaCard data={data} codace={codace} />
      </div>

      {/* ── Receita ── */}
      <Divisor
        label="Receita"
        info="De onde vem a receita e o que puxou a variação: famílias do RTN em stack fixo (o total é a receita bruta; o vão até a linha é a transferência a estados e municípios) e o Δ de participação no PIB por tributo em 12 meses."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <ReceitaFamiliasCard data={data} />
        <ContribuicoesTributoCard data={data} />
      </div>

      {/* ── Despesa ── */}
      <Divisor
        label="Despesa"
        info="Onde o dinheiro vai e quanto ainda é escolha: quatro macro-fatias que fecham a despesa total (previdência / pessoal / demais obrigatórias / discricionárias) e a parcela discricionária do orçamento no tempo."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <DespesaRubricasCard data={data} />
        <RigidezCard data={data} />
      </div>

      {/* ── Regra fiscal e consolidado ── */}
      <Divisor
        label="Regra fiscal e consolidado"
        info="A despesa cabe no corredor do arcabouço (LC 200/2023, crescimento real deflacionado no builder)? E, no setor público consolidado, quanto do rombo nominal é fluxo primário e quanto é serviço da dívida (identidade que fecha por construção)?"
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <ArcaboucoCard data={data} />
        <NfspDecompostaCard data={data} codace={codace} />
      </div>

      {/* ── Análise completa ── */}
      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Análise completa — tabela mensal e CSV
        </summary>
        <div className="mt-3">
          <AnaliseCompletaFiscal data={data} />
        </div>
      </details>

      {/* ── Ficha técnica ── */}
      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Ficha técnica — fontes e metodologia
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
          <p>
            <strong>Fontes e séries.</strong> Tesouro Nacional — Resultado do Tesouro Nacional (RTN, XLSX da série
            histórica desde 1997, leitura com validação de rótulo linha a linha): receita líquida, transferências a E&M,
            famílias de receita (linhas 1.1–1.4), rubricas de despesa (4.x, incl. o residual &quot;demais
            obrigatórias&quot; e as obrigatórias com controle de fluxo) e primário do governo central. BCB SGS: 13762
            (DBGG), 4513 (DLSP), 5718 (juros nominais 12m % PIB do setor público consolidado), 5727 (NFSP nominal 12m do
            consolidado), 5728 (juros do governo central), 5717 (NFSP do governo central), 4382 (PIB nominal 12m), 12001
            (composição da DPMFi), entre outras. O primário consolidado não é coletado: é DERIVADO no pipeline (juros −
            NFSP nominal, isto é, 5718 − 5727). Metas: LDOs 2024–2027 (trajetória vigente do PLDO 2025; banda ±0,25 p.p.
            da LC 200/2023). Recessões: cronologia CODACE/FGV (mensal).
          </p>
          <p>
            <strong>Convenções de sinal e perímetros.</strong> Primário positivo = superávit (convenção STN) em TODO o
            painel. A NFSP do BCB publica déficit com sinal positivo — a série já vem convertida do pipeline para a
            convenção única. Juros aparecem sempre como custo. Perímetros declarados gráfico a gráfico e nos rótulos:
            (GC) = governo central (RTN) na tesoura, famílias, rubricas e meta; (SP) = setor público consolidado (BCB)
            no estabilizador e no nominal decomposto — não são comparáveis linha a linha.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Primário estabilizador: p* = (r − g)/(1 + g) ×
            DLSP/PIB t−12, com r = taxa implícita da DLSP (juros nominais 12m ÷ DLSP média) e g = crescimento nominal
            12m do PIB — UMA fórmula, calculada exclusivamente no pipeline; o front nunca recalcula. Crescimento real do
            arcabouço: deflação mês a mês pelo índice composto do IPCA no builder (não pelo IPCA YoY sobre o agregado).
            Metas LDO valem por ano-calendário e a aferição oficial admite abatimentos (ex.: precatórios EC 114) —
            comparações com o 12m móvel são aproximação, sinalizada nas notas (?). No front, só razões, Δs e agrupamentos
            de apresentação (rigidez, Δ por tributo, macro-fatias da despesa somadas ponto a ponto) sobre séries prontas
            do JSON.
          </p>
          <p>Pipeline: data-pipeline/python/build_fiscal.py (schema v2) · GitHub Actions fiscal-pipeline.yml.</p>
        </div>
      </details>
    </div>
  );
}
