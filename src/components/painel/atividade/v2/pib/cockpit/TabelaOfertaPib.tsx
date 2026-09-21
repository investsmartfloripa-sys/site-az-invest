"use client";

import { useMemo } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, CockpitChip, isDarkBg, steppedDivergingScale, tomPorSinal } from "@/components/painel/core";
import { variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, fmtTrimCurto } from "../../shared";
import { BTN_CSV_CLASS, RECORTES_OFERTA, blocoDoPib, difusao, rotuloRecorte, valorNoTrim } from "../cockpit-shared";

/**
 * COCKPIT · Tabela mestra da oferta — snapshot do trimestre SELECIONADO (controlado
 * pelo pai): 17 recortes da SCN × nível (índice SA 1621, R$ bi SA 6613), as 4
 * variações da 5932 (QoQ SA, YoY, acum. 4T, acum. ano) com FUNDO DE CALOR por
 * degraus, peso % do PIB nominal (1846) com mini-barra e Δ peso vs t−4 em p.p.
 * Absorve o antigo HeatmapSetorialPib (cor) e o PesoSetorialPib (Δ peso).
 * Tudo lido do JSON; a única derivada é peso(t) − peso(t−4).
 */

/** Degraus das escalas de calor (limites positivos, espelhados p/ o negativo). */
const DEGRAUS_QOQ = [0.3, 1, 3];
const DEGRAUS_OUTRAS = [0.5, 2, 5];

/** Fator R$ milhões (JSON) → R$ bilhões (tabela). */
const MI_PARA_BI = 1000;

/** "2026-T02" − n trimestres → "2025-T02" (n = 4). Devolve a entrada se não casar. */
function trimMenos(trim: string, n: number): string {
  const m = trim.match(/^(\d{4})-T(\d{1,2})$/);
  if (!m) return trim;
  const total = parseInt(m[1], 10) * 4 + (parseInt(m[2], 10) - 1) - n;
  const ano = Math.floor(total / 4);
  const q = total - ano * 4 + 1;
  return `${ano}-T${String(q).padStart(2, "0")}`;
}

type LinhaOferta = {
  key: string;
  rotulo: string;
  agregado: boolean;
  folha: boolean;
  idxSa: number | null;
  /** R$ bilhões SA a preços de 1995 (já ÷1000). */
  reaisBi: number | null;
  qoq: number | null;
  yoy: number | null;
  acum4t: number | null;
  acumAno: number | null;
  peso: number | null;
  /** peso(trimSel) − peso(trimSel − 4T), em p.p. */
  dPeso: number | null;
};

const TD_BASE = "py-1 px-2 text-right whitespace-nowrap";

/** Célula de nível (índice / R$ bi): nulo estrutural vira "—" apagado, como nas demais colunas. */
function CelulaNivel({ valor, dec }: { valor: number | null; dec: number }) {
  if (valor == null) {
    return (
      <td className={`${TD_BASE} text-zinc-400`} title="não publicado">
        —
      </td>
    );
  }
  return <td className={TD_BASE}>{fmtNum(valor, dec)}</td>;
}

/** Célula de variação com fundo de calor (degraus) e texto com contraste automático. */
function CelulaCalor({ valor, escala, titulo }: { valor: number | null; escala: (v: number) => string; titulo: string }) {
  if (valor == null) {
    return (
      <td className={`${TD_BASE} text-zinc-400`} title={`${titulo}: não publicado`}>
        —
      </td>
    );
  }
  const bg = escala(valor);
  const escuro = isDarkBg(bg);
  return (
    <td
      className={`${TD_BASE} font-semibold ${escuro ? "text-white" : "text-zinc-900"}`}
      style={{ background: bg }}
      title={`${titulo}: ${fmtSignedPct(valor, 1)}`}
    >
      {fmtSignedPct(valor, 1)}
    </td>
  );
}

export function TabelaOfertaPib({
  pib,
  geradoEm,
  trimSel,
  onTrimSel,
}: {
  pib: AtividadePibData;
  /** Aceito por simetria com os demais cards do cockpit; a tabela não tem eixo de tempo. */
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
  /** Trimestre cru ("2026-T02") controlado pelo pai. */
  trimSel: string;
  onTrimSel: (t: string) => void;
}) {
  const variacaoRows = pib.variacao.serie;
  const indiceRows = useMemo(() => blocoDoPib(pib, "indice_volume"), [pib]);
  const reaisRows = useMemo(() => blocoDoPib(pib, "valores_reais_sa"), [pib]);
  const estruturaRows = useMemo(() => blocoDoPib(pib, "estrutura_nominal"), [pib]);
  const trimAnt = trimMenos(trimSel, 4);

  // Opções do seletor: os 4 últimos trimestres da 5932 (id = trim cru, label "2T26").
  const opcoesTrim = useMemo(
    () => variacaoRows.slice(-4).map((r) => ({ id: String(r.trim), label: fmtTrimCurto(String(r.trim)) })),
    [variacaoRows],
  );

  const linhas = useMemo<LinhaOferta[]>(
    () =>
      RECORTES_OFERTA.map((r) => {
        const k = r.key;
        const reaisMi = valorNoTrim(reaisRows, trimSel, k);
        const peso = valorNoTrim(estruturaRows, trimSel, `${k}_pct_pib`);
        const pesoAnt = valorNoTrim(estruturaRows, trimAnt, `${k}_pct_pib`);
        return {
          key: k,
          rotulo: rotuloRecorte(pib, k),
          agregado: !!r.agregado,
          folha: !!r.folha,
          idxSa: valorNoTrim(indiceRows, trimSel, `sa_${k}`),
          reaisBi: reaisMi != null ? +(reaisMi / MI_PARA_BI).toFixed(3) : null,
          qoq: valorNoTrim(variacaoRows, trimSel, `qoq_sa_${k}`),
          yoy: valorNoTrim(variacaoRows, trimSel, `yoy_${k}`),
          acum4t: valorNoTrim(variacaoRows, trimSel, `acum_4t_${k}`),
          acumAno: valorNoTrim(variacaoRows, trimSel, `acum_ano_${k}`),
          peso,
          dPeso: peso != null && pesoAnt != null ? +(peso - pesoAnt).toFixed(2) : null,
        };
      }),
    [pib, variacaoRows, indiceRows, reaisRows, estruturaRows, trimSel, trimAnt],
  );

  const escalaQoq = useMemo(() => steppedDivergingScale(DEGRAUS_QOQ), []);
  const escalaOutras = useMemo(() => steppedDivergingScale(DEGRAUS_OUTRAS), []);

  // Difusão das 12 atividades-folha (agregados fora) no trimestre selecionado.
  const folhas = linhas.filter((l) => l.folha);
  const difQoq = difusao(folhas.map((l) => l.qoq));
  const difYoy = difusao(folhas.map((l) => l.yoy));
  const pibLinha = linhas.find((l) => l.key === "pib");

  const baixar = () => {
    baixarCsv(
      `pib-tabela-oferta-${trimSel}.csv`,
      [
        "recorte",
        "trimestre",
        "indice_volume_sa_base1995",
        "valor_real_sa_rs_bi_precos1995",
        "qoq_sa_pct",
        "yoy_pct",
        "acum_4t_pct",
        "acum_ano_pct",
        "peso_pct_pib_nominal",
        "delta_peso_4t_pp",
      ],
      linhas.map((l) => [l.rotulo, trimSel, l.idxSa, l.reaisBi, l.qoq, l.yoy, l.acum4t, l.acumAno, l.peso, l.dPeso]),
    );
  };

  const th = "py-2 px-2 text-right font-semibold whitespace-nowrap";

  return (
    <ChartCard
      id="pib-tabela-oferta"
      title={`Tabela mestra da oferta · ${fmtTrimCurto(trimSel)}`}
      subtitle="SIDRA 1621 / 6613 / 5932 / 1846 · 17 recortes × índice SA (1995 = 100) · R$ bi SA a preços de 1995 · QoQ SA · YoY · acum. 4T · acum. ano · peso % PIB nominal e Δ peso vs t−4 (p.p.)"
      toolbar={
        <>
          {opcoesTrim.length > 1 ? (
            <AzSegmented ariaLabel="Trimestre da tabela" options={opcoesTrim} value={trimSel} onChange={onTrimSel} />
          ) : null}
          <button type="button" onClick={baixar} className={BTN_CSV_CLASS}>
            Baixar CSV
          </button>
        </>
      }
      footer={
        // O popover do (?) vive dentro do <h2>: só elementos de frase (span), sem <p>/<div>.
        <span className="block space-y-1.5">
          <span className="block">
            <strong>Fonte:</strong> IBGE/SIDRA — Contas Nacionais Trimestrais. Índice de volume com ajuste sazonal, média
            1995 = 100 (tabela 1621). Valor encadeado a preços de 1995 com ajuste sazonal, em R$ bilhões (6613, publicada em
            R$ milhões; a tabela divide por 1.000). Variações reais em % (5932): QoQ SA = vs trimestre anterior, com
            ajuste sazonal; YoY = vs mesmo trimestre do ano anterior; acum. 4T = últimos 4 trimestres vs 4 anteriores;
            acum. ano = do 1T até o trimestre selecionado vs mesmo período do ano anterior. Peso = participação no PIB
            nominal a preços correntes (1846); Δ peso = peso no trimestre selecionado menos o peso 4 trimestres antes (
            {fmtTrimCurto(trimAnt)}), em pontos percentuais, com 2 casas porque a 1846 publica 2 casas.
          </span>
          <span className="block">
            <strong>Linhas em realce</strong> são agregados: Indústria e Serviços totalizam seus subsetores; Valor
            adicionado + Impostos = PIB. Não some agregado com componente.
          </span>
          <span className="block">
            <strong>Fundo de calor:</strong> escala divergente por degraus, verde = subiu, vermelho = caiu (direção literal
            do número); QoQ SA usa degraus ±0,3 / 1 / 3 p.p. e as demais ±0,5 / 2 / 5 p.p.; fundo claro = dentro do
            primeiro degrau. <strong>Difusão</strong> (chip) = contagem das 12 atividades-folha (agregados fora) que
            subiram / ficaram estáveis (|v| ≤ 0,05 p.p.) / caíram.
          </span>
          <span className="block">
            <strong>Nulos (&ldquo;—&rdquo;):</strong> Impostos líquidos sobre produtos não têm índice SA, R$ SA nem QoQ SA
            — a 1621, a 6613 e a 5932 (v6564) não publicam este recorte com ajuste sazonal. PIB não tem peso nem Δ peso
            porque é o denominador (100% por construção; a 1846 não publica a linha). Um trimestre fora da cobertura de
            uma tabela também mostra &ldquo;—&rdquo;.
          </span>
        </span>
      }
      stampGiro={geradoEm}
      stampDado={trimSel}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {pibLinha ? (
          <CockpitChip tom={tomPorSinal(pibLinha.qoq)} title="PIB no trimestre selecionado (5932)">
            {fmtTrimCurto(trimSel)} · PIB {fmtSignedPct(pibLinha.qoq, 1)} t/t · {fmtSignedPct(pibLinha.yoy, 1)} a/a
          </CockpitChip>
        ) : null}
        <CockpitChip tom="navy" title="Difusão das 12 atividades-folha: sobe / estável (|v| ≤ 0,05 p.p.) / cai">
          QoQ {difQoq.sobe}↑ {difQoq.estavel}= {difQoq.cai}↓ · YoY {difYoy.sobe}↑ {difYoy.estavel}= {difYoy.cai}↓
        </CockpitChip>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[11px] tabular-nums">
          <thead>
            <tr className="border-b border-[#132960]/15 text-[10px] uppercase tracking-wide text-zinc-500">
              <th scope="col" className="sticky left-0 z-[1] bg-white py-2 pl-1 pr-2 text-left font-semibold">
                Recorte
              </th>
              <th scope="col" className={th}>
                Índice SA
              </th>
              <th scope="col" className={th}>
                R$ bi SA
              </th>
              <th scope="col" className={th}>
                QoQ SA
              </th>
              <th scope="col" className={th}>
                YoY
              </th>
              <th scope="col" className={th}>
                Acum. 4T
              </th>
              <th scope="col" className={th}>
                Acum. ano
              </th>
              <th scope="col" className={th}>
                Peso % PIB
              </th>
              <th scope="col" className={`${th} pr-1`}>
                Δ peso 4T (p.p.)
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.key}
                className={`border-b border-zinc-100 last:border-0 ${
                  l.agregado ? "bg-[#132960]/[0.035] font-semibold text-[#132960]" : "text-zinc-700"
                }`}
              >
                {/* Sticky + opaco p/ cobrir o conteúdo rolado; agregados repetem o tom da linha via sombra interna (navy 3,5%). */}
                <th
                  scope="row"
                  className={`sticky left-0 z-[1] whitespace-nowrap bg-white py-1 pl-1 pr-2 text-left ${
                    l.agregado ? "font-semibold text-[#132960] shadow-[inset_0_0_0_9999px_rgba(19,41,96,0.035)]" : "font-medium text-[#132960]"
                  }`}
                >
                  {l.rotulo}
                </th>
                <CelulaNivel valor={l.idxSa} dec={1} />
                <CelulaNivel valor={l.reaisBi} dec={1} />
                <CelulaCalor valor={l.qoq} escala={escalaQoq} titulo={`${l.rotulo} · QoQ SA ${fmtTrimCurto(trimSel)}`} />
                <CelulaCalor valor={l.yoy} escala={escalaOutras} titulo={`${l.rotulo} · YoY ${fmtTrimCurto(trimSel)}`} />
                <CelulaCalor valor={l.acum4t} escala={escalaOutras} titulo={`${l.rotulo} · acum. 4T ${fmtTrimCurto(trimSel)}`} />
                <CelulaCalor valor={l.acumAno} escala={escalaOutras} titulo={`${l.rotulo} · acum. ano ${fmtTrimCurto(trimSel)}`} />
                <td className={`${TD_BASE} relative`}>
                  {l.peso == null ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <>
                      {/* Mini-barra de fundo proporcional ao peso (0–100% da célula). */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-1 left-0 rounded-sm bg-[#132960]/10"
                        style={{ width: `${Math.max(0, Math.min(100, l.peso))}%` }}
                      />
                      <span className="relative">{fmtPct(l.peso, 1)}</span>
                    </>
                  )}
                </td>
                <td className={`${TD_BASE} pr-1`}>
                  {l.dPeso == null ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <span className="font-semibold" style={{ color: variationText(l.dPeso, 0.05) }}>
                      {fmtSignedNum(l.dPeso, 2)} p.p.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-zinc-500">
        <span aria-hidden className="inline-flex items-center gap-px">
          {[-6, -3, -1, 0, 1, 3, 6].map((v) => (
            <span key={v} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: escalaOutras(v) }} />
          ))}
        </span>
        <span>fundo = intensidade da variação (degraus ±0,3 / 1 / 3 p.p. no QoQ; ±0,5 / 2 / 5 nas demais)</span>
      </p>
    </ChartCard>
  );
}
