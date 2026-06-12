"use client";

import { useMemo } from "react";

import type { FiscalClassicosData, PontoMensal } from "@/lib/painel-fiscal";
import { ChartCard } from "@/components/painel/core";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";
import { baixarCsv, dataIso } from "./shared";

/**
 * Esmiuçamento profissional da dívida: tabela dos últimos 12 meses com as
 * variáveis da dinâmica (DBGG, DLSP, r, g, r−g, primário estabilizador) e
 * export CSV (padrão Excel pt-BR) de trajetória, sustentabilidade,
 * decomposição anual e composição da DPMFi.
 */

function mapaPorMes(serie: ReadonlyArray<PontoMensal> | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of serie ?? []) {
    if (p.valor != null && Number.isFinite(p.valor)) m.set(dataIso(p.data).slice(0, 7), p.valor);
  }
  return m;
}

function BotaoCsv({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5"
    >
      {label}
    </button>
  );
}

export function AnaliseCompletaDivida({ data, geradoEm }: { data: FiscalClassicosData; geradoEm: string }) {
  const sust = useMemo(() => data.sustentabilidade?.serie ?? [], [data.sustentabilidade]);
  const dbggMap = useMemo(() => mapaPorMes(data.divida.dbgg_pct_pib), [data.divida.dbgg_pct_pib]);

  // Últimos 12 meses da série de sustentabilidade, do mais recente p/ o mais antigo.
  const tabela = useMemo(
    () =>
      sust
        .slice(-12)
        .reverse()
        .map((p) => ({
          mes: dataIso(p.data).slice(0, 7),
          dbgg: dbggMap.get(dataIso(p.data).slice(0, 7)) ?? null,
          dlsp: p.dlsp_pct_pib,
          r: p.r_aa_pct,
          g: p.g_aa_pct,
          gap: p.r_menos_g_pp,
          estabilizador: p.primario_estabilizador_pct_pib,
        })),
    [sust, dbggMap],
  );

  const sufixo = data.mes_recente ?? "atual";

  const csvTrajetoria = () => {
    const dlspMap = mapaPorMes(data.divida.dlsp_total_pct_pib);
    const centralMap = mapaPorMes(data.divida.dlsp_gov_central_pct_pib);
    const rows = data.divida.dbgg_pct_pib
      .filter((p) => p.valor != null)
      .map((p) => {
        const mes = dataIso(p.data).slice(0, 7);
        const dlsp = dlspMap.get(mes) ?? null;
        return [
          mes,
          p.valor,
          dlsp,
          centralMap.get(mes) ?? null,
          p.valor != null && dlsp != null ? +(p.valor - dlsp).toFixed(2) : null,
        ];
      });
    baixarCsv(`divida-trajetoria-${sufixo}.csv`, ["mes", "dbgg_pct_pib", "dlsp_total_pct_pib", "dlsp_gov_central_pct_pib", "dbgg_menos_dlsp_pp"], rows);
  };

  const csvSustentabilidade = () => {
    if (sust.length === 0) return;
    const rows = sust.map((p) => [
      dataIso(p.data).slice(0, 7),
      p.r_aa_pct,
      p.g_aa_pct,
      p.r_menos_g_pp,
      p.primario_estabilizador_pct_pib,
      p.primario_realizado_sp_pct_pib,
      p.dlsp_pct_pib,
    ]);
    baixarCsv(
      `divida-sustentabilidade-${sufixo}.csv`,
      ["mes", "r_aa_pct", "g_aa_pct", "r_menos_g_pp", "primario_estabilizador_pct_pib", "primario_realizado_sp_pct_pib", "dlsp_pct_pib"],
      rows,
    );
  };

  const csvDecomposicao = () => {
    const anos = data.decomposicao_dlsp?.anos ?? [];
    if (anos.length === 0) return;
    const rows = anos.map((a) => [a.ano, a.delta_pp, a.juros_pp, a.primario_pp, a.efeito_crescimento_pp, a.residuo_pp, a.dlsp_fim_pct_pib]);
    baixarCsv(
      `divida-decomposicao-anual-${sufixo}.csv`,
      ["ano", "delta_pp", "juros_pp", "primario_pp", "efeito_crescimento_pp", "residuo_pp", "dlsp_fim_pct_pib"],
      rows,
    );
  };

  const csvComposicao = () => {
    const comp = data.composicao_dpmfi;
    if (!comp) return;
    const mapas = [
      ["selic_pct", mapaPorMes(comp.selic_pct)],
      ["indices_precos_pct", mapaPorMes(comp.indices_precos_pct)],
      ["prefixado_pct", mapaPorMes(comp.prefixado_pct)],
      ["cambio_pct", mapaPorMes(comp.cambio_pct)],
      ["tr_pct", mapaPorMes(comp.tr_pct)],
      ["outros_pct", mapaPorMes(comp.outros_pct)],
    ] as const;
    const meses = [...new Set(mapas.flatMap(([, m]) => [...m.keys()]))].sort();
    const rows = meses.map((mes) => [mes, ...mapas.map(([, m]) => m.get(mes) ?? null)]);
    baixarCsv(`divida-composicao-dpmfi-${sufixo}.csv`, ["mes", ...mapas.map(([k]) => k)], rows);
  };

  return (
    <ChartCard
      title="Análise completa — os últimos 12 meses em números"
      subtitle="DBGG e DLSP em % do PIB; r, g e r−g em % a.a. / p.p.; primário estabilizador em % do PIB. Exporte as séries completas em CSV (padrão Excel pt-BR)."
      footer="DBGG: SGS 13762. DLSP, r, g e primário estabilizador: série de sustentabilidade do pipeline (perímetro consolidado, fórmula única). Decomposição anual e composição DPMFi nos CSVs."
      stampGiro={geradoEm}
      stampDado={tabela.length > 0 ? tabela[0].mes : null}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 font-semibold">Mês</th>
              <th className="py-1.5 pr-2 text-right font-semibold">DBGG</th>
              <th className="py-1.5 pr-2 text-right font-semibold">DLSP</th>
              <th className="py-1.5 pr-2 text-right font-semibold">r (% a.a.)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">g (% a.a.)</th>
              <th className="py-1.5 pr-2 text-right font-semibold">r − g (p.p.)</th>
              <th className="py-1.5 text-right font-semibold">Estabilizador</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => (
              <tr key={r.mes} className="border-b border-zinc-100">
                <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtMesCurto(r.mes)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{r.dbgg != null ? `${fmtNum(r.dbgg, 1)}%` : "—"}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{r.dlsp != null ? `${fmtNum(r.dlsp, 1)}%` : "—"}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtNum(r.r, 1)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtNum(r.g, 1)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">{fmtSignedNum(r.gap, 1)}</td>
                <td className="py-1.5 text-right tabular-nums text-zinc-700">
                  {r.estabilizador != null ? `${fmtNum(r.estabilizador, 1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <BotaoCsv label="Trajetória DBGG/DLSP (CSV)" onClick={csvTrajetoria} />
        {sust.length > 0 ? <BotaoCsv label="Sustentabilidade r−g (CSV)" onClick={csvSustentabilidade} /> : null}
        {data.decomposicao_dlsp?.anos?.length ? <BotaoCsv label="Decomposição anual (CSV)" onClick={csvDecomposicao} /> : null}
        {data.composicao_dpmfi ? <BotaoCsv label="Composição DPMFi (CSV)" onClick={csvComposicao} /> : null}
      </div>
    </ChartCard>
  );
}
