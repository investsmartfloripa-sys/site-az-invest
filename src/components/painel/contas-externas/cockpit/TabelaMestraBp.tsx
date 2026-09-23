"use client";

import { useMemo, useState } from "react";

import type { BpMestre, BpRegistro } from "@/lib/painel-contas-externas";
import { ChartCard, CockpitChip } from "@/components/painel/core";
import { AZ_CHART, variationText } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum } from "@/lib/format-br";
import { BTN_CSV_CLASS, baixarCsv, fmtSinal, isoMes, mesmoMesAnoAnterior, pctPib, val } from "./cockpit-shared";

/**
 * TABELA MESTRA do balanço de pagamentos — o raio-X da divulgação mensal do
 * BCB (Estatísticas do Setor Externo), linha a linha do BPM6: mês, mesmo mês do
 * ano anterior, 12 meses, 12 meses um ano antes e % do PIB. Seletor de mês
 * (13 últimos). Linhas de nível 3–4 (instrumentos) colapsáveis.
 */
export function TabelaMestraBp({ bp, geradoEm }: { bp: BpMestre; geradoEm: string }) {
  const meses = useMemo(() => bp.mensal.map((r) => r.mes).slice(-13).reverse(), [bp.mensal]);
  const [mes, setMes] = useState<string>(meses[0] ?? "");
  const [detalhe, setDetalhe] = useState(false);

  const m = bp.mensal.find((r) => r.mes === mes);
  const mAnt = mesmoMesAnoAnterior(bp.mensal, mes);
  const a = bp.acum_12m.find((r) => r.mes === mes);
  const aAnt = mesmoMesAnoAnterior(bp.acum_12m, mes);
  const linhas = bp.linhas.filter((l) => detalhe || l.nivel <= 2);

  const csv = () => {
    const header = ["linha", "sgs", "mes_usd_mi", "mes_ano_anterior_usd_mi", "acum_12m_usd_bi", "acum_12m_ano_anterior_usd_bi", "pct_pib_12m"];
    const rows = bp.linhas.map((l) => [
      l.label,
      l.sgs,
      val(m, l.key),
      val(mAnt, l.key),
      val(a, l.key),
      val(aAnt, l.key),
      pctPib(a, l.key) != null ? +(pctPib(a, l.key) as number).toFixed(3) : null,
    ]);
    baixarCsv(`bp-tabela-mestra-${mes.slice(0, 7)}.csv`, header, rows);
  };

  const ident = bp.identidade;

  return (
    <ChartCard
      id="tabela-mestra"
      title="Balanço de pagamentos — tabela mestra (BPM6)"
      subtitle="BCB/SGS 22701–23060 · mês e 12 meses vs um ano antes · US$ bi · % do PIB 12m (4192)"
      toolbar={
        <>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            Mês
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="rounded-lg border border-[#132960]/20 bg-white px-2 py-1 text-xs font-semibold text-[#132960]"
            >
              {meses.map((x) => (
                <option key={x} value={x}>
                  {fmtMesCurto(isoMes(x))}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setDetalhe((d) => !d)} className={BTN_CSV_CLASS}>
            {detalhe ? "Ocultar instrumentos" : "Mostrar instrumentos"}
          </button>
          <button type="button" onClick={csv} className={BTN_CSV_CLASS}>
            CSV
          </button>
        </>
      }
      footer={
        <div className="space-y-1.5">
          <p>
            <b>Convenção BPM6.</b> Transações correntes e conta capital: saldo = receitas − despesas. Conta financeira
            (e investimento direto, carteira, derivativos, outros investimentos): líquido = ativos − passivos, logo
            NEGATIVO = entrada líquida de recursos externos. IDP e passivos de carteira/outros investimentos: positivo =
            entrada de não residentes. IDE e ativos: positivo = saída de residentes.
          </p>
          <p>
            <b>Identidade.</b> TC + conta capital − conta financeira + erros e omissões = 0 (auditada no builder: {ident.meses_ok}{" "}
            meses fecham com tolerância de US$ {fmtNum(ident.tolerancia_usd_mi, 0)} mi; {ident.violacoes} violação(ões)). A
            conta financeira também é auditada contra a soma das cinco funções.
          </p>
          <p>
            <b>Derivadas.</b> Importações = exportações (22711) − saldo de bens (22707); juros e demais rendas = renda
            primária (22800) − lucros e dividendos (22812) − lucros reinvestidos (22815). O mês bruto carrega a
            sazonalidade (soja no 1º semestre, remessas no fim do ano) — compare-o sempre com o mesmo mês do ano
            anterior; a leitura de tendência é a coluna de 12 meses.
          </p>
        </div>
      }
      stampGiro={geradoEm}
      stampDado={mes.slice(0, 7)}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={ident.violacoes === 0 ? "pos" : "neg"}>
          identidade BP {ident.violacoes === 0 ? "fecha" : `${ident.violacoes} violação(ões)`} · {ident.meses_ok} meses
        </CockpitChip>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs tabular-nums">
          <thead>
            <tr className="border-b border-zinc-200 text-right text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="py-1.5 pr-2 text-left font-semibold">Linha (SGS)</th>
              <th className="py-1.5 pl-2 font-semibold">{mes ? fmtMesCurto(isoMes(mes)) : "Mês"}</th>
              <th className="py-1.5 pl-2 font-semibold">{mAnt ? fmtMesCurto(isoMes(mAnt.mes)) : "a/a"}</th>
              <th className="py-1.5 pl-2 font-semibold">Δ mês</th>
              <th className="border-l border-zinc-100 py-1.5 pl-3 font-semibold">12m</th>
              <th className="py-1.5 pl-2 font-semibold">12m ano ant.</th>
              <th className="py-1.5 pl-2 font-semibold">Δ 12m</th>
              <th className="border-l border-zinc-100 py-1.5 pl-3 font-semibold">% PIB</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <Linha key={l.key} k={l.key} label={l.label} nivel={l.nivel} sgs={l.sgs} m={m} mAnt={mAnt} a={a} aAnt={aAnt} />
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function Linha({
  k,
  label,
  nivel,
  sgs,
  m,
  mAnt,
  a,
  aAnt,
}: {
  k: string;
  label: string;
  nivel: number;
  sgs: number | null;
  m?: BpRegistro;
  mAnt?: BpRegistro;
  a?: BpRegistro;
  aAnt?: BpRegistro;
}) {
  const vm = val(m, k);
  const vma = val(mAnt, k);
  const va = val(a, k);
  const vaa = val(aAnt, k);
  const dm = vm != null && vma != null ? (vm - vma) / 1000 : null;
  const da = va != null && vaa != null ? va - vaa : null;
  const pib = pctPib(a, k);
  const topo = nivel === 0;
  return (
    <tr className={`border-b border-zinc-100 ${topo ? "bg-[#132960]/[0.03]" : ""}`}>
      <td className={`py-1.5 pr-2 ${topo ? "font-bold text-[#132960]" : "text-zinc-700"}`} style={{ paddingLeft: `${nivel * 14}px` }}>
        {label}
        <span className="ml-1 text-[10px] font-normal text-zinc-400">{sgs ?? "calc."}</span>
      </td>
      <td className={`py-1.5 pl-2 text-right ${topo ? "font-bold text-[#132960]" : ""}`}>{vm != null ? fmtSinal(vm / 1000, 2) : "—"}</td>
      <td className="py-1.5 pl-2 text-right text-zinc-500">{vma != null ? fmtSinal(vma / 1000, 2) : "—"}</td>
      <td className="py-1.5 pl-2 text-right font-semibold" style={{ color: dm != null ? variationText(dm) : AZ_CHART.ticks }}>
        {fmtSinal(dm, 2)}
      </td>
      <td className={`border-l border-zinc-100 py-1.5 pl-3 text-right ${topo ? "font-bold text-[#132960]" : ""}`}>{fmtSinal(va, 1)}</td>
      <td className="py-1.5 pl-2 text-right text-zinc-500">{fmtSinal(vaa, 1)}</td>
      <td className="py-1.5 pl-2 text-right font-semibold" style={{ color: da != null ? variationText(da) : AZ_CHART.ticks }}>
        {fmtSinal(da, 1)}
      </td>
      <td className="border-l border-zinc-100 py-1.5 pl-3 text-right text-zinc-600">{pib != null ? fmtSinal(pib, 2) : "—"}</td>
    </tr>
  );
}
