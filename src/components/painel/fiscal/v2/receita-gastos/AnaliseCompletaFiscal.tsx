"use client";

import { useMemo } from "react";

import type { FiscalClassicosData, PontoMensal, PontoMensal12m, PontoMensalPct } from "@/lib/painel-fiscal";
import { ChartCard } from "@/components/painel/core";
import { fmtMesCurto, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, mesIso, ultimoPct } from "./shared";

/**
 * 07 — Esmiuçamento profissional: os últimos 12 meses do fluxo fiscal em
 * tabela (% PIB, 12m móveis) e a série completa em CSV pt-BR — fluxo do
 * governo central + setor público, famílias de receita e rubricas de despesa.
 */

function porPct(serie: ReadonlyArray<PontoMensalPct> | undefined | null): Map<string, number | null> {
  return new Map((serie ?? []).map((p) => [p.data, p.valor_pct]));
}

function porMensal(serie: ReadonlyArray<PontoMensal> | undefined | null): Map<string, number | null> {
  return new Map((serie ?? []).map((p) => [p.data, p.valor]));
}

function por12m(serie: ReadonlyArray<PontoMensal12m> | undefined | null): Map<string, number | null> {
  return new Map((serie ?? []).map((p) => [p.data, p.valor_12m]));
}

export function AnaliseCompletaFiscal({ data }: { data: FiscalClassicosData }) {
  const rg = data.receita_e_gastos;

  const tabela = useMemo(() => {
    const receita = porPct(rg.receita_liquida_pct_pib);
    const despesa = porPct(rg.despesa_total_pct_pib);
    const primario = porPct(rg.primario_central_pct_pib);
    const primarioSp = porPct(rg.primario_sp_12m_pct_pib);
    const jurosSp = porMensal(rg.juros_nominais_sp_12m_pct_pib);
    const nominalSp = porPct(rg.nominal_sp_12m_pct_pib);
    return rg.receita_liquida_pct_pib
      .slice(-12)
      .reverse()
      .map((p) => ({
        mes: p.data,
        receita: receita.get(p.data) ?? null,
        despesa: despesa.get(p.data) ?? null,
        primario: primario.get(p.data) ?? null,
        primarioSp: primarioSp.get(p.data) ?? null,
        jurosSp: jurosSp.get(p.data) ?? null,
        nominalSp: nominalSp.get(p.data) ?? null,
      }));
  }, [rg]);

  const ult = ultimoPct(rg.receita_liquida_pct_pib);
  const sufixo = ult ? `-${ult.data}` : "";

  const csvSerieFiscal = () => {
    const receita = porPct(rg.receita_liquida_pct_pib);
    const despesa = porPct(rg.despesa_total_pct_pib);
    const primario = porPct(rg.primario_central_pct_pib);
    const juros = porPct(rg.juros_central_pct_pib);
    const receitaBrl = por12m(rg.receita_liquida_12m_brl_mm);
    const despesaBrl = por12m(rg.despesa_total_12m_brl_mm);
    const primarioBrl = por12m(rg.primario_central_12m_brl_mm);
    const primarioSp = porPct(rg.primario_sp_12m_pct_pib);
    const jurosSp = porMensal(rg.juros_nominais_sp_12m_pct_pib);
    const nominalSp = porPct(rg.nominal_sp_12m_pct_pib);
    const header = [
      "mes",
      "receita_liquida_pct_pib",
      "despesa_total_pct_pib",
      "primario_central_pct_pib",
      "juros_central_pct_pib",
      "receita_liquida_12m_brl_mm",
      "despesa_total_12m_brl_mm",
      "primario_central_12m_brl_mm",
      "primario_sp_pct_pib",
      "juros_nominais_sp_pct_pib",
      "nominal_sp_pct_pib",
    ];
    const rows = rg.receita_liquida_pct_pib.map((p) => [
      p.data,
      receita.get(p.data),
      despesa.get(p.data),
      primario.get(p.data),
      juros.get(p.data),
      receitaBrl.get(p.data),
      despesaBrl.get(p.data),
      primarioBrl.get(p.data),
      primarioSp.get(p.data),
      jurosSp.get(p.data),
      nominalSp.get(p.data),
    ]);
    baixarCsv(`fiscal-serie-completa${sufixo}.csv`, header, rows);
  };

  const csvFamiliasReceita = () => {
    const rf = data.receita_familias;
    if (!rf) return;
    const adm = porPct(rf.administrada_rfb_12m_pct_pib);
    const incent = porPct(rf.incentivos_fiscais_12m_pct_pib);
    const rgps = porPct(rf.rgps_12m_pct_pib);
    const naoadm = porPct(rf.nao_administrada_12m_pct_pib);
    const divconc = porPct(rf.dividendos_concessoes_12m_pct_pib);
    const liquida = porPct(rg.receita_liquida_pct_pib);
    const header = [
      "mes",
      "administrada_rfb_pct_pib",
      "incentivos_fiscais_pct_pib",
      "rgps_pct_pib",
      "nao_administrada_pct_pib",
      "dividendos_concessoes_pct_pib",
      "receita_liquida_pct_pib",
    ];
    const rows = rf.administrada_rfb_12m_pct_pib.map((p) => [
      p.data,
      adm.get(p.data),
      incent.get(p.data),
      rgps.get(p.data),
      naoadm.get(p.data),
      divconc.get(p.data),
      liquida.get(p.data),
    ]);
    baixarCsv(`fiscal-familias-receita${sufixo}.csv`, header, rows);
  };

  const csvRubricasDespesa = () => {
    const dr = data.despesa_rubricas_v2;
    const colunas: Array<[string, Map<string, number | null>]> = [
      ["previdencia_pct_pib", porPct(rg.previdencia_12m_pct_pib)],
      ["pessoal_pct_pib", porPct(rg.pessoal_12m_pct_pib)],
      ["bpc_loas_pct_pib", porPct(rg.bpc_loas_12m_pct_pib)],
      ["abono_seguro_pct_pib", porPct(rg.abono_seguro_12m_pct_pib)],
      ["fundeb_pct_pib", porPct(rg.fundeb_12m_pct_pib)],
      ["subsidios_pct_pib", porPct(rg.subsidios_12m_pct_pib)],
      ["demais_obrigatorias_pct_pib", porPct(dr?.demais_obrigatorias_12m_pct_pib)],
      ["obrig_controle_fluxo_pct_pib", porPct(dr?.obrig_controle_fluxo_12m_pct_pib)],
      ["discricionarias_pct_pib", porPct(rg.discricionarias_12m_pct_pib)],
      ["despesa_total_pct_pib", porPct(rg.despesa_total_pct_pib)],
    ];
    const header = ["mes", ...colunas.map(([nome]) => nome)];
    const rows = rg.despesa_total_pct_pib.map((p) => [p.data, ...colunas.map(([, mapa]) => mapa.get(p.data))]);
    baixarCsv(`fiscal-rubricas-despesa${sufixo}.csv`, header, rows);
  };

  return (
    <ChartCard
      title="Análise completa — o fluxo fiscal mês a mês"
      subtitle="Os últimos 12 meses em % do PIB (12m móveis), nos dois perímetros: governo central (RTN) e setor público consolidado (BCB)."
      footer="Tesouro RTN (governo central) e BCB SGS (setor público consolidado). Juros SP exibidos como custo (sem sinal). Exporte a série completa, as famílias de receita ou as rubricas de despesa em CSV (padrão Excel pt-BR: separador ; e vírgula decimal)."
      stampGiro={data.gerado_em}
      stampDado={ult ? mesIso(ult.data) : null}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 font-semibold">Mês</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Receita líq.</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Despesa</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Primário central</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Primário SP</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Juros SP</th>
              <th className="py-1.5 text-right font-semibold">Nominal SP</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => (
              <tr key={r.mes} className="border-b border-zinc-100">
                <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtMesCurto(r.mes)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtPct(r.receita, 2)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtPct(r.despesa, 2)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtSignedPct(r.primario, 2)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtSignedPct(r.primarioSp, 2)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtPct(r.jurosSp, 2)}</td>
                <td className="py-1.5 text-right tabular-nums text-zinc-700">{fmtSignedPct(r.nominalSp, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={csvSerieFiscal}
          className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
        >
          Baixar série fiscal completa (CSV)
        </button>
        {data.receita_familias ? (
          <button
            type="button"
            onClick={csvFamiliasReceita}
            className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
          >
            Baixar famílias de receita (CSV)
          </button>
        ) : null}
        <button
          type="button"
          onClick={csvRubricasDespesa}
          className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
        >
          Baixar rubricas de despesa (CSV)
        </button>
      </div>
    </ChartCard>
  );
}
