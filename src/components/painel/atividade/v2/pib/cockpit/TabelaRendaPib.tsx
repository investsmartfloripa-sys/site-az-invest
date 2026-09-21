"use client";

import { useMemo } from "react";

import type {
  AtividadeCodaceData,
  AtividadePibData,
  PibContasPonto,
} from "@/lib/painel-atividade";
import { ChartCard, CockpitChip, tomPorSinal } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { baixarCsv, fmtTrimCurto, num } from "../../shared";
import { BANDA_ESTAVEL_PP, BTN_CSV_CLASS } from "../cockpit-shared";

/**
 * COCKPIT · Sequência da renda — snapshot tabular do trimestre mais recente das
 * Contas Econômicas Integradas resumidas (SIDRA 2072): as 12 contas na ordem do
 * SNA, em R$ bi correntes (`contas_economicas` ÷ 1000), em % do PIB nominal
 * (`contas_economicas_pct_pib`, com mini-barra proporcional, PIB = 100) e Δ do
 * peso vs 4 trimestres antes (p.p.). Absorve TabelaMestraRendaPib (planilha),
 * CascataRendaPib (mini-barras) e VazamentoRendaPib (chip RNB/PIB e rendas de propriedade).
 */

/** Papel da linha na sequência: entra (+), sai (−) ou é saldo (=) — PIB é o nível de partida (tratado como saldo). */
type TipoConta = "pib" | "mais" | "menos" | "saldo";

// As 12 contas da renda, na ORDEM EXATA das CEI (SIDRA 2072). As chaves são as
// strings LITERAIS do JSON (com acentos) — conferidas no Blob de 2T26.
const CONTAS: ReadonlyArray<{ key: string; tipo: TipoConta; curto: string }> = [
  { key: "Produto Interno Bruto", tipo: "pib", curto: "PIB" },
  {
    key: "(+) Salários (líquidos recebidos do exterior)",
    tipo: "mais",
    curto: "Salários líq. recebidos do exterior",
  },
  {
    key: "(+) Rendas de propriedade (líquidas recebidas do exterior)",
    tipo: "mais",
    curto: "Rendas de propriedade líq. recebidas do exterior",
  },
  {
    key: "(=) Renda nacional bruta",
    tipo: "saldo",
    curto: "Renda nacional bruta (RNB)",
  },
  {
    key: "(+) Outras transferências correntes (líquidas recebidas do exterior)",
    tipo: "mais",
    curto: "Outras transf. correntes líq. do exterior",
  },
  {
    key: "(=) Renda nacional disponível bruta",
    tipo: "saldo",
    curto: "Renda nacional disponível bruta (RNDB)",
  },
  {
    key: "(-) Despesa de consumo final",
    tipo: "menos",
    curto: "Despesa de consumo final",
  },
  { key: "(=) Poupança bruta", tipo: "saldo", curto: "Poupança bruta" },
  {
    key: "(-) Formação bruta de capital",
    tipo: "menos",
    curto: "Formação bruta de capital (FBC)",
  },
  {
    key: "(+) Cessão de ativos não financeiros não produzidos (aquisições líquidas)",
    tipo: "mais",
    curto: "Cessão de ativos não fin. não produzidos (aquis. líq.)",
  },
  {
    key: "(+) Transferências de capital (líquidas recebidas do exterior)",
    tipo: "mais",
    curto: "Transf. de capital líq. do exterior",
  },
  {
    key: "(=) Capacidade / necessidade líquida de financiamento",
    tipo: "saldo",
    curto: "Capacidade (+) / necessidade (−) líq. de financiamento (B.9)",
  },
];

// Chaves dos chips (mesmas strings literais acima).
const K_RNB = "(=) Renda nacional bruta";
const K_RENDAS_PROP =
  "(+) Rendas de propriedade (líquidas recebidas do exterior)";
const K_POUPANCA = "(=) Poupança bruta";
const K_B9 = "(=) Capacidade / necessidade líquida de financiamento";

/** Fator R$ milhões (JSON) → R$ bilhões (tabela). */
const MI_PARA_BI = 1000;

/** Opacidade da mini-barra de fundo da coluna % PIB. */
const ALPHA_BARRA = 0.1;

/** Glifo da 1ª coluna por papel da linha (menos tipográfico U+2212). */
const GLIFO: Record<TipoConta, string> = {
  pib: "",
  mais: "+",
  menos: "−",
  saldo: "=",
};

/** Cor da mini-barra por papel da linha: entra = verde, sai = vermelho, saldo/PIB = azul (tokens do tema). */
const COR_BARRA: Record<TipoConta, string> = {
  pib: AZ_BRAND.azure,
  saldo: AZ_BRAND.azure,
  mais: AZ_CHART.pos,
  menos: AZ_CHART.neg,
};

/** "#RRGGBB" do tema → "rgba(r,g,b,a)" (só deriva opacidade de um token existente; nunca hex novo). */
function comAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Nível com menos tipográfico quando negativo ("−84,0"), sem "+" quando positivo ("97,6"). */
function fmtNivel(v: number | null, dec: number, pct: boolean): string {
  if (v == null) return "—";
  if (v < 0) return pct ? fmtSignedPct(v, dec) : fmtSignedNum(v, dec);
  return pct ? fmtPct(v, dec) : fmtNum(v, dec);
}

/** "2026-T02" → "2025-T02" (mesmo trimestre do ano anterior = 4 trimestres antes). */
function trimMenos4(trim: string): string {
  const m = trim.match(/^(\d{4})-T(\d{1,2})$/);
  if (!m) return trim;
  return `${parseInt(m[1], 10) - 1}-T${m[2].padStart(2, "0")}`;
}

type LinhaRenda = {
  key: string;
  curto: string;
  tipo: TipoConta;
  /** R$ bilhões correntes (JSON em R$ milhões ÷ 1000). */
  reaisBi: number | null;
  /** R$ milhões correntes crus (só p/ o CSV). */
  reaisMi: number | null;
  pctPib: number | null;
  /** pct(t) − pct(t − 4T), em p.p. do PIB; null no PIB (denominador). */
  dPct4t: number | null;
};

const TD_NUM = "py-1.5 px-2 text-right whitespace-nowrap";

export function TabelaRendaPib({
  pib,
  geradoEm,
}: {
  pib: AtividadePibData;
  /** Aceito por simetria com os demais cards do cockpit; a tabela é snapshot, sem eixo de tempo. */
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const reaisSerie = useMemo<ReadonlyArray<PibContasPonto>>(
    () => pib.contas_economicas?.serie ?? [],
    [pib.contas_economicas],
  );
  const pctSerie = useMemo<ReadonlyArray<PibContasPonto>>(
    () => pib.contas_economicas_pct_pib?.serie ?? [],
    [pib.contas_economicas_pct_pib],
  );

  const reaisUlt = reaisSerie.length ? reaisSerie[reaisSerie.length - 1] : null;
  const pctUlt = pctSerie.length ? pctSerie[pctSerie.length - 1] : null;

  // Trimestre de referência = trim cru do último ponto (o DataStamp imprime "2T26").
  const trimRef = reaisUlt?.trim ?? pctUlt?.trim ?? pib.trim_recente;
  const trimAnt = trimMenos4(trimRef);
  const pctAnt = useMemo(
    () => pctSerie.find((r) => r.trim === trimAnt) ?? null,
    [pctSerie, trimAnt],
  );

  const linhas = useMemo<LinhaRenda[]>(
    () =>
      CONTAS.map((c) => {
        const reaisMi = num(reaisUlt, c.key);
        const pct = num(pctUlt, c.key);
        const pctT4 = num(pctAnt, c.key);
        return {
          key: c.key,
          curto: c.curto,
          tipo: c.tipo,
          reaisMi,
          reaisBi: reaisMi != null ? +(reaisMi / MI_PARA_BI).toFixed(3) : null,
          pctPib: pct,
          dPct4t:
            c.tipo !== "pib" && pct != null && pctT4 != null
              ? +(pct - pctT4).toFixed(2)
              : null,
        };
      }),
    [reaisUlt, pctUlt, pctAnt],
  );

  const porChave = (k: string) => linhas.find((l) => l.key === k);
  const rnb = porChave(K_RNB);
  const rendasProp = porChave(K_RENDAS_PROP);
  const poupanca = porChave(K_POUPANCA);
  const b9 = porChave(K_B9);

  const trimCurto = fmtTrimCurto(trimRef);
  const trimAntCurto = fmtTrimCurto(trimAnt);
  const dTxt = (l: LinhaRenda | undefined) =>
    l?.dPct4t != null
      ? `Δ vs ${trimAntCurto}: ${fmtSignedNum(l.dPct4t, 2)} p.p.`
      : "";

  // Sazonalidade da taxa de poupança (6726) para o texto do ?; fallback textual se o builder não gravou.
  const saz = pib.taxa_poupanca?.sazonalidade;
  const sazQ3 = saz?.Q3 ?? null;
  const sazQ4 = saz?.Q4 ?? null;

  const semDado = !reaisUlt && !pctUlt;

  const baixar = () => {
    baixarCsv(
      `pib-sequencia-renda-${trimRef}.csv`,
      [
        "conta",
        "trimestre",
        "valor_rs_milhoes_correntes",
        "valor_rs_bi_correntes",
        "pct_pib_nominal",
        "delta_pct_pib_vs_t4_pp",
      ],
      linhas.map((l) => [
        l.key,
        trimRef,
        l.reaisMi,
        l.reaisBi,
        l.pctPib,
        l.dPct4t,
      ]),
    );
  };

  const th = "py-2 px-2 text-right font-semibold whitespace-nowrap";

  return (
    <ChartCard
      id="pib-tabela-renda"
      title="Sequência da renda — 12 contas (CEI)"
      subtitle="SIDRA 2072 · R$ bi correntes · % PIB · Δ vs t−4 · PIB → renda nacional bruta → renda disponível → poupança bruta → formação bruta de capital → capacidade/necessidade líquida de financiamento · fluxos indentados, saldos (=) em realce"
      toolbar={
        <button
          type="button"
          onClick={baixar}
          className={`${BTN_CSV_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={semDado}
        >
          Baixar CSV
        </button>
      }
      footer={
        // O popover do (?) vive dentro do <h2>: só elementos de frase (span), sem <p>/<div>.
        <span className="block space-y-1.5">
          <span className="block">
            <strong>Fonte:</strong> IBGE/SIDRA — Contas Nacionais Trimestrais,
            Contas Econômicas Integradas resumidas (tabela 2072), a preços
            correntes. A 2072 publica R$ milhões; a coluna R$ bi divide por
            1.000. A coluna % PIB é cada conta sobre o PIB nominal do mesmo
            trimestre (PIB = 100), calculada pelo builder com 2 casas. Δ vs t−4
            = % PIB no trimestre menos % PIB no mesmo trimestre do ano anterior
            ({trimAntCurto}), em pontos percentuais.
          </span>
          <span className="block">
            <strong>Sequência (SNA 2008):</strong> PIB (+) salários líquidos
            recebidos do exterior (+) rendas de propriedade líquidas recebidas
            do exterior (=) renda nacional bruta (+) outras transferências
            correntes líquidas (=) renda nacional disponível bruta (−) despesa
            de consumo final (=) poupança bruta (−) formação bruta de capital
            (+) cessão líquida de ativos não financeiros não produzidos (+)
            transferências de capital líquidas (=) capacidade (+) / necessidade
            (−) líquida de financiamento. Cada linha “(=)” é a soma das linhas
            acima dela desde o saldo anterior; os fluxos “(+)”/“(−)” aparecem
            com o sinal do JSON (um “(+)” negativo é renda enviada ao exterior).
          </span>
          <span className="block">
            <strong>Por que Δ vs t−4 e não vs o trimestre anterior:</strong> a
            2072 não tem ajuste sazonal e a poupança trimestral é fortemente
            sazonal — o 4º trimestre concentra consumo (13º salário, festas) e
            derruba a poupança bruta{" "}
            {sazQ3 != null && sazQ4 != null
              ? `(média histórica da taxa de poupança 6726: 3º tri ≈ ${fmtPct(sazQ3, 1)} vs 4º tri ≈ ${fmtPct(sazQ4, 1)} do PIB)`
              : "(4º tri ≈ 13% vs 3º tri ≈ 17% do PIB na taxa de poupança 6726)"}
            . Comparar com o mesmo trimestre do ano anterior neutraliza esse
            padrão.
          </span>
          <span className="block">
            <strong>Mini-barra</strong> da coluna % PIB = |valor| escalado pelo
            PIB (100 = célula inteira); a cor marca o papel da linha na
            sequência: verde entra (+), vermelho sai (−), azul saldo (=) e PIB.{" "}
            <strong>Chips</strong> = último trimestre; o ponto do chip segue a
            direção literal do número (verde positivo, vermelho negativo;
            RNB/PIB é razão, ponto navy).
          </span>
          <span className="block">
            <strong>Glossário:</strong> RNB = renda nacional bruta (o que os
            residentes ganham; fica abaixo do PIB quando a renda enviada ao
            exterior supera a recebida); RNDB = renda nacional disponível bruta
            (RNB + transferências correntes líquidas: é o que sobra para
            consumir ou poupar); FBC = formação bruta de capital (FBCF +
            variação de estoques, o investimento); B.9 = capacidade (+) /
            necessidade (−) líquida de financiamento = poupança − FBC (± contas
            de capital) — o mesmo saldo que a conta financeira (2205) detalha
            por instrumento e que espelha o saldo em transações correntes com o
            resto do mundo.
          </span>
          <span className="block">
            <strong>Nulos (“—”):</strong> PIB não tem Δ vs t−4 porque é o
            denominador (100 por construção). Uma conta sem valor no JSON ou um
            trimestre fora da cobertura da 2072 (série desde 3T06) também mostra
            “—”.
          </span>
        </span>
      }
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip
          tom="navy"
          title={`Renda nacional bruta em % do PIB (2072). ${dTxt(rnb)}`.trim()}
        >
          {trimCurto} · RNB/PIB {fmtPct(rnb?.pctPib, 1)}
        </CockpitChip>
        <CockpitChip
          tom={tomPorSinal(rendasProp?.pctPib)}
          title={`Rendas de propriedade líquidas recebidas do exterior, % PIB (negativo = juros, lucros e dividendos enviados ao exterior). ${dTxt(rendasProp)}`.trim()}
        >
          {trimCurto} · renda de propriedade líq.{" "}
          {fmtSignedPct(rendasProp?.pctPib, 1)} PIB
        </CockpitChip>
        <CockpitChip
          tom={tomPorSinal(poupanca?.pctPib)}
          title={`Poupança bruta = RNDB − consumo final, % PIB. ${dTxt(poupanca)}`.trim()}
        >
          {trimCurto} · poupança bruta {fmtPct(poupanca?.pctPib, 1)} PIB
        </CockpitChip>
        <CockpitChip
          tom={tomPorSinal(b9?.pctPib)}
          title={`B.9 = capacidade (+) / necessidade (−) líquida de financiamento, % PIB. ${dTxt(b9)}`.trim()}
        >
          {trimCurto} · B.9 {fmtSignedPct(b9?.pctPib, 1)} PIB
        </CockpitChip>
      </div>

      {semDado ? (
        <p className="flex h-40 items-center justify-center text-center text-sm text-zinc-400">
          Sem contas econômicas integradas (2072) nesta carga.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-[#132960]/15 text-[10px] uppercase tracking-wide text-zinc-500">
                <th
                  scope="col"
                  className="sticky left-0 z-[1] bg-white py-2 pl-1 pr-2 text-left font-semibold"
                >
                  Conta
                </th>
                <th scope="col" className={th}>
                  R$ bi
                </th>
                <th scope="col" className={th}>
                  % PIB
                </th>
                <th scope="col" className={`${th} pr-1`}>
                  Δ % PIB vs t−4 (p.p.)
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const saldo = l.tipo === "saldo" || l.tipo === "pib";
                return (
                  <tr
                    key={l.key}
                    className={`border-b border-zinc-100 last:border-0 ${
                      saldo
                        ? "bg-[#132960]/[0.035] font-semibold text-[#132960]"
                        : "text-zinc-700"
                    }`}
                  >
                    {/* Sticky + opaco p/ cobrir o conteúdo rolado; saldos repetem o tom da linha via sombra interna (navy 3,5%). */}
                    <th
                      scope="row"
                      title={l.key}
                      className={`sticky left-0 z-[1] bg-white py-1.5 pr-2 text-left ${
                        saldo
                          ? "pl-1 font-semibold text-[#132960] shadow-[inset_0_0_0_9999px_rgba(19,41,96,0.035)]"
                          : "pl-4 font-medium text-zinc-700"
                      }`}
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span
                          aria-hidden
                          className={`w-2.5 shrink-0 text-center font-mono text-[11px] ${saldo ? "text-[#132960]" : "text-zinc-400"}`}
                        >
                          {GLIFO[l.tipo]}
                        </span>
                        <span>{l.curto}</span>
                      </span>
                    </th>
                    <td className={TD_NUM}>
                      {l.reaisBi == null ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        fmtNivel(l.reaisBi, 1, false)
                      )}
                    </td>
                    <td className={`${TD_NUM} relative`}>
                      {l.pctPib == null ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <>
                          {/* Mini-barra de fundo: |% PIB| escalado pelo PIB = 100 (célula inteira). */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-1 left-0 rounded-sm"
                            style={{
                              width: `${Math.max(0, Math.min(100, Math.abs(l.pctPib)))}%`,
                              background: comAlpha(
                                COR_BARRA[l.tipo],
                                ALPHA_BARRA,
                              ),
                            }}
                          />
                          <span className="relative">
                            {fmtNivel(l.pctPib, 1, true)}
                          </span>
                        </>
                      )}
                    </td>
                    <td className={`${TD_NUM} pr-1`}>
                      {l.dPct4t == null ? (
                        <span
                          className="text-zinc-400"
                          title={
                            l.tipo === "pib"
                              ? "PIB = 100 por construção"
                              : undefined
                          }
                        >
                          —
                        </span>
                      ) : (
                        <span
                          className="font-semibold"
                          style={{
                            color: variationText(l.dPct4t, BANDA_ESTAVEL_PP),
                          }}
                        >
                          {fmtSignedNum(l.dPct4t, 2)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}
