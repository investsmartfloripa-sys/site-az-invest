"use client";

import { useMemo, type ReactNode } from "react";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { FiscalClassicosData, FiscalDbggFatoresData, FiscalDpfRmdData, PontoMensal } from "@/lib/painel-fiscal";
import { KpiCard } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { FiscalTabs } from "@/components/painel/fiscal/v2/FiscalTabs";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { dataIso, deltaDozeMeses, deltaMesAnterior } from "./shared";
import { TrajetoriaDividaCard } from "./TrajetoriaDividaCard";
import { PorQueSubiuCard } from "./PorQueSubiuCard";
import { RMenosGCard } from "./RMenosGCard";
import { ComposicaoDpmfiCard } from "./ComposicaoDpmfiCard";
import { FatoresDbggCard } from "./FatoresDbggCard";
import { DpfRmdCard } from "./DpfRmdCard";
import { DetentoresDpmfiCard } from "./DetentoresDpmfiCard";
import { AnaliseCompletaDivida } from "./AnaliseCompletaDivida";

/**
 * Painel Dívida v2 — COCKPIT de monitoramento (não narrativa).
 *
 * Estrutura: tab bar fiscal → header compacto (título técnico + leitura
 * editorial atrás do (?)) → 4 KPIs → âncora DBGG × DLSP → "Dinâmica da
 * dívida" (decomposição + r − g em grade) → "Estrutura" (DPMFi) → análise
 * completa e ficha técnica em <details>. Rótulos técnicos; TODO texto
 * editorial fica atrás dos ícones (?) e das fichas colapsáveis.
 *
 * O card de crédito privado (Big Debt Cycle) SAIU da aba: a casa canônica do
 * endividamento agregado é a categoria Carga dos indicadores de risco.
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

export function PainelDividaV2({
  data,
  codace,
  fatoresDbgg,
  dpfRmd,
}: {
  data: FiscalClassicosData;
  codace: AtividadeCodaceData | null;
  /** Onda 3 — decomposição oficial da ΔDBGG (blob pode ainda não existir → card não renderiza). */
  fatoresDbgg?: FiscalDbggFatoresData | null;
  /** Onda 3 — RMD/Tesouro (blob pode ainda não existir → cards não renderizam). */
  dpfRmd?: FiscalDpfRmdData | null;
}) {
  const sust = data.sustentabilidade?.serie ?? [];
  const ultSust = sust.length > 0 ? sust[sust.length - 1] : null;

  const derivados = useMemo(() => {
    const dbgg = deltaDozeMeses(data.divida.dbgg_pct_pib);
    const dlsp = deltaDozeMeses(data.divida.dlsp_total_pct_pib);
    const dbggMm = deltaMesAnterior(data.divida.dbgg_pct_pib);
    const dlspMm = deltaMesAnterior(data.divida.dlsp_total_pct_pib);
    // r − g como PontoMensal p/ reaproveitar o delta de 12 meses.
    const gapSerie: PontoMensal[] = sust.map((p) => ({ data: p.data, valor: p.r_menos_g_pp }));
    const gap = deltaDozeMeses(gapSerie);
    return { dbgg, dlsp, dbggMm, dlspMm, gap };
  }, [data.divida, sust]);

  // Leitura editorial montada do dado — vive ATRÁS do (?) do header, nunca em prosa aberta.
  const leitura = useMemo(() => {
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
        if (estab != null) f += ` sem um primário de ${fmtSignedPct(estab, 1)} do PIB`;
        if (realizado != null) f += ` (realizado em 12 meses: ${fmtSignedPct(realizado, 1)})`;
        partes.push(f);
      } else if (gap < 0) {
        let f = `o crescimento nominal supera o custo implícito da dívida em ${fmtNum(Math.abs(gap), 1)} p.p. (r − g) — vento a favor da dinâmica`;
        if (estab != null) f += ` (primário estabilizador: ${fmtSignedPct(estab, 1)} do PIB`;
        if (estab != null && realizado != null) f += `; realizado: ${fmtSignedPct(realizado, 1)})`;
        else if (estab != null) f += ")";
        partes.push(f);
      }
    }
    return `${partes.join("; ")}.`;
  }, [derivados, ultSust]);

  const mesRef = derivados.dbgg
    ? fmtMesCurto(dataIso(derivados.dbgg.data))
    : data.mes_recente
      ? fmtMesCurto(data.mes_recente)
      : "—";

  return (
    <div className="flex flex-col gap-4">
      <FiscalTabs />

      {/* ── Status geral ── */}
      <header className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#132960]">
              Dívida pública
              <MethodInfo className="ml-2 align-middle">
                Trajetória, dinâmica (r − g) e estrutura da dívida do governo brasileiro. O crédito privado (Big Debt
                Cycle) vive nos indicadores de Carga da aba de risco — perímetros distintos não se misturam.
                {leitura ? (
                  <>
                    {" "}
                    <strong>Leitura atual:</strong> {leitura}
                  </>
                ) : null}
              </MethodInfo>
            </h1>
            <p className="mt-1 text-xs text-zinc-500">Referência: {mesRef} · BCB (SGS) + pipeline fiscal AZ (diário)</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="DBGG (% PIB)"
          value={fmtPct(derivados.dbgg?.valor ?? null, 1)}
          delta={derivados.dbgg?.delta12m ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          invertColor
          hint={
            derivados.dbggMm != null
              ? `m/m: ${fmtSignedNum(derivados.dbggMm, 1)} p.p. · gov. geral`
              : "dívida bruta do governo geral"
          }
          size="lg"
        />
        <KpiCard
          label="DLSP (% PIB)"
          value={fmtPct(derivados.dlsp?.valor ?? null, 1)}
          delta={derivados.dlsp?.delta12m ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          invertColor
          hint={
            derivados.dlspMm != null
              ? `m/m: ${fmtSignedNum(derivados.dlspMm, 1)} p.p. · setor público consolidado`
              : "líquida, setor público consolidado"
          }
        />
        <KpiCard
          label="r − g"
          value={ultSust ? fmtSignedNum(ultSust.r_menos_g_pp, 1) : "—"}
          unit="p.p."
          delta={derivados.gap?.delta12m ?? undefined}
          deltaUnit="p.p."
          deltaHint="12m"
          invertColor
          hint="perímetro consolidado (DLSP) — alto = contra a dívida"
        />
        <KpiCard
          label="Primário estabilizador (SP)"
          value={
            ultSust?.primario_estabilizador_pct_pib != null
              ? fmtSignedPct(ultSust.primario_estabilizador_pct_pib, 1)
              : "—"
          }
          unit="do PIB"
          hint={
            ultSust?.primario_realizado_sp_pct_pib != null
              ? `realizado 12m: ${fmtSignedPct(ultSust.primario_realizado_sp_pct_pib, 1)}`
              : "primário que congela a dívida/PIB"
          }
        />
      </div>

      {/* ── Âncora ── */}
      <TrajetoriaDividaCard divida={data.divida} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />

      {/* ── Dinâmica da dívida ── */}
      <Divisor
        label="Dinâmica da dívida"
        info="Quem empurra e quem segura a dívida: a decomposição anual da ΔDLSP (calculada pelo pipeline), a decomposição OFICIAL da ΔDBGG (fatores condicionantes do BCB) e a aritmética r − g — quando o custo implícito supera o crescimento nominal, só superávit primário estabiliza."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {data.decomposicao_dlsp?.anos?.length ? (
          <PorQueSubiuCard anos={data.decomposicao_dlsp.anos} geradoEm={data.gerado_em} />
        ) : null}
        {fatoresDbgg?.anual?.length ? (
          <FatoresDbggCard fatores={fatoresDbgg} geradoEm={fatoresDbgg.gerado_em} />
        ) : null}
        {sust.length > 0 ? (
          <RMenosGCard serie={sust} codaceMensal={codace?.mensal} geradoEm={data.gerado_em} />
        ) : null}
      </div>

      {/* ── Estrutura e rolagem (DPF) ── */}
      <Divisor
        label={dpfRmd ? "Estrutura e rolagem (DPF)" : "Estrutura"}
        info="De que é feita a dívida e quem a carrega: a DPMFi por indexador (vulnerabilidade a juros, inflação e câmbio), os detentores por categoria (RMD) e o perfil de rolagem da DPF — prazo médio, % vincendo em 12 meses e custo médio."
      />
      {dpfRmd?.detentores_brl_bi?.length ? (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {data.composicao_dpmfi ? (
            <ComposicaoDpmfiCard composicao={data.composicao_dpmfi} geradoEm={data.gerado_em} />
          ) : null}
          <DetentoresDpmfiCard detentores={dpfRmd.detentores_brl_bi} geradoEm={dpfRmd.gerado_em} />
        </div>
      ) : data.composicao_dpmfi ? (
        <ComposicaoDpmfiCard composicao={data.composicao_dpmfi} geradoEm={data.gerado_em} />
      ) : null}
      {dpfRmd && (dpfRmd.prazo_medio_dpf_anos?.length || dpfRmd.vincendo_12m_pct?.length) ? (
        <DpfRmdCard dpf={dpfRmd} geradoEm={dpfRmd.gerado_em} />
      ) : null}

      {/* ── Análise completa ── */}
      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Análise completa — os últimos 12 meses em tabela + CSV
        </summary>
        <div className="mt-3">
          <AnaliseCompletaDivida data={data} geradoEm={data.gerado_em} />
        </div>
      </details>

      {/* ── Ficha técnica ── */}
      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Ficha técnica — fontes e metodologia
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
          <p>
            <strong>Fontes e séries.</strong> BCB SGS: 13762 (DBGG % PIB), 4513 (DLSP total), 4503 (DLSP governo
            central); 4174–4178 + 12001 (composição da DPMFi por indexador — a 12001 é a fatia de índices de
            preços/NTN-B que faltava p/ o stack fechar 100%). Recessões: cronologia CODACE/FGV (última datação oficial:
            2020).
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
            usamos, nem o antigo &quot;80% atenção FMI&quot; (sem fonte). O máximo histórico da DBGG é calculado da
            própria série, nunca fixado no código.
          </p>
          <p>
            <strong>Casa canônica.</strong> O crédito privado / endividamento agregado (Big Debt Cycle, SGS 20622) vive
            nos indicadores de Carga da aba Indicadores de risco — saiu desta aba p/ não misturar perímetros.
          </p>
          <p>
            <strong>Onda 3 — fontes novas (cards condicionais).</strong> Decomposição oficial da ΔDBGG: fatores
            condicionantes da Nota de Imprensa/BCB (build_fiscal_dbgg_fatores.py → data/fiscal-dbgg-fatores.json).
            Prazo médio, % vincendo em 12m, custo médio e detentores da DPMFi: Relatório Mensal da Dívida — RMD/Tesouro
            (build_dpf_rmd.py → data/fiscal-dpf-rmd.json). Enquanto o pipeline não publica esses blobs, os cards
            correspondentes não aparecem.
          </p>
          <p>Pipeline: data-pipeline/python/build_fiscal.py (schema v2) · GitHub Actions fiscal-pipeline.yml.</p>
        </div>
      </details>
    </div>
  );
}
