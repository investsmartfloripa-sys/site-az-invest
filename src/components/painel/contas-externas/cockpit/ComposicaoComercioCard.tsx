"use client";

import { useState } from "react";

import type { ContasExternasComexData } from "@/lib/painel-contas-externas";
import { ChartCard, CockpitChip } from "@/components/painel/core";
import { SegmentedRolavel } from "@/components/painel/contas-externas/SegmentedRolavel";
import { AZ_SERIES } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";

type Lente = "produtos" | "parceiros";
const OPCOES = [
  { id: "produtos", label: "Produtos (NCM)" },
  { id: "parceiros", label: "Parceiros" },
];
const TOP = 10;

type Item = { label: string; valor: number; completo?: string };

// Nomes curtos para as posições NCM mais comuns na pauta (4 primeiros dígitos; 6 quando a posição
// mistura produtos). A descrição oficial, longa, vai para o tooltip (revisão 12/11/2026).
const NOME_NCM: Record<string, string> = {
  "0201": "Carne bovina fresca",
  "0202": "Carne bovina congelada",
  "0203": "Carne suína",
  "0207": "Carne de frango",
  "0901": "Café",
  "1005": "Milho",
  "1201": "Soja",
  "1507": "Óleo de soja",
  "1701": "Açúcar",
  "2207": "Etanol",
  "2304": "Farelo de soja",
  "2401": "Fumo",
  "2601": "Minério de ferro",
  "2603": "Minério de cobre",
  "2701": "Carvão",
  "2709": "Petróleo bruto",
  "2710": "Óleos combustíveis",
  "2711": "Gás natural",
  "3002": "Vacinas e hemoderivados",
  "3004": "Medicamentos",
  "310210": "Ureia",
  "3102": "Adubos nitrogenados",
  "3104": "Adubos potássicos",
  "3105": "Adubos NPK",
  "3808": "Defensivos agrícolas",
  "4703": "Celulose",
  "5201": "Algodão",
  "7108": "Ouro",
  "7202": "Ferroligas",
  "7207": "Semiacabados de aço",
  "8411": "Turbinas e turborreatores",
  "8471": "Computadores",
  "8517": "Telefones e celulares",
  "8542": "Circuitos integrados",
  "8703": "Automóveis",
  "8704": "Caminhões",
  "8708": "Autopeças",
  "8802": "Aviões",
  "8803": "Partes de aviões",
};

/** Nome curto do produto: dicionário pelo código NCM; sem entrada, o trecho antes da primeira vírgula. */
function nomeCurtoNcm(ncm: string, nome: string): string {
  const cod = ncm.replace(/\D/g, "");
  const curto = NOME_NCM[cod.slice(0, 6)] ?? NOME_NCM[cod.slice(0, 4)];
  if (curto) return curto;
  const trecho = nome.split(/[,;(]/)[0].trim();
  return trecho.length > 0 ? trecho : nome;
}

function Ranking({ titulo, itens, total, cor }: { titulo: string; itens: Item[]; total: number; cor: string }) {
  const max = itens.reduce((m, i) => Math.max(m, i.valor), 0) || 1;
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <ol className="space-y-1">
        {itens.map((i, k) => (
          <li key={`${i.label}-${k}`} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
            <div className="min-w-0">
              <div className="truncate text-zinc-700" title={i.completo ?? i.label}>
                {k + 1}. {i.label}
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-zinc-100">
                <div className="h-1.5 rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: cor }} />
              </div>
            </div>
            <div className="text-right tabular-nums">
              <span className="font-semibold text-[#132960]">{fmtNum(i.valor, 1)}</span>
              <span className="ml-1 text-[10px] text-zinc-500">{total > 0 ? fmtPct((i.valor / total) * 100, 0) : ""}</span>
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
      ? comex.top_ncm_export_12m.slice(0, TOP).map((n) => ({ label: nomeCurtoNcm(n.ncm, n.nome), valor: n.valor_us_bi, completo: n.nome }))
      : comex.top_destinos_12m.slice(0, TOP).map((p) => ({ label: p.pais, valor: p.valor_us_bi }));
  const imp: Item[] =
    lente === "produtos"
      ? comex.top_ncm_import_12m.slice(0, TOP).map((n) => ({ label: nomeCurtoNcm(n.ncm, n.nome), valor: n.valor_us_bi, completo: n.nome }))
      : comex.top_origens_12m.slice(0, TOP).map((p) => ({ label: p.pais, valor: p.valor_us_bi }));
  // total de referência: soma das categorias (pauta inteira do payload), não só do top listado
  const totExp = comex.categorias_export_12m.reduce((a, c) => a + c.valor_us_bi, 0);
  const totImp = comex.categorias_import_12m.reduce((a, c) => a + c.valor_us_bi, 0);
  // A janela do ranking é curta (a API do Comex Stat estoura em NCM × 12m): o builder
  // grava 3 meses fechados sob a chave histórica `periodo_12m` — o rótulo vem das datas.
  const { from, to } = comex.periodo_12m;
  const nMeses = (parseInt(to.slice(0, 4), 10) - parseInt(from.slice(0, 4), 10)) * 12 + parseInt(to.slice(5, 7), 10) - parseInt(from.slice(5, 7), 10) + 1;
  const periodo = `${fmtMesCurto(from)} a ${fmtMesCurto(to)} (${nMeses} meses)`;

  return (
    <ChartCard
      id="composicao-comercio"
      title={lente === "produtos" ? "Pauta — top 10 produtos exportados e importados" : "Parceiros — top 10 destinos e origens"}
      subtitle={`SECEX/MDIC Comex Stat · ${periodo} · US$ bi FOB · % sobre a pauta das categorias do payload`}
      toolbar={<SegmentedRolavel ariaLabel="Recorte" options={OPCOES} value={lente} onChange={(id) => setLente(id as Lente)} />}
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
