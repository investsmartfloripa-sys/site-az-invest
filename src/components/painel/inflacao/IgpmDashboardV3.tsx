"use client";

import { useMemo, useState } from "react";

import type { IgpmData } from "@/lib/painel-igpm";
import { KpiCard } from "@/components/painel/core";
import { fmtMesLongo, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { AluguelCard } from "./v2igpm/AluguelCard";
import { AntecipaIpcaCard } from "./v2igpm/AntecipaIpcaCard";
import { FocusMensalCard } from "./v3/FocusMensalCard";
import { SurpresasCard } from "./v3/SurpresasCard";
import { ComponentePane } from "./v3igpm/ComponentePane";
import { Decomposicao12mCard } from "./v3igpm/Decomposicao12mCard";
import { DecomposicaoMesCard } from "./v3igpm/DecomposicaoMesCard";
import { FocusAnosIgpmCard } from "./v3igpm/FocusAnosIgpmCard";
import { OrigemIpaCard } from "./v3igpm/OrigemIpaCard";
import { SazonalidadeIgpmCard } from "./v3igpm/SazonalidadeIgpmCard";
import { SerieLongaIgpmCard } from "./v3igpm/SerieLongaIgpmCard";
import { TabelaSinteseIgpmCard } from "./v3igpm/TabelaSinteseIgpmCard";

/**
 * Painel IGP-M v3 — tabs de ESCRUTÍNIO no molde do IPCA v3: a série
 * destrinchada em tabelas e gráficos, sem manchete narrativa. Um tab por
 * componente (IPA/IPC/INCC — o IGP-M é um índice de índices) + leitura do
 * mês + tendência & expectativas.
 *
 * Regras herdadas (inegociáveis):
 * - todo acumulado/dessaz/SAAR/encadeamento nasce no builder (schema v3);
 * - o IGP não tem meta: réguas PRÓPRIAS pós-96 (mediana, p10–p90) em vez
 *   de banda de meta;
 * - semântica de inflação: alta = vermelho (pressão), queda = azul.
 *
 * O contrato do robô de publicação (data/igpm_release.json) espelha a tab
 * "Leitura do mês" — o que se vê aqui é o que o robô lê lá.
 */

type Vista = "leitura" | "ipa" | "ipc" | "incc" | "tendencia";

/** Subtítulo de seção dentro de uma tab — rótulo mínimo + filete (sem textinho). */
function SubSecao({ rotulo }: { rotulo: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{rotulo}</span>
      <div className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}

const TABS: { value: Vista; label: string }[] = [
  { value: "leitura", label: "1. Leitura do mês" },
  { value: "ipa", label: "2. IPA-M (60%)" },
  { value: "ipc", label: "3. IPC-M (30%)" },
  { value: "incc", label: "4. INCC-M (10%)" },
  { value: "tendencia", label: "5. Tendência & expectativas" },
];

export function IgpmDashboardV3({ data }: { data: IgpmData }) {
  const [vista, setVista] = useState<Vista>("leitura");
  const mesRef = data.mes_recente;

  const derivados = useMemo(() => {
    const igpmMes = data.overview.ultimo_mensal;
    const igpm12m = data.overview.ultimo_12m;
    const sazMes = data.overview.sazonalidade_pos96?.[mesRef.slice(5, 7)];
    const medianaSaz = sazMes?.mediana ?? null;
    const esperado = data.focus_mensal?.vespera?.mediana ?? null;
    const surpresa = igpmMes != null && esperado != null ? igpmMes - esperado : null;
    const percentil12m = data.overview.estatisticas_12m?.percentil_atual ?? null;
    const linhaIgpm = data.tabela_sintese?.secoes
      .find((s) => s.id === "familia")
      ?.linhas.find((l) => l.id === "igpm");
    const acumAno = linhaIgpm?.acum_ano ?? null;
    const reajuste = data.aluguel?.reajustes[0] ?? null;
    return { igpmMes, igpm12m, medianaSaz, esperado, surpresa, percentil12m, acumAno, reajuste };
  }, [data, mesRef]);

  const { igpmMes, igpm12m, medianaSaz, esperado, surpresa, percentil12m, acumAno, reajuste } = derivados;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#132960]">Painel IGP-M</h1>
        <p className="mt-1 text-xs text-zinc-500">Referência: {fmtMesLongo(mesRef)} · FGV via BCB/SGS</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="IGP-M do mês"
          value={fmtSignedPct(igpmMes, 2)}
          delta={surpresa ?? (igpmMes != null && medianaSaz != null ? igpmMes - medianaSaz : null)}
          deltaUnit="p.p."
          deltaHint={surpresa != null ? "vs Focus véspera" : "vs padrão do mês"}
          invertColor
          hint={
            esperado != null
              ? `Focus véspera: ${fmtSignedPct(esperado, 2)}`
              : medianaSaz != null
                ? `mediana pós-96: ${fmtSignedPct(medianaSaz, 2)}`
                : undefined
          }
        />
        <KpiCard
          label="IGP-M 12 meses"
          value={fmtSignedPct(igpm12m, 2)}
          delta={null}
          hint={
            percentil12m != null
              ? `percentil pós-96: ${fmtNum(percentil12m, 0)}`
              : "composto no pipeline"
          }
        />
        <KpiCard
          label="Acumulado no ano"
          value={fmtSignedPct(acumAno, 2)}
          delta={null}
          hint="composto no pipeline"
        />
        <KpiCard
          label="Reajuste de aluguel do mês"
          value={fmtPct(reajuste?.aplicado_pct ?? null, 2)}
          delta={null}
          hint={
            reajuste
              ? reajuste.clausula_nao_reducao
                ? "cláusula de não-redução"
                : "IGP-M 12m no aniversário"
              : undefined
          }
        />
      </div>

      {/* Tabs (espelha padrão IPCA v3 / Termômetro de Ciclo) */}
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1 border-b border-zinc-200">
          {TABS.map((t) => {
            const ativa = t.value === vista;
            return (
              <button
                key={t.value}
                onClick={() => setVista(t.value)}
                className={`relative -mb-px px-3 py-2 text-sm font-semibold transition md:px-4 ${
                  ativa
                    ? "border-b-2 border-[#132960] text-[#132960]"
                    : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
                aria-current={ativa ? "page" : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {vista === "leitura" ? (
          <div className="space-y-6">
            {data.tabela_sintese ? (
              <TabelaSinteseIgpmCard sintese={data.tabela_sintese} geradoEm={data.gerado_em} />
            ) : null}
            <div className="grid gap-6 xl:grid-cols-2">
              {data.tabela_sintese ? (
                <DecomposicaoMesCard sintese={data.tabela_sintese} geradoEm={data.gerado_em} />
              ) : null}
              <SazonalidadeIgpmCard data={data} />
            </div>
          </div>
        ) : null}

        {vista === "ipa" ? (
          <div className="space-y-6">
            <ComponentePane data={data} comp="IPA-M" geradoEm={data.gerado_em} />
            {data.origem_ipa ? <OrigemIpaCard origem={data.origem_ipa} geradoEm={data.gerado_em} /> : null}
            {data.antecipacao ? (
              <AntecipaIpcaCard antecipacao={data.antecipacao} geradoEm={data.gerado_em} mesRecente={mesRef} />
            ) : null}
          </div>
        ) : null}

        {vista === "ipc" ? <ComponentePane data={data} comp="IPC-M" geradoEm={data.gerado_em} /> : null}

        {vista === "incc" ? <ComponentePane data={data} comp="INCC-M" geradoEm={data.gerado_em} /> : null}

        {vista === "tendencia" ? (
          <div className="space-y-6">
            <SubSecao rotulo="Tendência" />
            {data.serie_longa ? <SerieLongaIgpmCard longa={data.serie_longa} geradoEm={data.gerado_em} /> : null}
            {data.decomposicao_12m && data.decomposicao_12m.serie.length > 0 ? (
              <Decomposicao12mCard decomp={data.decomposicao_12m} geradoEm={data.gerado_em} />
            ) : null}
            {data.aluguel && data.aluguel.reajustes.length > 0 ? (
              <AluguelCard aluguel={data.aluguel} geradoEm={data.gerado_em} />
            ) : null}
            <SubSecao rotulo="Expectativas" />
            {data.focus_anuais && Object.keys(data.focus_anuais).length > 0 ? (
              <FocusAnosIgpmCard focus={data.focus_anuais} geradoEm={data.gerado_em} />
            ) : null}
            {data.focus_mensal ? (
              <FocusMensalCard
                focusMensal={data.focus_mensal}
                realizadoMes={igpmMes}
                geradoEm={data.gerado_em}
                indicador="IGP-M"
              />
            ) : null}
            {data.focus_mensal && data.focus_mensal.surpresas.length > 0 ? (
              <SurpresasCard focusMensal={data.focus_mensal} geradoEm={data.gerado_em} indicador="IGP-M" />
            ) : null}
          </div>
        ) : null}
      </div>

      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Ficha técnica — fontes e metodologia
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
          <p>
            <strong>Fontes e séries.</strong> FGV via BCB/SGS: 189 (IGP-M variação mensal), 7450 (IPA-M), 7456
            (IPC-M), 7465 (INCC-M), 7447 (IGP-10), 190 (IGP-DI); origem do atacado via família IPA-DI: 225 (IPA-DI
            cheio) e 7459/7460 (agro × industrial, com IDENTIFICAÇÃO revalidada a cada build — os rótulos no BCB são
            ambíguos; se a validação falha, o bloco não é publicado). Referência cruzada IBGE via SGS 433 (IPCA
            mensal) e 13522 (IPCA 12m). BCB/Olinda: ExpectativasMercadoAnuais e ExpectativaMercadoMensais
            (baseCalculo = 0) para o IGP-M. Pesos de origem: IPA 60%, IPC 30%, INCC 10% (base ago/1994). Última
            observação: {fmtMesLongo(mesRef)}.
          </p>
          <p>
            <strong>Metodologia — honestidade de cálculo.</strong> Todo acumulado de 12 meses é COMPOSTO
            (Π(1+v/100)−1) no pipeline, nunca soma aritmética — validado por spot-check contra valores oficiais FGV
            (o antigo SGS 192 NÃO era IGP-M 12m e foi aposentado). Decomposições com pesos EFETIVOS encadeados
            (w = peso de origem × número-índice encadeado, renormalizado mês a mês) e resíduo ESTRUTURAL como fatia
            própria — no mensal e no 12m encadeado, o resíduo nunca é realocado entre componentes. Momentum:
            dessazonalização STL sobre o log do índice encadeado (período 12, robusta) — método próprio, NÃO o X-13 —
            apenas para IPC-M e INCC-M; IPA-M e o próprio IGP-M são anualizados SEM dessaz porque o atacado (câmbio +
            commodities) não tem padrão sazonal estável e domina o índice cheio (~60-70% de peso efetivo) — o ajuste
            sazonal testado distorcia o cheio. Surpresa = realizado − mediana da última pesquisa Focus (baseCalculo = 0)
            antes da divulgação da FGV (~dia 28-30 do mês).
          </p>
          <p>
            <strong>Réguas.</strong> O IGP-M não tem meta: as réguas são PRÓPRIAS, truncadas ao pós-Real (jan/1996+) —
            mediana e faixa p10–p90 do acumulado 12m, percentis e sazonalidade por mês civil (mediana/mín–máx),
            calculadas no builder. IPCA 12m como única referência externa (cinza tracejado — régua, não protagonista).
            Aluguel: cláusula contratual de não-redução — IGP-M 12m negativo congela o reajuste em zero.
          </p>
          <p>
            <strong>Contrato de máquina.</strong> A leitura do mês é publicada também em JSON estável
            (data/igpm_release.json, schema v1): headline (mês/ano/12m), expectativa da véspera + surpresa, posição
            sazonal, componentes com contribuições, família IGP, origem do IPA, reajuste de aluguel e Focus adiante —
            insumo de automações editoriais.
          </p>
          <p>Pipeline: data-pipeline/python/build_igpm.py (schema v3) · atualização diária via GitHub Actions.</p>
        </div>
      </details>
    </div>
  );
}
