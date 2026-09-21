"use client";

import { useMemo, useState } from "react";

import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { AzSegmented, ChartCard, CockpitChip } from "@/components/painel/core";
import { variationFill, variationText } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";
import { baixarCsv, fmtTrimCurto, num } from "../../shared";
import { BTN_CSV_CLASS } from "../cockpit-shared";

/**
 * COCKPIT · Conta financeira por instrumento (SIDRA 2205): tabela mestra B.9,
 * IDP e F.1–F.8 (com subitens) × aquisição de ativos · emissão de passivos ·
 * líquido (ativo − passivo) · Δ do líquido vs trimestre anterior, em R$ bi, no
 * acumulado em 4T (default) ou no trimestre. Colapsável: a linha-resumo (totais
 * + selo Σ F.1–F.8 = B.9) fica sempre visível. Absorve TabelaMestraFinanceiraPib,
 * ReconciliacaoFinanceiraPib e InstrumentosFinanciamentoPib.
 */

type Base = "acum4t" | "trim";

/** "saldo" = B.9 (resultado, realce) · "memo" = IDP (recorte, fora da soma) · "nivel1" = F.1…F.8 · "sub" = subitem indentado. */
type TipoLinha = "saldo" | "memo" | "nivel1" | "sub";

// Sequência canônica da conta financeira (SCN 2008). `<k>_ativo / _passivo /
// _liquido` são as colunas no JSON; labels_financeiro traz só o código SIDRA.
const INSTRUMENTOS: readonly { key: string; rotulo: string; tipo: TipoLinha }[] = [
  { key: "b9", rotulo: "B.9 — Capacidade (+) / necessidade (−) líquida de financiamento", tipo: "saldo" },
  { key: "idp", rotulo: "IDP — Investimento direto no país (memo, fora da soma)", tipo: "memo" },
  { key: "f1", rotulo: "F.1 — Ouro monetário e DES", tipo: "nivel1" },
  { key: "f2", rotulo: "F.2 — Numerário e depósitos", tipo: "nivel1" },
  { key: "f3", rotulo: "F.3 — Títulos de dívida", tipo: "nivel1" },
  { key: "f31", rotulo: "F.31 — Títulos de curto prazo", tipo: "sub" },
  { key: "f32", rotulo: "F.32 — Títulos de longo prazo", tipo: "sub" },
  { key: "f4", rotulo: "F.4 — Empréstimos", tipo: "nivel1" },
  { key: "f41", rotulo: "F.41 — Empréstimos de curto prazo", tipo: "sub" },
  { key: "f42", rotulo: "F.42 — Empréstimos de longo prazo", tipo: "sub" },
  { key: "f5", rotulo: "F.5 — Participações de capital e cotas de fundos de investimento", tipo: "nivel1" },
  { key: "f6", rotulo: "F.6 — Seguros, previdência e garantias padronizadas", tipo: "nivel1" },
  { key: "f7", rotulo: "F.7 — Derivativos financeiros e opções de ações a empregados", tipo: "nivel1" },
  { key: "f8", rotulo: "F.8 — Outras contas a receber / a pagar", tipo: "nivel1" },
  { key: "f81", rotulo: "F.81 — Créditos comerciais e adiantamentos", tipo: "sub" },
  { key: "f89", rotulo: "F.89 — Outras contas a receber / a pagar (n.e.)", tipo: "sub" },
];

/** Chaves de nível 1 cuja soma de líquidos fecha o B.9 (subitens ficam fora p/ não duplicar). */
const NIVEL1 = INSTRUMENTOS.filter((i) => i.tipo === "nivel1").map((i) => i.key);

/** Tolerância da reconciliação Σ F.1–F.8 vs B.9 (R$ bi) — arredondamento da SIDRA. */
const TOLERANCIA_BI = 1;

/** Fator R$ milhões (JSON) → R$ bilhões (tabela). */
const MI_PARA_BI = 1000;

type RowCf = Record<string, unknown> & { trim?: string };

type Linha = {
  key: string;
  rotulo: string;
  tipo: TipoLinha;
  /** Código SIDRA do instrumento (labels_financeiro) — title e CSV. */
  codigo?: string;
  /** R$ bi. */
  ativo: number | null;
  passivo: number | null;
  liquido: number | null;
  /** líquido(t) − líquido(t−1) na base selecionada, R$ bi (CALCULADO). */
  delta: number | null;
  /** Líquido CALCULADO = ativo − passivo (campo `<k>_liquido` nulo no builder). */
  calculado: boolean;
};

/** Lê a chave em R$ milhões e devolve em R$ bilhões; null preserva o "—". */
function bi(row: RowCf | null, key: string): number | null {
  const v = num(row, key);
  return v == null ? null : +(v / MI_PARA_BI).toFixed(3);
}

/**
 * Líquido do instrumento em R$ bi. B.9 é um SALDO gravado em `b9_passivo`
 * (ativo/líquido nulos) — vai direto p/ a coluna Líquido. Nos demais, usa o
 * publicado; quando nulo (F.1, F.89, IDP, totais) calcula ativo − passivo com
 * nulo = 0 — e marca como calculado.
 */
function liquidoBi(row: RowCf | null, key: string): { valor: number | null; calculado: boolean } {
  if (!row) return { valor: null, calculado: false };
  if (key === "b9") return { valor: bi(row, "b9_passivo"), calculado: false };
  const pub = bi(row, `${key}_liquido`);
  if (pub != null) return { valor: pub, calculado: false };
  const a = bi(row, `${key}_ativo`);
  const p = bi(row, `${key}_passivo`);
  if (a == null && p == null) return { valor: null, calculado: false };
  return { valor: +((a ?? 0) - (p ?? 0)).toFixed(3), calculado: true };
}

/** Linha tem dado da conta financeira (a serie_acum4t nasce com 3 trimestres nulos em 2010). */
function temDado(row: RowCf): boolean {
  return num(row, "b9_passivo") != null || num(row, "total_ativo_ativo") != null;
}

const TD = "py-1 px-2 text-right whitespace-nowrap";

/** Célula de R$ bi sem sinal forçado (Intl imprime o negativo); "—" quando ausente. */
function CelulaBi({ valor, titulo }: { valor: number | null; titulo?: string }) {
  if (valor == null) {
    return (
      <td className={`${TD} text-zinc-400`} title={titulo ?? "não publicado na 2205 (o builder grava null)"}>
        —
      </td>
    );
  }
  return <td className={TD}>{fmtNum(valor, 1)}</td>;
}

// `codace` faz parte da assinatura padrão dos cards do cockpit; esta tabela-snapshot não o usa.
export function InstrumentosFinanceirosPib({
  pib,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [base, setBase] = useState<Base>("acum4t");

  const cf = pib.conta_financeira;
  const codigos = pib.labels_financeiro;

  const rows = useMemo<ReadonlyArray<RowCf>>(
    () => ((base === "acum4t" ? cf?.serie_acum4t : cf?.serie) ?? []) as ReadonlyArray<RowCf>,
    [cf, base],
  );

  // Índice do último ponto COM dado na base selecionada (−1 = nenhum); o anterior alimenta o Δ.
  const iUlt = useMemo(() => {
    for (let i = rows.length - 1; i >= 0; i--) if (temDado(rows[i])) return i;
    return -1;
  }, [rows]);
  const ult: RowCf | null = iUlt >= 0 ? rows[iUlt] : null;
  const ant: RowCf | null = iUlt > 0 ? rows[iUlt - 1] : null;

  const trimRef = String(ult?.trim ?? pib.trim_recente);

  const linhas = useMemo<Linha[]>(
    () =>
      INSTRUMENTOS.map((i) => {
        const liq = liquidoBi(ult, i.key);
        const liqAnt = liquidoBi(ant, i.key).valor;
        const ehSaldo = i.tipo === "saldo";
        return {
          key: i.key,
          rotulo: i.rotulo,
          tipo: i.tipo,
          codigo: codigos?.[i.key],
          // B.9 é saldo: não tem lado ativo/passivo (o valor da coluna passivo É o saldo).
          ativo: ehSaldo ? null : bi(ult, `${i.key}_ativo`),
          passivo: ehSaldo ? null : bi(ult, `${i.key}_passivo`),
          liquido: liq.valor,
          delta: liq.valor != null && liqAnt != null ? +(liq.valor - liqAnt).toFixed(3) : null,
          calculado: liq.calculado,
        };
      }),
    [ult, ant, codigos],
  );

  // Linha de fechamento: total de ativos (101010) e de passivos (101011); líquido = diferença (≡ B.9).
  const total = useMemo(() => {
    const montar = (r: RowCf | null) => {
      const a = bi(r, "total_ativo_ativo");
      const p = bi(r, "total_passivo_passivo");
      return { ativo: a, passivo: p, liquido: a != null && p != null ? +(a - p).toFixed(3) : null };
    };
    const atual = montar(ult);
    const anterior = montar(ant);
    return {
      ...atual,
      delta: atual.liquido != null && anterior.liquido != null ? +(atual.liquido - anterior.liquido).toFixed(3) : null,
    };
  }, [ult, ant]);

  // Reconciliação: Σ líquidos F.1…F.8 (nível 1) vs B.9 publicado (b9_passivo).
  const reconc = useMemo(() => {
    const b9 = bi(ult, "b9_passivo");
    let soma = 0;
    let n = 0;
    for (const k of NIVEL1) {
      const v = liquidoBi(ult, k).valor;
      if (v != null) {
        soma += v;
        n++;
      }
    }
    if (b9 == null || n === 0) return { soma: null as number | null, b9, residuo: null as number | null, ok: false };
    const residuo = +(soma - b9).toFixed(3);
    return { soma: +soma.toFixed(3), b9, residuo, ok: Math.abs(residuo) < TOLERANCIA_BI };
  }, [ult]);

  // Escala das mini-barras: maior |líquido| entre os F.x (nível 1 e subitens) da base selecionada.
  const maxAbsFx = useMemo(
    () =>
      Math.max(
        0.001,
        ...linhas.filter((l) => l.tipo === "nivel1" || l.tipo === "sub").map((l) => Math.abs(l.liquido ?? 0)),
      ),
    [linhas],
  );

  const rotuloBase = base === "acum4t" ? "acum. 4T" : "trimestral";

  const baixar = () => {
    baixarCsv(
      `pib-conta-financeira-instrumentos-${base}-${trimRef}.csv`,
      ["instrumento", "codigo_sidra", "base", "trimestre", "ativo_rs_bi", "passivo_rs_bi", "liquido_rs_bi", "liquido_calculado", "delta_liquido_tt_rs_bi"],
      [
        ...linhas.map((l) => [l.rotulo, l.codigo ?? "", rotuloBase, trimRef, l.ativo, l.passivo, l.liquido, l.calculado ? "sim" : "não", l.delta]),
        [
          "Total — variação líquida de ativos / passivos financeiros",
          `${codigos?.total_ativo ?? ""}/${codigos?.total_passivo ?? ""}`,
          rotuloBase,
          trimRef,
          total.ativo,
          total.passivo,
          total.liquido,
          total.liquido != null ? "sim" : "não",
          total.delta,
        ],
      ],
    );
  };

  const semDado = !cf || !ult;

  const footer = (
    // O popover do (?) vive dentro do <h2>: só elementos de frase (span), sem <p>/<div>.
    <span className="block space-y-1.5">
      <span className="block">
        <strong>Fonte:</strong> IBGE/SIDRA 2205 — Contas Econômicas Integradas trimestrais, conta financeira por
        instrumento, desde 2010-T1, a preços correntes, publicada em R$ milhões (a tabela divide por 1.000). Sem ajuste
        sazonal. Base <em>acum. 4T</em> = soma móvel dos 4 últimos trimestres (fluxo anualizado, atenua sazonalidade);
        base <em>trimestral</em> = fluxo do trimestre.
      </span>
      <span className="block">
        <strong>Colunas:</strong> Ativo = aquisição líquida de ativos financeiros (a economia aplicando/emprestando);
        Passivo = emissão (incorrência) líquida de passivos (a economia captando); Líquido = ativo − passivo = contribuição
        do instrumento ao B.9 — negativo = o instrumento trouxe mais financiamento do que aplicou; positivo = aplicou
        mais do que captou. Δ = líquido no trimestre menos líquido no trimestre anterior da mesma base, em R$ bi,
        CALCULADO; cor pela direção literal do número (verde subiu, vermelho caiu, sem julgamento). Mini-barra no fundo
        da coluna Líquido: largura proporcional ao maior |líquido| entre os F.x da base selecionada.
      </span>
      <span className="block">
        <strong>Instrumentos (SCN 2008 / BPM6):</strong> F.1 ouro monetário e DES (direitos especiais de saque do FMI);
        F.2 numerário e depósitos; F.3 títulos de dívida (F.31 curto prazo ≤ 1 ano, F.32 longo prazo); F.4 empréstimos
        (F.41 curto, F.42 longo prazo); F.5 participações de capital e cotas de fundos de investimento (equity, o
        &quot;dinheiro de sócio&quot;); F.6 reservas técnicas de seguros, previdência e garantias padronizadas; F.7
        derivativos financeiros e opções de ações concedidas a empregados; F.8 outras contas a receber/pagar (F.81
        créditos comerciais e adiantamentos; F.89 demais, n.e.). Subitens indentados sob o instrumento-pai.
      </span>
      <span className="block">
        <strong>Reconciliação:</strong> Σ líquidos F.1…F.8 (só o nível 1 — F.31/32, F.41/42 e F.81/89 são subitens e
        ficam fora p/ não duplicar) ≡ B.9. Selo ✓ quando |Σ − B.9| &lt; R$ {TOLERANCIA_BI} bi (arredondamento da SIDRA);
        senão mostra o resíduo. A linha Total (variação líquida de ativos 101010 e de passivos 101011) fecha por outro
        caminho: total ativo − total passivo ≡ B.9.
      </span>
      <span className="block">
        <strong>B.9</strong> = capacidade (+) / necessidade (−) líquida de financiamento da economia — o mesmo saldo que
        encerra a sequência da renda (2072). Negativo = o país tomou mais financiamento do que aplicou. No payload o
        saldo vive em <code>b9_passivo</code> (a SIDRA o publica na coluna de passivo; ativo/líquido vêm nulos): a
        tabela o mostra na coluna Líquido, com ativo e passivo &quot;—&quot;.
      </span>
      <span className="block">
        <strong>IDP</strong> = investimento direto no país: recorte por NATUREZA DO INVESTIDOR (participações de capital
        F.5 e empréstimos intercompanhia F.4 de não residentes com relação de controle), não um instrumento — por isso
        NÃO entra na soma (item memo). A 2205 só publica o lado passivo (entrada de investimento direto); o líquido
        mostrado é −passivo, na mesma convenção das linhas F.x.
      </span>
      <span className="block">
        <strong>Nulos (&quot;—&quot;):</strong> a 2205 não traz passivo de F.1 e F.89 (o builder grava null) nem os
        líquidos de F.1, F.89, B.9, IDP e dos totais — estes são CALCULADOS como ativo − passivo com nulo = 0 (título da
        célula marca &quot;calculado&quot;). Na base trimestral a SIDRA publica passivo de F.1 em trimestres pontuais (ex.:
        alocação de DES do FMI em 2021-T3), mas a serie_acum4t do builder não acumula esse campo — janelas de 4T que
        contêm esses trimestres não fecham contra o B.9 e o selo mostra o resíduo. A serie_acum4t nasce nula em
        2010-T1…T3 (faltam 4 trimestres p/ somar).
      </span>
    </span>
  );

  return (
    <ChartCard
      id="pib-instrumentos-financeiros"
      title="Conta financeira — instrumentos F.1 a F.8 (R$ bi)"
      subtitle="SIDRA 2205 · acum. 4T ou trimestral · aquisição de ativos · emissão de passivos · líquido (ativo − passivo) por instrumento · Δ do líquido vs trimestre anterior · reconciliação Σ líquidos = B.9"
      toolbar={
        <button type="button" onClick={baixar} className={BTN_CSV_CLASS} disabled={semDado}>
          Baixar CSV
        </button>
      }
      footer={footer}
      stampGiro={geradoEm}
      stampDado={trimRef}
    >
      {semDado ? (
        <p className="py-6 text-center text-sm text-zinc-400">
          Conta financeira (2205) ausente nesta carga — o builder não gravou o bloco <code>conta_financeira</code>.
        </p>
      ) : (
        <details className="group">
          <summary className="cursor-pointer select-none list-none rounded-lg px-1 py-1 transition-colors hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span
                aria-hidden
                className="inline-block w-3 text-center text-xs text-[#027DFC] transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              {/* Linha-resumo (número dinâmico mora no chip, nunca no título): período · totais · selo. */}
              <span className="flex flex-wrap gap-1.5">
                <CockpitChip tom="navy" title="Trimestre do último ponto com dado e base da leitura (acum. 4T = soma móvel de 4 trimestres)">
                  {fmtTrimCurto(trimRef)} · {rotuloBase}
                </CockpitChip>
                <CockpitChip
                  tom="navy"
                  title={`Variação líquida total de ativos (SIDRA ${codigos?.total_ativo ?? "—"}) e de passivos (${codigos?.total_passivo ?? "—"}), R$ bi, ${rotuloBase}`}
                >
                  Total ativo {total.ativo == null ? "—" : fmtNum(total.ativo, 1)} · passivo{" "}
                  {total.passivo == null ? "—" : fmtNum(total.passivo, 1)} bi
                </CockpitChip>
                <CockpitChip tom="navy" title="Líquido CALCULADO = total ativo − total passivo (≡ B.9), R$ bi">
                  Líquido {total.liquido == null ? "—" : fmtSignedNum(total.liquido, 1)} bi
                </CockpitChip>
                {reconc.residuo == null ? (
                  <CockpitChip tom="navy" title="B.9 ou os líquidos F.1–F.8 vieram nulos neste ponto">
                    Σ F.1–F.8 vs B.9 — sem dado
                  </CockpitChip>
                ) : reconc.ok ? (
                  <CockpitChip
                    tom="pos"
                    title={`Σ líquidos F.1–F.8 = ${fmtSignedNum(reconc.soma, 1)} bi · B.9 = ${fmtSignedNum(reconc.b9, 1)} bi · resíduo ${fmtSignedNum(reconc.residuo, 2)} bi (< ${TOLERANCIA_BI} bi)`}
                  >
                    Σ F.1–F.8 = B.9 ✓
                  </CockpitChip>
                ) : (
                  <CockpitChip
                    tom="neg"
                    title={`Σ líquidos F.1–F.8 = ${fmtSignedNum(reconc.soma, 1)} bi · B.9 = ${fmtSignedNum(reconc.b9, 1)} bi`}
                  >
                    Σ F.1–F.8 ≠ B.9 (resíduo {fmtSignedNum(reconc.residuo, 1)} bi)
                  </CockpitChip>
                )}
              </span>
            </span>
          </summary>

          <div className="mt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <AzSegmented
                ariaLabel="Base da conta financeira"
                options={[
                  { id: "acum4t", label: "Acum. 4T" },
                  { id: "trim", label: "Trimestral" },
                ]}
                value={base}
                onChange={(id) => setBase(id === "trim" ? "trim" : "acum4t")}
              />
              <span className="text-[10px] tabular-nums text-zinc-500">
                Líquido = ativo − passivo · fundo da coluna Líquido ∝ |líquido| ÷ máx F.x ({fmtNum(maxAbsFx, 1)} bi)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-[#132960]/15 text-[10px] uppercase tracking-wide text-zinc-500">
                    <th scope="col" className="py-2 pl-1 pr-2 text-left font-semibold">
                      Instrumento
                    </th>
                    <th scope="col" className={`${TD} font-semibold`}>
                      Ativo (R$ bi)
                    </th>
                    <th scope="col" className={`${TD} font-semibold`}>
                      Passivo (R$ bi)
                    </th>
                    <th scope="col" className={`${TD} font-semibold`}>
                      Líquido (R$ bi)
                    </th>
                    <th scope="col" className={`${TD} pr-1 font-semibold`}>
                      Δ líquido t/t (R$ bi)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const ehSaldo = l.tipo === "saldo";
                    const ehMemo = l.tipo === "memo";
                    const ehSub = l.tipo === "sub";
                    const comBarra = (l.tipo === "nivel1" || ehSub) && l.liquido != null;
                    const larguraPct = comBarra ? Math.min(50, (Math.abs(l.liquido as number) / maxAbsFx) * 50) : 0;
                    return (
                      <tr
                        key={l.key}
                        className={`border-b border-zinc-100 ${
                          ehSaldo
                            ? "bg-[#132960]/[0.035] font-semibold text-[#132960]"
                            : ehMemo
                              ? "italic text-zinc-500"
                              : "text-zinc-700"
                        }`}
                      >
                        <th
                          scope="row"
                          className={`whitespace-nowrap py-1 pr-2 text-left ${
                            ehSaldo
                              ? "pl-1 font-semibold text-[#132960]"
                              : ehMemo
                                ? "pl-1 font-normal italic text-zinc-500"
                                : ehSub
                                  ? "pl-6 font-normal text-zinc-500"
                                  : "pl-1 font-medium text-[#132960]"
                          }`}
                          title={l.codigo ? `${l.rotulo} · código SIDRA ${l.codigo}` : l.rotulo}
                        >
                          {l.rotulo}
                        </th>
                        <CelulaBi
                          valor={l.ativo}
                          titulo={ehSaldo ? "B.9 é um saldo — não tem lado ativo" : ehMemo ? "a 2205 não publica o lado ativo do IDP" : undefined}
                        />
                        <CelulaBi
                          valor={l.passivo}
                          titulo={ehSaldo ? "B.9 é um saldo — o valor está na coluna Líquido" : undefined}
                        />
                        <td
                          className={`${TD} relative`}
                          title={
                            l.liquido == null
                              ? "não publicado"
                              : l.calculado
                                ? "líquido CALCULADO = ativo − passivo (campo não publicado na 2205; nulo = 0)"
                                : ehSaldo
                                  ? "B.9 publicado (saldo, campo b9_passivo)"
                                  : "líquido publicado na 2205"
                          }
                        >
                          {comBarra ? (
                            <>
                              {/* Eixo do zero + mini-barra divergente (verde ≥ 0 à direita, vermelho < 0 à esquerda). */}
                              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[#132960]/15" />
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-y-1 rounded-sm"
                                style={{
                                  width: `${larguraPct}%`,
                                  ...((l.liquido as number) >= 0 ? { left: "50%" } : { right: "50%" }),
                                  background: variationFill(l.liquido as number),
                                  opacity: 0.1,
                                }}
                              />
                            </>
                          ) : null}
                          <span className={`relative ${l.liquido == null ? "text-zinc-400" : "font-semibold"}`}>
                            {l.liquido == null ? "—" : fmtSignedNum(l.liquido, 1)}
                            {l.calculado && l.liquido != null ? (
                              <span className="ml-0.5 text-[9px] font-normal text-zinc-400" aria-label="calculado">
                                ‡
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className={`${TD} pr-1`}>
                          {l.delta == null ? (
                            <span className="text-zinc-400">—</span>
                          ) : (
                            <span className="font-semibold" style={{ color: variationText(l.delta) }}>
                              {fmtSignedNum(l.delta, 1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Fechamento: total ativo − total passivo ≡ B.9 (realce). */}
                  <tr className="border-t-2 border-[#132960]/30 bg-[#132960]/[0.06] font-semibold text-[#132960]">
                    <th
                      scope="row"
                      className="whitespace-nowrap py-2 pl-1 pr-2 text-left font-semibold"
                      title={`Variação líquida de ativos (código SIDRA ${codigos?.total_ativo ?? "—"}) e de passivos (${codigos?.total_passivo ?? "—"})`}
                    >
                      Total — variação líquida de ativos / passivos
                    </th>
                    <td className={TD}>{total.ativo == null ? "—" : fmtNum(total.ativo, 1)}</td>
                    <td className={TD}>{total.passivo == null ? "—" : fmtNum(total.passivo, 1)}</td>
                    <td className={TD} title="CALCULADO = total ativo − total passivo (≡ B.9)">
                      {total.liquido == null ? "—" : fmtSignedNum(total.liquido, 1)}
                      {total.liquido != null ? (
                        <span className="ml-0.5 text-[9px] font-normal text-[#132960]/60" aria-label="calculado">
                          ‡
                        </span>
                      ) : null}
                    </td>
                    <td className={`${TD} pr-1`}>
                      {total.delta == null ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <span style={{ color: variationText(total.delta) }}>{fmtSignedNum(total.delta, 1)}</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-1.5 text-[10px] text-zinc-500">
              ‡ = líquido calculado (campo não publicado na 2205) · subitens F.31/32, F.41/42, F.81/89 e IDP (memo) fora da
              soma Σ F.1–F.8
            </p>
          </div>
        </details>
      )}
    </ChartCard>
  );
}
