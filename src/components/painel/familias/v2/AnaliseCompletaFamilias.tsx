"use client";

import { useMemo } from "react";

import type { FamiliasData } from "@/lib/painel-familias";
import { ChartCard } from "@/components/painel/core";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { baixarCsv, isoData, num, serie12mIpcaFaixa, serieToPoints } from "./shared";

/**
 * "Análise completa" — esmiuçamento profissional: tabela com os últimos 12
 * meses dos principais indicadores mensais do painel + export CSV por bloco
 * (padrão Excel pt-BR, separador ";" e vírgula decimal).
 */

type LinhaTabela = {
  mes: string;
  endividamento: number | null;
  comprometimento: number | null;
  inadimplencia: number | null;
  cestaHoras: number | null;
  smUsdPtax: number | null;
};

function ultimoValorNoMes(pontos: ReadonlyArray<readonly [string, number]>, mes7: string): number | null {
  for (let i = pontos.length - 1; i >= 0; i--) {
    if (pontos[i][0].slice(0, 7) === mes7) return pontos[i][1];
  }
  return null;
}

export function AnaliseCompletaFamilias({ data, geradoEm }: { data: FamiliasData; geradoEm: string }) {
  const { renda, endividamento, poder_compra, estrutura_social } = data;

  const tabela = useMemo<LinhaTabela[]>(() => {
    if (!endividamento) return [];
    const endivPts = serieToPoints(endividamento.bloco_endividamento.series_pontos["total"]);
    const compPts = serieToPoints(endividamento.bloco_comprometimento.series_pontos["servico_divida"]);
    const inadPts = serieToPoints(endividamento.bloco_inadimplencia.series_pontos["pf_livres_total"]);
    const cestaPts = (poder_compra?.bloco_cesta_basica.serie ?? []).map(
      (p) => [isoData(p.data), p.horas_sm] as const,
    );
    const smUsdPts = (poder_compra?.bloco_cambio_ptax.serie ?? []).map(
      (p) => [isoData(p.data), p.sm_usd_ptax] as const,
    );

    const meses = endivPts.slice(-12).map(([d]) => d.slice(0, 7));
    return meses
      .map((mes7) => ({
        mes: `${mes7}-01`,
        endividamento: ultimoValorNoMes(endivPts, mes7),
        comprometimento: ultimoValorNoMes(compPts, mes7),
        inadimplencia: ultimoValorNoMes(inadPts, mes7),
        cestaHoras: ultimoValorNoMes(cestaPts, mes7),
        smUsdPtax: ultimoValorNoMes(smUsdPts, mes7),
      }))
      .reverse();
  }, [endividamento, poder_compra]);

  const csvRenda = () => {
    if (!renda) return;
    const posicaoByTrim = new Map(renda.bloco_renda_posicao.serie.map((p) => [p.trim, p] as const));
    const header = [
      "trim_movel",
      "rendimento_medio_real",
      "rendimento_medio_nominal",
      "var_pct_aa_real",
      "privado_com_carteira",
      "privado_sem_carteira",
      "publico",
      "conta_propria",
    ];
    const rows = renda.bloco_renda_total.serie.map((p) => {
      const pos = posicaoByTrim.get(p.trim);
      return [
        p.trim,
        num(p, "rendimento_medio_real"),
        num(p, "rendimento_medio_nominal"),
        num(p, "var_pct_aa_real"),
        num(pos, "empregado_privado_com_carteira"),
        num(pos, "empregado_privado_sem_carteira"),
        num(pos, "empregado_publico"),
        num(pos, "conta_propria"),
      ];
    });
    baixarCsv("familias-renda.csv", header, rows);
  };

  const csvEndividamento = () => {
    if (!endividamento) return;
    const blocos: Array<{ prefixo: string; series: Record<string, { mes: string; valor: number }[]> }> = [
      { prefixo: "endividamento", series: endividamento.bloco_endividamento.series_pontos },
      { prefixo: "comprometimento", series: endividamento.bloco_comprometimento.series_pontos },
      { prefixo: "inadimplencia", series: endividamento.bloco_inadimplencia.series_pontos },
      ...(endividamento.bloco_juros ? [{ prefixo: "juros", series: endividamento.bloco_juros.series_pontos }] : []),
    ];
    const colunas: string[] = [];
    const byMes = new Map<string, Map<string, number>>();
    for (const b of blocos) {
      for (const [key, serie] of Object.entries(b.series)) {
        const col = `${b.prefixo}_${key}`;
        colunas.push(col);
        for (const p of serie) {
          const mes = isoData(p.mes);
          let row = byMes.get(mes);
          if (!row) {
            row = new Map();
            byMes.set(mes, row);
          }
          row.set(col, p.valor);
        }
      }
    }
    const meses = [...byMes.keys()].sort();
    const rows = meses.map((mes) => [mes, ...colunas.map((c) => byMes.get(mes)?.get(c) ?? null)]);
    baixarCsv("familias-endividamento.csv", ["mes", ...colunas], rows);
  };

  const csvPoderCompra = () => {
    if (!poder_compra) return;
    const byMes = new Map<string, Record<string, number | null>>();
    const garante = (mes: string) => {
      let row = byMes.get(mes);
      if (!row) {
        row = {};
        byMes.set(mes, row);
      }
      return row;
    };
    for (const p of poder_compra.bloco_cesta_basica.serie) {
      const row = garante(isoData(p.data));
      row.cesta_brl = p.cesta_brl;
      row.cesta_horas_sm = p.horas_sm;
      row.cesta_pct_sm = p.pct_sm;
    }
    for (const p of poder_compra.bloco_cambio_ptax.serie) {
      const row = garante(isoData(p.data));
      row.sm_usd_ptax = p.sm_usd_ptax;
      row.ptax = p.ptax;
    }
    for (const p of poder_compra.bloco_ppc.serie) {
      const row = garante(isoData(p.data));
      row.sm_usd_ppc = p.sm_usd_ppc ?? null;
    }
    for (const p of poder_compra.bloco_fipezap.serie) {
      const row = garante(isoData(p.data));
      row.fipezap_var_12m = p.var_pct_aa;
      row.ipca_12m = p.ipca_12m ?? null;
    }
    const colunas = ["cesta_brl", "cesta_horas_sm", "cesta_pct_sm", "sm_usd_ptax", "ptax", "sm_usd_ppc", "fipezap_var_12m", "ipca_12m"];
    const meses = [...byMes.keys()].sort();
    const rows = meses.map((mes) => [mes, ...colunas.map((c) => byMes.get(mes)?.[c] ?? null)]);
    baixarCsv("familias-poder-compra.csv", ["mes", ...colunas], rows);
  };

  const csvEstruturaAnual = () => {
    if (!estrutura_social) return;
    const byAno = new Map<string, Record<string, number | null>>();
    const garante = (ano: string) => {
      let row = byAno.get(ano);
      if (!row) {
        row = {};
        byAno.set(ano, row);
      }
      return row;
    };
    for (const p of estrutura_social.bloco_concentracao_renda.serie) {
      const row = garante(p.ano);
      row.top10 = p.top10;
      row.middle50 = p.middle50;
      row.bottom40 = p.bottom40;
    }
    for (const p of estrutura_social.bloco_pobreza.serie) {
      const row = garante(p.ano);
      row.pobreza_pct_300 = p.pct_300 ?? null;
      row.pobreza_pct_420 = p.pct_420 ?? null;
      row.pobreza_pct_830 = p.pct_830 ?? null;
    }
    for (const p of estrutura_social.bloco_gini.serie) {
      garante(p.ano).gini = p.valor;
    }
    const colunas = ["top10", "middle50", "bottom40", "pobreza_pct_300", "pobreza_pct_420", "pobreza_pct_830", "gini"];
    const anos = [...byAno.keys()].sort();
    const rows = anos.map((ano) => [ano, ...colunas.map((c) => byAno.get(ano)?.[c] ?? null)]);
    baixarCsv("familias-estrutura-social-anual.csv", ["ano", ...colunas], rows);
  };

  const csvEstruturaMensal = () => {
    if (!estrutura_social) return;
    const byMes = new Map<string, Record<string, number | null>>();
    const garante = (mes: string) => {
      let row = byMes.get(mes);
      if (!row) {
        row = {};
        byMes.set(mes, row);
      }
      return row;
    };
    for (const p of estrutura_social.bloco_transferencias_sociais.serie) {
      const row = garante(isoData(p.data));
      row.pbf_real_milhoes = p.pbf_valor_real_milhoes ?? null;
      row.bpc_real_milhoes = p.bpc_valor_real_milhoes ?? null;
      row.pbf_nominal_milhoes = p.pbf_valor_milhoes ?? null;
      row.bpc_nominal_milhoes = p.bpc_valor_milhoes ?? null;
      row.bpc_pessoas = p.bpc_pessoas ?? null;
    }
    for (const p of serie12mIpcaFaixa(estrutura_social.bloco_ipca_faixa_renda)) {
      const row = garante(isoData(p.data));
      row.ipca12m_muito_baixa = num(p, "muito_baixa");
      row.ipca12m_media = num(p, "media");
      row.ipca12m_alta = num(p, "alta");
      row.ipca12m_spread_pp = num(p, "spread_pp");
    }
    const colunas = [
      "pbf_real_milhoes",
      "bpc_real_milhoes",
      "pbf_nominal_milhoes",
      "bpc_nominal_milhoes",
      "bpc_pessoas",
      "ipca12m_muito_baixa",
      "ipca12m_media",
      "ipca12m_alta",
      "ipca12m_spread_pp",
    ];
    const meses = [...byMes.keys()].sort();
    const rows = meses.map((mes) => [mes, ...colunas.map((c) => byMes.get(mes)?.[c] ?? null)]);
    baixarCsv("familias-estrutura-social-mensal.csv", ["mes", ...colunas], rows);
  };

  const botoes = [
    renda ? { label: "Renda — PNAD (CSV)", onClick: csvRenda } : null,
    endividamento ? { label: "Endividamento — BCB (CSV)", onClick: csvEndividamento } : null,
    poder_compra ? { label: "Poder de compra (CSV)", onClick: csvPoderCompra } : null,
    estrutura_social ? { label: "Estrutura social — anual (CSV)", onClick: csvEstruturaAnual } : null,
    estrutura_social ? { label: "Estrutura social — mensal (CSV)", onClick: csvEstruturaMensal } : null,
  ].filter((b): b is { label: string; onClick: () => void } => b != null);

  return (
    <ChartCard
      title="Análise completa — tabela e export por bloco"
      subtitle="Os principais indicadores mensais do painel nos últimos 12 meses, e as séries completas em CSV (padrão Excel pt-BR)."
      footer="Endividamento/comprometimento/inadimplência: BCB SGS. Cesta e SM em US$: Ipeadata/DIEESE e BCB. Os CSVs trazem as séries integrais de cada bloco, incluindo colunas que não estão nos gráficos."
      stampGiro={geradoEm}
      stampDado={tabela.length > 0 ? tabela[0].mes : null}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 font-semibold">Mês</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Endividamento (% renda 12m)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Comprometimento (% mês)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Inadimpl. livres (%)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Cesta (h de SM)</th>
              <th className="py-1.5 text-right font-semibold">SM (US$ PTAX)</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => (
              <tr key={r.mes} className="border-b border-zinc-100">
                <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtMesCurto(r.mes)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                  {r.endividamento != null ? fmtPct(r.endividamento, 1) : "—"}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                  {r.comprometimento != null ? fmtPct(r.comprometimento, 1) : "—"}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                  {r.inadimplencia != null ? fmtPct(r.inadimplencia, 1) : "—"}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                  {r.cestaHoras != null ? `${fmtNum(r.cestaHoras, 1)} h` : "—"}
                </td>
                <td className="py-1.5 text-right tabular-nums text-zinc-700">
                  {r.smUsdPtax != null ? `US$ ${fmtNum(r.smUsdPtax, 0)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {botoes.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
          >
            {b.label}
          </button>
        ))}
      </div>
    </ChartCard>
  );
}
