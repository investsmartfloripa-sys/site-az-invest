"use client";

import { useMemo, useState } from "react";

import type { AberturaHierarquica, HierarquiaNo } from "@/lib/painel-ipca";
import { ChartCard } from "@/components/painel/core";
import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtSignedNum } from "@/lib/format-br";
import { baixarCsv } from "../v2/shared";

/**
 * Abertura hierárquica do mês: grupo → subgrupo → item, expansível, com
 * variação, acumulados oficiais, peso e contribuição — a tabela 7060 do IBGE
 * navegável. Subitens (~380) ficam na tabela de influências, com busca.
 */

function Valor({ v, dec = 2, semSinal = false }: { v: number | null; dec?: number; semSinal?: boolean }) {
  if (v == null) return <span className="text-zinc-300">—</span>;
  const cor = semSinal ? undefined : v > 0 ? AZ_CHART.negText : v < 0 ? AZ_CHART.neutral : undefined;
  return (
    <span className="tabular-nums" style={{ color: cor }}>
      {semSinal ? fmtNum(v, dec) : fmtSignedNum(v, dec)}
    </span>
  );
}

function LinhaNo({
  no,
  nivel,
  aberto,
  temFilhos,
  onToggle,
}: {
  no: HierarquiaNo;
  nivel: 0 | 1 | 2;
  aberto?: boolean;
  temFilhos?: boolean;
  onToggle?: () => void;
}) {
  const pad = 12 + nivel * 18;
  return (
    <tr
      className={`border-t border-zinc-50 ${nivel === 0 ? "bg-white font-semibold" : nivel === 1 ? "bg-zinc-50/40" : "bg-white"} ${temFilhos ? "cursor-pointer hover:bg-[#eef2f8]/60" : ""}`}
      onClick={temFilhos ? onToggle : undefined}
    >
      <td className="whitespace-nowrap py-1.5 pr-3 text-zinc-800" style={{ paddingLeft: pad }}>
        {temFilhos ? (
          <span className="mr-1 inline-block w-3 text-center text-[10px] text-[#027DFC]">{aberto ? "▾" : "▸"}</span>
        ) : (
          <span className="mr-1 inline-block w-3" />
        )}
        {no.nome}
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right"><Valor v={no.var} /></td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right"><Valor v={no.acum_ano} /></td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right"><Valor v={no.acum_12m} /></td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right text-zinc-600"><Valor v={no.peso} semSinal /></td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold"><Valor v={no.contrib_pp} dec={3} /></td>
    </tr>
  );
}

export function TabelaHierarquicaCard({
  hierarquia,
  mesRef,
  geradoEm,
}: {
  hierarquia: AberturaHierarquica;
  mesRef: string;
  geradoEm: string;
}) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const toggle = (codigo: string) =>
    setAbertos((prev) => {
      const novo = new Set(prev);
      if (novo.has(codigo)) novo.delete(codigo);
      else novo.add(codigo);
      return novo;
    });

  const todosCodigos = useMemo(() => {
    const out: string[] = [];
    for (const g of hierarquia.grupos) {
      out.push(g.codigo);
      for (const s of g.subgrupos) out.push(s.codigo);
    }
    return out;
  }, [hierarquia]);

  const exportarCsv = () => {
    const header = ["Nível", "Código", "Nome", "Var. mês (%)", "No ano (%)", "12 meses (%)", "Peso (%)", "Contrib. (p.p.)"];
    const rows: Array<Array<string | number | null>> = [];
    const linha = (nivel: string, no: HierarquiaNo) => [
      nivel, no.codigo, no.nome, no.var, no.acum_ano, no.acum_12m, no.peso, no.contrib_pp,
    ];
    if (hierarquia.geral) rows.push(linha("Geral", hierarquia.geral));
    for (const g of hierarquia.grupos) {
      rows.push(linha("Grupo", g));
      for (const s of g.subgrupos) {
        rows.push(linha("Subgrupo", s));
        for (const it of s.itens) rows.push(linha("Item", it));
      }
    }
    baixarCsv(`ipca-abertura-${mesRef}.csv`, header, rows);
  };

  return (
    <ChartCard
      title={`Abertura hierárquica — ${fmtMesCurto(mesRef)}`}
      subtitle="Grupo → subgrupo → item, com variação do mês, acumulados oficiais, peso e contribuição. Clique numa linha para abrir o nível seguinte."
      footer="SIDRA 7060 (c315 todos os níveis): v63 variação mensal, v69 acumulada no ano, v2265 acumulada 12m, v66 peso mensal. Contribuição = variação × peso ÷ 100. Subitens estão na tabela de maiores influências (busca + ordenação)."
      toolbar={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAbertos(new Set(todosCodigos))}
            className="rounded-md border border-[#132960]/20 px-2.5 py-1 text-[11px] font-semibold text-[#132960] transition hover:bg-[#eef2f8]"
          >
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={() => setAbertos(new Set())}
            className="rounded-md border border-[#132960]/20 px-2.5 py-1 text-[11px] font-semibold text-[#132960] transition hover:bg-[#eef2f8]"
          >
            Recolher
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="rounded-md border border-[#132960]/20 px-2.5 py-1 text-[11px] font-semibold text-[#132960] transition hover:bg-[#eef2f8]"
          >
            Baixar CSV
          </button>
        </div>
      }
      stampGiro={geradoEm}
      stampDado={mesRef}
    >
      <div className="max-h-[520px] overflow-auto rounded-lg border border-zinc-100">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-zinc-700">Grupo / subgrupo / item</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Var. mês (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">No ano (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">12 meses (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Peso (%)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Contrib. (p.p.)</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {hierarquia.grupos.map((g) => (
              <FragmentoGrupo key={g.codigo} grupo={g} abertos={abertos} toggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function FragmentoGrupo({
  grupo,
  abertos,
  toggle,
}: {
  grupo: AberturaHierarquica["grupos"][number];
  abertos: Set<string>;
  toggle: (codigo: string) => void;
}) {
  const aberto = abertos.has(grupo.codigo);
  return (
    <>
      <LinhaNo
        no={grupo}
        nivel={0}
        aberto={aberto}
        temFilhos={grupo.subgrupos.length > 0}
        onToggle={() => toggle(grupo.codigo)}
      />
      {aberto
        ? grupo.subgrupos.map((s) => {
            const sAberto = abertos.has(s.codigo);
            return (
              <FragmentoSubgrupo key={s.codigo} subgrupo={s} aberto={sAberto} onToggle={() => toggle(s.codigo)} />
            );
          })
        : null}
    </>
  );
}

function FragmentoSubgrupo({
  subgrupo,
  aberto,
  onToggle,
}: {
  subgrupo: AberturaHierarquica["grupos"][number]["subgrupos"][number];
  aberto: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <LinhaNo no={subgrupo} nivel={1} aberto={aberto} temFilhos={subgrupo.itens.length > 0} onToggle={onToggle} />
      {aberto ? subgrupo.itens.map((it) => <LinhaNo key={it.codigo} no={it} nivel={2} />) : null}
    </>
  );
}
