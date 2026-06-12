"use client";

import { useMemo } from "react";

import type { ContasExternasData } from "@/lib/painel-contas-externas";
import { ChartCard } from "@/components/painel/core";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import { baixarCsv, mesIso, num } from "./shared";

/**
 * Bloco final — esmiuçamento: os últimos 12 meses em tabela (todas as séries
 * 12m lado a lado) e export CSV padrão Excel pt-BR (";", vírgula decimal, BOM).
 */

const BTN =
  "rounded-lg border border-[#132960]/15 px-3 py-1.5 text-xs font-semibold text-[#132960] transition hover:bg-[#132960]/5";

export function AnaliseCompletaContasExternas({ data }: { data: ContasExternasData }) {
  const decomp = useMemo(() => data.bloco_a.decomposicao_12m ?? [], [data.bloco_a.decomposicao_12m]);
  const balanca = useMemo(() => data.bloco_a.balanca_12m ?? [], [data.bloco_a.balanca_12m]);
  const cobertura = useMemo(() => data.bloco_b.cobertura_idp ?? [], [data.bloco_b.cobertura_idp]);
  const idp = useMemo(() => data.bloco_b.idp_decomposicao_12m ?? [], [data.bloco_b.idp_decomposicao_12m]);
  const reservas = useMemo(() => data.bloco_c.reservas_mensal ?? [], [data.bloco_c.reservas_mensal]);
  const meses = useMemo(() => data.bloco_c.meses_importacao_serie ?? [], [data.bloco_c.meses_importacao_serie]);

  const tabela = useMemo(() => {
    const cobPorMes = new Map(cobertura.map((p) => [p.mes, p]));
    const idpPorMes = new Map(idp.map((p) => [p.mes, p]));
    const resPorMes = new Map(reservas.map((p) => [p.mes, p]));
    return decomp
      .slice(-12)
      .reverse()
      .map((p) => ({
        mes: p.mes,
        total: num(p, "total"),
        bens: num(p, "bens"),
        servicos: num(p, "servicos"),
        renda_primaria: num(p, "renda_primaria"),
        renda_secundaria: num(p, "renda_secundaria"),
        idp_total: num(idpPorMes.get(p.mes), "total"),
        cobertura_pct: num(cobPorMes.get(p.mes), "cobertura_pct"),
        reservas: num(resPorMes.get(p.mes), "reservas_us_bi"),
      }));
  }, [decomp, cobertura, idp, reservas]);

  const sufixo = data.ultima_referencia_mensal ?? "atual";

  const csvBp = () => {
    const balPorMes = new Map(balanca.map((p) => [p.mes, p]));
    baixarCsv(
      `contas-externas-bp-12m-${sufixo}.csv`,
      ["mes", "bens_12m", "servicos_12m", "renda_primaria_12m", "renda_secundaria_12m", "tc_12m", "exportacoes_12m", "importacoes_12m", "saldo_balanca_12m"],
      decomp.map((p) => {
        const b = balPorMes.get(p.mes);
        return [
          p.mes,
          num(p, "bens"),
          num(p, "servicos"),
          num(p, "renda_primaria"),
          num(p, "renda_secundaria"),
          num(p, "total"),
          num(b, "exportacoes"),
          num(b, "importacoes"),
          num(b, "saldo"),
        ];
      }),
    );
  };

  const csvFinanciamento = () => {
    const idpPorMes = new Map(idp.map((p) => [p.mes, p]));
    baixarCsv(
      `contas-externas-financiamento-${sufixo}.csv`,
      ["mes", "tc_pct_pib", "idp_pct_pib", "cobertura_pct", "idp_participacao_12m", "idp_reinvestimento_12m", "idp_intercompanhia_12m", "idp_total_12m"],
      cobertura.map((p) => {
        const d = idpPorMes.get(p.mes);
        return [
          p.mes,
          num(p, "tc_pct_pib"),
          num(p, "idp_pct_pib"),
          num(p, "cobertura_pct"),
          num(d, "participacao"),
          num(d, "reinvestimento"),
          num(d, "intercompanhia"),
          num(d, "total"),
        ];
      }),
    );
  };

  const csvReservas = () => {
    const mesesPorMes = new Map(meses.map((p) => [p.mes, p]));
    baixarCsv(
      `contas-externas-reservas-${sufixo}.csv`,
      ["mes", "reservas_us_bi", "meses_importacao_bens", "meses_importacao_bens_servicos"],
      reservas.map((p) => {
        const m = mesesPorMes.get(p.mes);
        return [p.mes, num(p, "reservas_us_bi"), num(m, "meses_bens"), num(m, "meses_bens_servicos")];
      }),
    );
  };

  return (
    <ChartCard
      title="Análise completa — as contas externas mês a mês"
      subtitle="As séries acumuladas em 12 meses lado a lado (US$ bilhões, exceto onde indicado) e o export CSV de cada bloco."
      footer="Acumulados 12m em US$ bi (BCB/SGS, BPM6); cobertura em % do déficit; reservas em US$ bi (conceito liquidez). CSV no padrão Excel pt-BR: separador ';', vírgula decimal e BOM UTF-8."
      stampGiro={data.gerado_em}
      stampDado={data.ultima_referencia_mensal}
    >
      {tabela.length === 0 ? (
        <p className="flex h-40 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou as séries 12m (schema v2).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-400">
                <th className="py-1.5 pr-2 font-semibold">Mês</th>
                <th className="py-1.5 pr-2 text-right font-semibold">TC 12m</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Bens</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Serviços</th>
                <th className="py-1.5 pr-2 text-right font-semibold">R. primária</th>
                <th className="py-1.5 pr-2 text-right font-semibold">R. secundária</th>
                <th className="py-1.5 pr-2 text-right font-semibold">IDP 12m</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Cobertura</th>
                <th className="py-1.5 text-right font-semibold">Reservas</th>
              </tr>
            </thead>
            <tbody>
              {tabela.map((r) => (
                <tr key={r.mes} className="border-b border-zinc-100">
                  <td className="py-1.5 pr-2 font-semibold text-[#132960]">{fmtMesCurto(mesIso(r.mes))}</td>
                  {([r.total, r.bens, r.servicos, r.renda_primaria, r.renda_secundaria, r.idp_total] as const).map(
                    (v, i) => (
                      <td key={i} className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                        {v != null ? fmtSignedNum(v, 1) : "—"}
                      </td>
                    ),
                  )}
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-700">
                    {r.cobertura_pct != null ? fmtPct(r.cobertura_pct, 0) : "—"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-700">
                    {r.reservas != null ? fmtNum(r.reservas, 0) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {decomp.length > 0 ? (
          <button type="button" onClick={csvBp} className={BTN}>
            Baixar balanço de pagamentos 12m (CSV)
          </button>
        ) : null}
        {cobertura.length > 0 ? (
          <button type="button" onClick={csvFinanciamento} className={BTN}>
            Baixar financiamento e IDP (CSV)
          </button>
        ) : null}
        {reservas.length > 0 ? (
          <button type="button" onClick={csvReservas} className={BTN}>
            Baixar reservas e meses de importação (CSV)
          </button>
        ) : null}
      </div>
    </ChartCard>
  );
}
