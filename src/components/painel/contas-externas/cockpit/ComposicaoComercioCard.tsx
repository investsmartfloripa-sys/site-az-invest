"use client";

import { useState } from "react";

import type { ContasExternasComexData } from "@/lib/painel-contas-externas";
import { AzSegmented, ChartCard, CockpitChip } from "@/components/painel/core";
import { AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct } from "@/lib/format-br";

type Lente = "produtos" | "parceiros";
const OPCOES = [
  { id: "produtos", label: "Produtos (NCM)" },
  { id: "parceiros", label: "Parceiros" },
];
const TOP = 10;

type Item = { label: string; valor: number };

function Ranking({ titulo, itens, total, cor }: { titulo: string; itens: Item[]; total: number; cor: string }) {
  const max = itens.reduce((m, i) => Math.max(m, i.valor), 0) || 1;
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <ol className="space-y-1">
        {itens.map((i, k) => (
          <li key={`${i.label}-${k}`} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
            <div className="min-w-0">
              <div className="truncate text-zinc-700" title={i.label}>
                {k + 1}. {i.label}
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-zinc-100">
                <div className="h-1.5 rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: cor }} />
              </div>
            </div>
            <div className="text-right tabular-nums">
              <span className="font-semibold text-[#132960]">{fmtNum(i.valor, 1)}</span>
              <span className="ml-1 text-[10px] text-zinc-400">{total > 0 ? fmtPct((i.valor / total) * 100, 0) : ""}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Card — composição do comércio (SECEX Comex Stat, janela curta do builder): top produtos e parceiros. */
export function ComposicaoComercioCard({ comex }: { comex: ContasExternasComexData }) {
  const [lente, setLente] = useState<Lente>("produtos");
  const exp: Item[] =
    lente === "produtos"
      ? comex.top_ncm_export_12m.slice(0, TOP).map((n) => ({ label: n.nome, valor: n.valor_us_bi }))
      : comex.top_destinos_12m.slice(0, TOP).map((p) => ({ label: p.pais, valor: p.valor_us_bi }));
  const imp: Item[] =
    lente === "produtos"
      ? comex.top_ncm_import_12m.slice(0, TOP).map((n) => ({ label: n.nome, valor: n.valor_us_bi }))
      : comex.top_origens_12m.slice(0, TOP).map((p) => ({ label: p.pais, valor: p.valor_us_bi }));
  // total de referência: soma das categorias (pauta inteira do payload), não só do top listado
  const totExp = comex.categorias_export_12m.reduce((a, c) => a + c.valor_us_bi, 0);
  const totImp = comex.categorias_import_12m.reduce((a, c) => a + c.valor_us_bi, 0);
  // A janela do ranking é curta (a API do Comex Stat estoura em NCM × 12m): o builder
  // grava 3 meses fechados sob a chave histórica `periodo_12m` — o rótulo vem das datas.
  const { from, to } = comex.periodo_12m;
  const nMeses = (parseInt(to.slice(0, 4), 10) - parseInt(from.slice(0, 4), 10)) * 12 + parseInt(to.slice(5, 7), 10) - parseInt(from.slice(5, 7), 10) + 1;
  const periodo = `${from} a ${to} (${nMeses} meses)`;

  return (
    <ChartCard
      id="composicao-comercio"
      title={lente === "produtos" ? "Pauta — top 10 produtos exportados e importados" : "Parceiros — top 10 destinos e origens"}
      subtitle={`SECEX/MDIC Comex Stat · ${periodo} · US$ bi FOB · % sobre a pauta das categorias do payload`}
      toolbar={<AzSegmented ariaLabel="Recorte" options={OPCOES} value={lente} onChange={(id) => setLente(id as Lente)} />}
      footer={
        <p>
          Composição aduaneira da SECEX (NCM e país), só para leitura da pauta. Os saldos e totais do painel vêm do BCB (BPM6),
          que difere da SECEX por conceito (mudança de propriedade × passagem na fronteira) — saldo Comex não é saldo de BP.
          Percentual sobre a soma das categorias publicadas no payload. A janela é a dos últimos meses fechados indicada no subtítulo (a API não entrega NCM × 12 meses).
        </p>
      }
      stampGiro={comex.gerado_em}
      stampDado={comex.periodo_12m.to}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom="navy">exportações (categorias) US$ {fmtNum(totExp, 1)} bi</CockpitChip>
        <CockpitChip tom="navy">importações (categorias) US$ {fmtNum(totImp, 1)} bi</CockpitChip>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Ranking titulo={lente === "produtos" ? "Exportações" : "Destinos"} itens={exp} total={totExp} cor={AZ_SERIES[3]} />
        <Ranking titulo={lente === "produtos" ? "Importações" : "Origens"} itens={imp} total={totImp} cor={AZ_SERIES[2]} />
      </div>
    </ChartCard>
  );
}
