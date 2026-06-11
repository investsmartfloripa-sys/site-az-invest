"use client";

import { useMemo, useState } from "react";

import type { CambioMacroData } from "@/lib/painel-contas-externas";
import DataStamp from "@/components/painel/DataStamp";
import { fmtMesCurto, fmtNum } from "@/lib/format-br";
import { baixarCsv } from "./shared";

/**
 * Bloco 05 — esmiuçamento: a tabela mensal completa (nominal, câmbio real,
 * REER, Selic, Fed Funds e diferencial) com download CSV.
 *
 * A tabela mostra as linhas mais recentes (expansível); o CSV leva o
 * histórico INTEIRO — gerado no navegador a partir dos dados já carregados.
 */

type Linha = {
  mes: string;
  ptax_media: number | null;
  ptax_fim: number | null;
  bilateral: number | null;
  reer: number | null;
  selic: number | null;
  fed: number | null;
  diferencial: number | null;
};

const LINHAS_INICIAIS = 24;

export function TabelaMensalCard({ data }: { data: CambioMacroData }) {
  const [expandida, setExpandida] = useState(false);

  const linhas = useMemo<Linha[]>(() => {
    const porMes = new Map<string, Linha>();
    const get = (mes: string): Linha => {
      let l = porMes.get(mes);
      if (!l) {
        l = {
          mes,
          ptax_media: null,
          ptax_fim: null,
          bilateral: null,
          reer: null,
          selic: null,
          fed: null,
          diferencial: null,
        };
        porMes.set(mes, l);
      }
      return l;
    };
    for (const r of data.nominal.serie) {
      const l = get(r.mes);
      l.ptax_media = r.ptax_media;
      l.ptax_fim = r.ptax_fim;
    }
    for (const r of data.cambio_real.bilateral.serie) get(r.mes).bilateral = r.indice;
    for (const r of data.cambio_real.reer.serie) get(r.mes).reer = r.indice;
    for (const r of data.juros.diferencial.serie) {
      const l = get(r.mes);
      l.selic = r.selic_meta;
      l.fed = r.fed_funds;
      l.diferencial = r.diferencial_pp;
    }
    return [...porMes.values()].sort((a, b) => (a.mes > b.mes ? -1 : 1)); // mais recente primeiro
  }, [data]);

  const visiveis = expandida ? linhas : linhas.slice(0, LINHAS_INICIAIS);

  const baixar = () => {
    baixarCsv(
      `cambio-macro-${data.ultima_referencia_mensal}.csv`,
      [
        "mes",
        "ptax_venda_media",
        "ptax_venda_fim_mes",
        "cambio_real_bilateral_base100",
        "reer_bcb_11752",
        "selic_meta_aa",
        "fed_funds_aa",
        "diferencial_pp",
      ],
      [...linhas]
        .reverse() // CSV em ordem cronológica
        .map((l) => [l.mes, l.ptax_media, l.ptax_fim, l.bilateral, l.reer, l.selic, l.fed, l.diferencial]),
    );
  };

  return (
    <section className="rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[#132960]">Tabela mensal completa</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Nominal, câmbio real (alta = depreciação), REER e paridade de juros, mês a mês.
          </p>
        </div>
        <button
          type="button"
          onClick={baixar}
          className="rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50"
        >
          Baixar CSV — histórico completo
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-xs tabular-nums">
          <thead>
            <tr className="border-b border-[#132960]/15 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Mês</th>
              <th className="py-2 pr-3 text-right font-semibold">PTAX média (R$)</th>
              <th className="py-2 pr-3 text-right font-semibold">PTAX fim (R$)</th>
              <th className="py-2 pr-3 text-right font-semibold">Real bilateral (b.100)</th>
              <th className="py-2 pr-3 text-right font-semibold">REER (11752)</th>
              <th className="py-2 pr-3 text-right font-semibold">Selic (% a.a.)</th>
              <th className="py-2 pr-3 text-right font-semibold">Fed (% a.a.)</th>
              <th className="py-2 text-right font-semibold">Dif. (p.p.)</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.mes} className="border-b border-zinc-100 text-zinc-700">
                <td className="py-1.5 pr-3 font-medium text-[#132960]">{fmtMesCurto(l.mes)}</td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.ptax_media, 4)}</td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.ptax_fim, 4)}</td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.bilateral, 1)}</td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.reer, 1)}</td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.selic, 2)}</td>
                <td className="py-1.5 pr-3 text-right">{fmtNum(l.fed, 2)}</td>
                <td className="py-1.5 text-right font-semibold">{fmtNum(l.diferencial, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpandida((v) => !v)}
          className="text-xs font-semibold text-[#027DFC] hover:underline"
        >
          {expandida ? "Mostrar só os últimos 24 meses" : `Mostrar todos os ${linhas.length} meses`}
        </button>
        <DataStamp giro={data.generated_at} dado={data.ultima_referencia_mensal} />
      </div>
    </section>
  );
}
