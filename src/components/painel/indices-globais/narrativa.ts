/**
 * Motor NARRATIVO da página de Índices globais (sem JSX, puro, server-safe):
 * prosa gerada por REGRA, nunca ad-hoc — mesmo DNA da manchete do Painel IPCA
 * (inflacao/v2/shared.ts). Thresholds documentados aqui e na ficha técnica:
 * título/manchete afirmativo errado é pior que neutro.
 *
 * Três geradores:
 *  - buildMancheteDoDia: o tom do dia (risk-on/risk-off/misto) a partir dos
 *    retornos 1d por região + destaque de cada região + divergência do Brasil;
 *  - buildTituloCorrida: título afirmativo do rebase 100 a partir do YTD;
 *  - buildLeituraValuation: leitura de uma linha dos z-scores (CAPE/Buffett).
 */

import { fmtDataBR, fmtNum, fmtSignedNum, fmtSignedPct, parseIsoUTC } from "@/lib/format-br";
import type {
  GlobalValuationPayload,
  HistorySlice,
  WorldIndicesReturnsPayload,
} from "@/lib/painel-mercado-global";

import { CORRIDA_NOMES, INDICES_MUNDO, REGIOES, type RegiaoId } from "./mundo";

// ---------------------------------------------------------------------------
// Thresholds editoriais (documentados também na ficha técnica da página)
// ---------------------------------------------------------------------------

/** Banda de estabilidade de um índice no dia: |1d| ≤ 0,05% conta como "estável". */
export const BANDA_ESTAVEL_PCT = 0.05;

/** Direção de uma REGIÃO: média simples dos 1d acima/abaixo de ±0,15% = alta/baixa. */
export const DIRECAO_REGIAO_PCT = 0.15;

/**
 * Tom do dia pela amplitude PONDERADA POR REGIÃO (média das proporções de
 * altas/baixas de cada região — assim os 7 índices da Ásia não dominam os 4
 * da Europa): ≥ 60% de altas = risk-on; ≥ 60% de baixas = risk-off; senão misto.
 */
export const TOM_PROPORCAO_MIN = 0.6;

/** Só citamos o Brasil destoando/acompanhando com movimento ≥ 0,30% no EWZ. */
export const BRASIL_RELEVANTE_PCT = 0.3;

/** Mínimo de índices com 1d válido p/ gerar manchete (menos que isso = sem leitura honesta). */
const MIN_INDICES_MANCHETE = 6;

// ---------------------------------------------------------------------------
// Manchete do dia
// ---------------------------------------------------------------------------

export type TomDia = "risk-on" | "risk-off" | "misto";

export type MancheteDia = {
  texto: string;
  tom: TomDia;
  /** Data (ISO) do fechamento usado nos retornos 1d. */
  dataDado: string | null;
  /** true = dado do pregão ANTERIOR ao dia de hoje em Brasília — a prosa avisa. */
  fechamentoAnterior: boolean;
};

type Movimento = { ticker: string; praca: string; ret: number };

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

const TOM_TEXTO: Record<TomDia, string> = {
  "risk-on": "apetite a risco",
  "risk-off": "aversão a risco",
  misto: "sinais mistos",
};

function maiorMovimento(arr: Movimento[]): Movimento | null {
  let best: Movimento | null = null;
  for (const m of arr) {
    if (!best || Math.abs(m.ret) > Math.abs(best.ret)) best = m;
  }
  return best;
}

function media(arr: Movimento[]): number {
  return arr.reduce((s, m) => s + m.ret, 0) / arr.length;
}

/** Frase da Ásia — sempre no passado: quando o Brasil acorda, a Ásia já fechou. */
function fraseAsia(arr: Movimento[]): string | null {
  const destaque = maiorMovimento(arr);
  if (!destaque) return null;
  const m = media(arr);
  const pct = fmtSignedPct(destaque.ret, 1);
  if (m > DIRECAO_REGIAO_PCT) return `a Ásia fechou em alta puxada por ${destaque.praca} (${pct})`;
  if (m < -DIRECAO_REGIAO_PCT) return `a Ásia fechou em baixa pressionada por ${destaque.praca} (${pct})`;
  return `a Ásia fechou mista — o maior movimento foi de ${destaque.praca} (${pct})`;
}

function fraseEuropa(arr: Movimento[], passado: boolean): string | null {
  const destaque = maiorMovimento(arr);
  if (!destaque) return null;
  const m = media(arr);
  const pct = fmtSignedPct(destaque.ret, 1);
  if (m > DIRECAO_REGIAO_PCT) {
    return `a Europa ${passado ? "avançou" : "avança"}, com ${destaque.praca} (${pct}) à frente`;
  }
  if (m < -DIRECAO_REGIAO_PCT) {
    return `a Europa ${passado ? "recuou" : "recua"}, com ${destaque.praca} (${pct}) puxando para baixo`;
  }
  return `a Europa ${passado ? "andou" : "anda"} de lado`;
}

/** Frase das Américas: preferimos o S&P 500 (a praça-farol); sem ele, o maior movimento ex-Brasil. */
function fraseAmericas(arr: Movimento[], passado: boolean): string | null {
  const sp = arr.find((m) => m.ticker === "^GSPC") ?? maiorMovimento(arr.filter((m) => m.ticker !== "EWZ"));
  if (!sp) return null;
  const nome = sp.ticker === "^GSPC" ? "o S&P 500" : sp.praca;
  const onde = sp.ticker === "^GSPC" ? "em NY, " : "nas Américas, ";
  const pct = fmtSignedPct(sp.ret, 1);
  if (sp.ret > BANDA_ESTAVEL_PCT) return `${onde}${nome} ${passado ? "subiu" : "sobe"} ${pct}`;
  if (sp.ret < -BANDA_ESTAVEL_PCT) return `${onde}${nome} ${passado ? "caiu" : "cai"} ${pct}`;
  return `${onde}${nome} ${passado ? "fechou estável" : "opera estável"} (${pct})`;
}

/** Frase do Brasil (EWZ): destoa quando vai contra o tom do dia com movimento relevante. */
function fraseBrasil(ewz: Movimento | undefined, tom: TomDia, passado: boolean): string | null {
  if (!ewz) return null;
  const pct = `${fmtSignedPct(ewz.ret, 1)} via EWZ`;
  const relevante = Math.abs(ewz.ret) >= BRASIL_RELEVANTE_PCT;
  const contraTom =
    (tom === "risk-on" && ewz.ret <= -BRASIL_RELEVANTE_PCT) ||
    (tom === "risk-off" && ewz.ret >= BRASIL_RELEVANTE_PCT);
  if (contraTom) return `Entre os emergentes, o Brasil ${passado ? "destoou" : "destoa"} (${pct}).`;
  if (relevante && tom !== "misto") return `O Brasil ${passado ? "acompanhou" : "acompanha"} o tom (${pct}).`;
  if (relevante) {
    return `No Brasil, o EWZ ${ewz.ret > 0 ? (passado ? "subiu" : "sobe") : passado ? "caiu" : "cai"} ${fmtSignedPct(ewz.ret, 1)}.`;
  }
  return `O Brasil ${passado ? "passou" : "passa"} ao largo, perto da estabilidade (${pct}).`;
}

/**
 * Manchete do dia, gerada por regra a partir dos retornos 1d da cesta
 * intradiária. `hojeIso` = data de hoje em Brasília (ISO) — se o fechamento
 * mais recente for anterior, a prosa diz "no último fechamento" (honestidade).
 * Retorna null com menos de 6 índices válidos.
 */
export function buildMancheteDoDia(
  panorama: WorldIndicesReturnsPayload | null,
  hojeIso: string,
): MancheteDia | null {
  const rows = panorama?.by_period?.["1d"]?.data ?? [];

  const porRegiao: Record<RegiaoId, Movimento[]> = { americas: [], europa: [], asia: [] };
  let dataDado: string | null = null;
  let total = 0;

  for (const r of rows) {
    const meta = r?.ticker ? INDICES_MUNDO[r.ticker] : undefined;
    if (!meta || typeof r.return_pct !== "number" || !Number.isFinite(r.return_pct)) continue;
    porRegiao[meta.regiao].push({ ticker: r.ticker, praca: meta.praca, ret: r.return_pct });
    total += 1;
    if (typeof r.end_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.end_date)) {
      const iso = r.end_date.slice(0, 10);
      if (!dataDado || iso > dataDado) dataDado = iso;
    }
  }

  if (total < MIN_INDICES_MANCHETE) return null;

  // Tom: média das proporções de altas/baixas POR REGIÃO (regiões pesam igual).
  const regioesComDado = REGIOES.map((r) => porRegiao[r.id]).filter((arr) => arr.length > 0);
  const mediaProporcao = (teste: (ret: number) => boolean) =>
    regioesComDado.reduce((s, arr) => s + arr.filter((m) => teste(m.ret)).length / arr.length, 0) /
    regioesComDado.length;
  const propAltas = mediaProporcao((ret) => ret > BANDA_ESTAVEL_PCT);
  const propBaixas = mediaProporcao((ret) => ret < -BANDA_ESTAVEL_PCT);
  const tom: TomDia =
    propAltas >= TOM_PROPORCAO_MIN ? "risk-on" : propBaixas >= TOM_PROPORCAO_MIN ? "risk-off" : "misto";

  const fechamentoAnterior = dataDado != null && hojeIso > dataDado;
  const passado = fechamentoAnterior;

  // Lead: dia da semana DO DADO (não do acesso) + tom.
  const ts = dataDado != null ? parseIsoUTC(dataDado) : NaN;
  const diaSemana = Number.isFinite(ts) ? DIAS_SEMANA[new Date(ts).getUTCDay()] : null;
  const lead =
    fechamentoAnterior && dataDado != null
      ? `No último fechamento (${diaSemana ? `${diaSemana.toLowerCase().replace("-feira", "")}, ` : ""}${fmtDataBR(dataDado)}), o tom foi de ${TOM_TEXTO[tom]}:`
      : `${diaSemana ?? "Dia"} de ${TOM_TEXTO[tom]} nos mercados globais:`;

  // Ordem do sol: Ásia → Europa → Américas.
  const frases = [
    fraseAsia(porRegiao.asia),
    fraseEuropa(porRegiao.europa, passado),
    fraseAmericas(porRegiao.americas, passado),
  ].filter((f): f is string => f != null);

  const brasil = fraseBrasil(
    porRegiao.americas.find((m) => m.ticker === "EWZ"),
    tom,
    passado,
  );

  const texto = `${lead} ${frases.join("; ")}.${brasil ? ` ${brasil}` : ""}`;

  return { texto, tom, dataDado, fechamentoAnterior };
}

// ---------------------------------------------------------------------------
// Corrida do ano — título afirmativo a partir do YTD do catálogo diário
// ---------------------------------------------------------------------------

export type YtdRow = { ticker: string; nome: string; ytdPct: number };

/**
 * Retorno YTD (%) de cada série do histórico: último fechamento ÷ primeiro
 * fechamento DO ANO do último dado − 1. Séries sem ponto no ano ficam fora.
 */
export function computeYtdRows(history: HistorySlice): { ano: number | null; rows: YtdRow[] } {
  if (!history.lastDataDate) return { ano: null, rows: [] };
  const ano = Number(history.lastDataDate.slice(0, 4));
  const corteIso = `${ano}-01-01`;
  const rows: YtdRow[] = [];
  for (const s of history.series) {
    const first = s.data.find(([iso]) => iso >= corteIso);
    const last = s.data[s.data.length - 1];
    if (!first || !last || first[0] > last[0] || first[1] === 0) continue;
    const ytdPct = (last[1] / first[1] - 1) * 100;
    if (!Number.isFinite(ytdPct)) continue;
    rows.push({ ticker: s.ticker, nome: CORRIDA_NOMES[s.ticker] ?? s.label, ytdPct });
  }
  rows.sort((a, b) => b.ytdPct - a.ytdPct);
  return { ano, rows };
}

/**
 * Título afirmativo da corrida (regras, na ordem):
 *  1. Ibovespa na frente → "o Ibovespa lidera a corrida";
 *  2. líder no positivo + Ibovespa presente → "X lidera (+a%) e o Ibovespa
 *     corre por fora (+b%) / fica para trás (−b%)";
 *  3. todas no negativo → "nenhuma das grandes bolsas sobe: X cai menos";
 *  4. sem dado YTD → título neutro.
 */
export function buildTituloCorrida(history: HistorySlice): string {
  const { ano, rows } = computeYtdRows(history);
  if (ano == null || rows.length === 0) return "Corrida do ano — rebase 100";

  const lider = rows[0];
  const ibov = rows.find((r) => r.ticker === "^BVSP");
  const pctLider = fmtSignedPct(lider.ytdPct, 1);

  if (lider.ytdPct < 0) {
    return `Em ${ano}, nenhuma das grandes bolsas sobe: ${lider.nome} cai menos (${pctLider})`;
  }
  if (ibov && lider.ticker === "^BVSP") {
    return `Em ${ano}, o Ibovespa lidera a corrida (${pctLider}) entre as grandes bolsas`;
  }
  if (ibov) {
    const pctIbov = fmtSignedPct(ibov.ytdPct, 1);
    const posIbov = rows.findIndex((r) => r.ticker === "^BVSP");
    const verbo =
      posIbov === 1 ? "vem logo atrás" : ibov.ytdPct >= 0 ? "corre por fora" : "fica para trás";
    return `Em ${ano}, ${lider.nome} lidera (${pctLider}) e o Ibovespa ${verbo} (${pctIbov})`;
  }
  return `Em ${ano}, ${lider.nome} lidera a corrida (${pctLider})`;
}

// ---------------------------------------------------------------------------
// Termômetro de valuation — leitura de uma linha dos z-scores
// ---------------------------------------------------------------------------

/**
 * Uma linha sobre o valuation americano a partir dos z-scores das réguas
 * longas (CAPE de Shiller e indicador Buffett — o P/L do SPY não tem média
 * histórica longa no payload). Régua principal = maior |z|; a outra entra
 * como contraponto. Faixas: |z| ≥ 2 "território raro" · 1–2 "caro/desconto
 * pelas réguas longas" · < 1 "perto da média". null sem z válido.
 */
export function buildLeituraValuation(valuation: GlobalValuationPayload | null): string | null {
  const candidatos = [
    { nome: "CAPE de Shiller", z: valuation?.cape?.stats?.current_z },
    { nome: "indicador Buffett", z: valuation?.buffett?.stats?.current_z },
  ].filter((c): c is { nome: string; z: number } => typeof c.z === "number" && Number.isFinite(c.z));

  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const [principal, outro] = candidatos;

  const zAbs = `${fmtNum(Math.abs(principal.z), 1)}σ`;
  let frase: string;
  if (principal.z >= 2) {
    frase = `A bolsa americana negocia ${zAbs} acima da média histórica no ${principal.nome} — território raro`;
  } else if (principal.z >= 1) {
    frase = `A bolsa americana negocia ${zAbs} acima da média histórica no ${principal.nome} — cara pelas réguas longas`;
  } else if (principal.z <= -2) {
    frase = `A bolsa americana negocia ${zAbs} abaixo da média histórica no ${principal.nome} — desconto raro`;
  } else if (principal.z <= -1) {
    frase = `A bolsa americana negocia ${zAbs} abaixo da média histórica no ${principal.nome} — barata pelas réguas longas`;
  } else {
    frase = `A bolsa americana negocia perto da média histórica (${fmtSignedNum(principal.z, 1)}σ no ${principal.nome}) — sem sinal extremo de valuation`;
  }

  const contraponto = outro ? `; o ${outro.nome} aponta ${fmtSignedNum(outro.z, 1)}σ` : "";
  return `${frase}${contraponto}.`;
}
