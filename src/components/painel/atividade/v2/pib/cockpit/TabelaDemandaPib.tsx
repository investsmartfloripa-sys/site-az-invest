"use client";

import { useMemo } from "react";

import type { AtividadePibData } from "@/lib/painel-atividade";
import { ChartCard, CockpitChip, isDarkBg, steppedDivergingScale, tomPorSinal } from "@/components/painel/core";
import { variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, fmtTrimCurto } from "../../shared";
import { BTN_CSV_CLASS, RECORTES_DEMANDA, ROTULO_CURTO, blocoDoPib, rotuloRecorte, valorNoTrim } from "../cockpit-shared";

/**
 * COCKPIT · Tabela mestra da demanda — snapshot do trimestre SELECIONADO (vem do
 * pai, mesmo seletor da tabela da oferta): 6 componentes da SCN + linha PIB
 * (régua) + linha memo do saldo externo (X − M). Colunas iguais às da oferta:
 * índice SA (1621), R$ bi SA (6613), QoQ SA / YoY / acum. 4T / acum. ano (5932)
 * com fundo de calor por degraus, peso % PIB nominal (1846) com mini-barra e
 * Δ peso vs t−4 em p.p. Absorve o EstruturaDemandaPib (mini-barra de peso) e a
 * linha-memo do AberturaComercialPib (saldo X − M nominal e real).
 */

/** Degraus das escalas de calor (limites positivos, espelhados p/ o negativo) — iguais à tabela da oferta. */
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

type LinhaDemanda = {
  key: string;
  /** Rótulo completo (labels do JSON) — CSV e title. */
  rotulo: string;
  /** Rótulo curto p/ a coluna fixa (card de meia largura). */
  rotuloCurto: string;
  /** "componente" = 6 recortes da SCN; "pib" = régua (realce); "memo" = saldo X − M (itálico). */
  tipo: "componente" | "pib" | "memo";
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
  /** Importações: entram subtraindo na identidade (marcador "(−)" na 1ª coluna). */
  vazamento?: boolean;
};

const TD_BASE = "py-1 px-2 text-right whitespace-nowrap";

/** Célula de variação com fundo de calor (degraus) e texto com contraste automático. */
function CelulaCalor({
  valor,
  escala,
  titulo,
  memo,
}: {
  valor: number | null;
  escala: (v: number) => string;
  titulo: string;
  memo?: boolean;
}) {
  if (valor == null) {
    return (
      <td className={`${TD_BASE} text-zinc-400`} title={`${titulo}: ${memo ? "não se aplica" : "não publicado"}`}>
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

export function TabelaDemandaPib({
  pib,
  geradoEm,
  trimSel,
}: {
  pib: AtividadePibData;
  geradoEm: string;
  /** Trimestre cru ("2026-T02") controlado pelo pai — compartilhado com a tabela da oferta. */
  trimSel: string;
}) {
  const trim = trimSel || pib.trim_recente;
  const trimAnt = trimMenos(trim, 4);

  const variacaoRows = pib.variacao.serie;
  const indiceRows = useMemo(() => blocoDoPib(pib, "indice_volume"), [pib]);
  const reaisRows = useMemo(() => blocoDoPib(pib, "valores_reais_sa"), [pib]);
  const estruturaRows = useMemo(() => blocoDoPib(pib, "estrutura_nominal"), [pib]);

  const linhas = useMemo<LinhaDemanda[]>(() => {
    const reaisBi = (k: string): number | null => {
      const mi = valorNoTrim(reaisRows, trim, k);
      return mi != null ? +(mi / MI_PARA_BI).toFixed(3) : null;
    };
    const peso = (k: string, t: string): number | null => valorNoTrim(estruturaRows, t, `${k}_pct_pib`);

    const montar = (k: string, tipo: LinhaDemanda["tipo"]): LinhaDemanda => {
      const p = peso(k, trim);
      const pAnt = peso(k, trimAnt);
      return {
        key: k,
        rotulo: rotuloRecorte(pib, k),
        rotuloCurto: ROTULO_CURTO[k] ?? rotuloRecorte(pib, k),
        tipo,
        idxSa: valorNoTrim(indiceRows, trim, `sa_${k}`),
        reaisBi: reaisBi(k),
        qoq: valorNoTrim(variacaoRows, trim, `qoq_sa_${k}`),
        yoy: valorNoTrim(variacaoRows, trim, `yoy_${k}`),
        acum4t: valorNoTrim(variacaoRows, trim, `acum_4t_${k}`),
        acumAno: valorNoTrim(variacaoRows, trim, `acum_ano_${k}`),
        peso: p,
        dPeso: p != null && pAnt != null ? +(p - pAnt).toFixed(2) : null,
        vazamento: k === "importacoes",
      };
    };

    // Linha memo: saldo externo X − M. % PIB = exp − imp (1846); R$ bi SA = X − M (6613). Demais colunas "—".
    const xPct = peso("exportacoes", trim);
    const mPct = peso("importacoes", trim);
    const xBi = reaisBi("exportacoes");
    const mBi = reaisBi("importacoes");
    const memo: LinhaDemanda = {
      key: "saldo_externo",
      rotulo: "Saldo externo X − M",
      rotuloCurto: "Saldo externo X − M",
      tipo: "memo",
      idxSa: null,
      reaisBi: xBi != null && mBi != null ? +(xBi - mBi).toFixed(3) : null,
      qoq: null,
      yoy: null,
      acum4t: null,
      acumAno: null,
      peso: xPct != null && mPct != null ? +(xPct - mPct).toFixed(2) : null,
      dPeso: null,
    };

    return [...RECORTES_DEMANDA.map((r) => montar(r.key, "componente")), montar("pib", "pib"), memo];
  }, [pib, variacaoRows, indiceRows, reaisRows, estruturaRows, trim, trimAnt]);

  const escalaQoq = useMemo(() => steppedDivergingScale(DEGRAUS_QOQ), []);
  const escalaOutras = useMemo(() => steppedDivergingScale(DEGRAUS_OUTRAS), []);

  const memoLinha = linhas.find((l) => l.key === "saldo_externo");
  const impLinha = linhas.find((l) => l.key === "importacoes");
  const saldoPct = memoLinha?.peso ?? null;
  const impYoy = impLinha?.yoy ?? null;

  const baixar = () => {
    baixarCsv(
      `pib-tabela-demanda-${trim}.csv`,
      [
        "componente",
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
      linhas.map((l) => [l.rotulo, trim, l.idxSa, l.reaisBi, l.qoq, l.yoy, l.acum4t, l.acumAno, l.peso, l.dPeso]),
    );
  };

  const th = "py-2 px-2 text-right font-semibold whitespace-nowrap";

  return (
    <ChartCard
      id="pib-tabela-demanda"
      title={`Tabela mestra da demanda · ${fmtTrimCurto(trim)}`}
      subtitle="SIDRA 1621 / 6613 / 5932 / 1846 · 6 componentes + PIB × índice SA · R$ bi SA · QoQ SA · YoY · acum. 4T · acum. ano · peso % PIB nominal · linha memo X − M"
      toolbar={
        <button type="button" onClick={baixar} className={BTN_CSV_CLASS}>
          Baixar CSV
        </button>
      }
      footer={
        // O popover do (?) vive dentro do <h2>: só elementos de frase (span), sem <p>/<div>.
        <span className="block space-y-1.5">
          <span className="block">
            <strong>Identidade da demanda:</strong> PIB = C (consumo das famílias) + G (consumo do governo) + FBCF
            (formação bruta de capital fixo) + Δestoques + X − M (exportações − importações). Importações entram
            subtraindo: só o saldo externo (X − M) soma ao PIB. A linha &quot;(−)&quot; marca esse sinal.
          </span>
          <span className="block">
            <strong>Cor = direção literal do número</strong> (verde subiu, vermelho caiu, sem julgamento). Alta de
            importações sai verde; a leitura invertida (alta = mais vazamento da demanda interna) está na identidade,
            não na cor.
          </span>
          <span className="block">
            <strong>Linha memo (saldo X − M):</strong> saldo nominal em % do PIB = exportações − importações a preços
            correntes (1846); saldo real em R$ bi = X − M a preços de 1995, com ajuste sazonal (6613). Os dois podem ter
            sinais opostos por preços relativos: câmbio e termos de troca movem o nominal sem mover o volume. As demais
            colunas não se aplicam a um saldo (a 5932 não publica taxa do saldo).
          </span>
          <span className="block">
            <strong>Nulos (&quot;—&quot;):</strong> a 1621 (índice SA) e a 6613 (R$ SA) não publicam variação de estoque, e
            a 5932 não publica suas taxas — estoques só existem em peso nominal (1846). PIB não tem peso nem Δ peso porque
            é o denominador (100% por construção; a 1846 não publica a linha). Um trimestre fora da cobertura de uma
            tabela também mostra &quot;—&quot;.
          </span>
          <span className="block">
            <strong>Colunas:</strong> índice SA = volume com ajuste sazonal, média 1995 = 100 (1621); R$ bi SA = valor
            encadeado a preços de 1995 com ajuste sazonal (6613, publicada em R$ milhões; a tabela divide por 1.000);
            QoQ SA = vs trimestre anterior, com ajuste sazonal; YoY = vs mesmo trimestre do ano anterior; acum. 4T =
            últimos 4 trimestres vs 4 anteriores; acum. ano = do 1T até o trimestre selecionado vs mesmo período do ano
            anterior (5932). Peso = participação no PIB nominal (1846), mini-barra = % da célula; Δ peso = peso no
            trimestre selecionado menos o peso 4 trimestres antes ({fmtTrimCurto(trimAnt)}), em p.p., CALCULADO.
          </span>
          <span className="block">
            <strong>Fundo de calor:</strong> escala divergente por degraus; QoQ SA usa ±0,3 / 1 / 3 p.p. e as demais
            ±0,5 / 2 / 5 p.p.; fundo claro = dentro do primeiro degrau. Fonte: IBGE/SIDRA — Contas Nacionais Trimestrais.
          </span>
        </span>
      }
      stampGiro={geradoEm}
      stampDado={trim}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip
          tom={tomPorSinal(saldoPct)}
          title="Saldo externo nominal = exportações − importações, em % do PIB a preços correntes (1846)"
        >
          saldo X − M {saldoPct == null ? "—" : `${fmtSignedNum(saldoPct, 1)}% do PIB`} ({fmtTrimCurto(trim)})
        </CockpitChip>
        <CockpitChip tom={tomPorSinal(impYoy)} title="Importações, variação real vs mesmo trimestre do ano anterior (5932)">
          importações {impYoy == null ? "—" : `${fmtSignedPct(impYoy, 1)} YoY`} ({fmtTrimCurto(trim)}) · alta = mais vazamento
        </CockpitChip>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[11px] tabular-nums">
          <thead>
            <tr className="border-b border-[#132960]/15 text-[10px] uppercase tracking-wide text-zinc-500">
              <th scope="col" className="sticky left-0 z-[1] bg-white py-2 pl-1 pr-2 text-left font-semibold">
                Componente
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
            {linhas.map((l) => {
              const ehPib = l.tipo === "pib";
              const ehMemo = l.tipo === "memo";
              const rotuloCol = `${l.rotulo} · ${fmtTrimCurto(trim)}`;
              return (
                <tr
                  key={l.key}
                  className={`border-b border-zinc-100 last:border-0 ${
                    ehPib
                      ? "border-t border-[#132960]/20 bg-[#132960]/[0.035] font-semibold text-[#132960]"
                      : ehMemo
                        ? "italic text-zinc-500"
                        : "text-zinc-700"
                  }`}
                >
                  {/* Sticky + opaco p/ cobrir o conteúdo rolado; a régua PIB repete o tom da linha via sombra interna (navy 3,5%). */}
                  <th
                    scope="row"
                    className={`sticky left-0 z-[1] whitespace-nowrap bg-white py-1 pl-1 pr-2 text-left ${
                      ehPib
                        ? "font-semibold text-[#132960] shadow-[inset_0_0_0_9999px_rgba(19,41,96,0.035)]"
                        : ehMemo
                          ? "font-normal italic text-zinc-500"
                          : "font-medium text-[#132960]"
                    }`}
                    title={l.rotulo}
                  >
                    {l.rotuloCurto}
                    {l.vazamento ? (
                      <span className="ml-1 text-[10px] font-normal text-zinc-400" title="entra subtraindo na identidade C + G + FBCF + Δestoques + X − M">
                        (−)
                      </span>
                    ) : null}
                  </th>
                  <td className={`${TD_BASE} ${l.idxSa == null ? "text-zinc-400" : ""}`}>{fmtNum(l.idxSa, 1)}</td>
                  <td className={`${TD_BASE} ${l.reaisBi == null ? "text-zinc-400" : ""}`}>
                    {l.reaisBi == null ? "—" : ehMemo ? fmtSignedNum(l.reaisBi, 1) : fmtNum(l.reaisBi, 1)}
                  </td>
                  <CelulaCalor valor={l.qoq} escala={escalaQoq} titulo={`${rotuloCol} · QoQ SA`} memo={ehMemo} />
                  <CelulaCalor valor={l.yoy} escala={escalaOutras} titulo={`${rotuloCol} · YoY`} memo={ehMemo} />
                  <CelulaCalor valor={l.acum4t} escala={escalaOutras} titulo={`${rotuloCol} · acum. 4T`} memo={ehMemo} />
                  <CelulaCalor valor={l.acumAno} escala={escalaOutras} titulo={`${rotuloCol} · acum. ano`} memo={ehMemo} />
                  <td className={`${TD_BASE} relative`}>
                    {l.peso == null ? (
                      <span className="text-zinc-400" title={ehPib ? "régua: 100% por construção (a 1846 não publica a linha)" : undefined}>
                        —
                      </span>
                    ) : ehMemo ? (
                      // Saldo em p.p. do PIB, com sinal; sem mini-barra (pode ser negativo).
                      <span title="exportações − importações, % do PIB nominal">{fmtSignedNum(l.peso, 1)}%</span>
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
              );
            })}
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
