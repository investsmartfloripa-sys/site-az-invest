/**
 * Feed intraday (delayed ~15 min) da API publica de cotacoes da B3.
 *
 * Endpoint: https://cotacao.b3.com.br/mds/api/v1/DerivativeQuotation/{codigo}
 * - E o mesmo servico que alimenta o widget de cotacoes do site da B3.
 * - CORS aberto: o fetch e feito NO BROWSER do visitante (client component),
 *   nunca no servidor — de datacenter o CDN da B3 pode servir cache velho.
 * - Nao e documentado oficialmente: todo consumidor DEVE degradar com
 *   graciosidade para os dados D-1 do pipeline (TaxaSwap/ajuste) se o
 *   formato mudar ou o fetch falhar.
 */

export const B3_LIVE_BASE = "https://cotacao.b3.com.br/mds/api/v1/DerivativeQuotation";

/** Cotacao de um contrato no payload da B3 (campos que usamos). */
type B3Security = {
  symb?: string;
  desc?: string;
  mkt?: { cd?: string };
  SctyQtn?: {
    curPrc?: number;
    prvsDayAdjstmntPric?: number;
    opngPric?: number;
    minPric?: number;
    maxPric?: number;
    avrgPric?: number;
  };
  buyOffer?: { price?: number };
  sellOffer?: { price?: number };
  asset?: {
    AsstSummry?: {
      mtrtyCode?: string;
      opnCtrcts?: number;
      tradQty?: number;
      traddCtrctsQty?: number;
      grssAmt?: number;
    };
  };
};

type B3Payload = {
  BizSts?: { cd?: string };
  Msg?: { dtTm?: string };
  Scty?: B3Security[];
};

export type LiveContract = {
  /** Ex.: DI1F27 */
  symbol: string;
  /** Data de vencimento ISO (yyyy-mm-dd). */
  maturity: string;
  /** Ultima taxa negociada (% a.a.); null se nao negociou hoje. */
  last: number | null;
  /** Ajuste do dia anterior (% a.a.). */
  prevAdjust: number | null;
  /** Melhor compra/venda (% a.a.). */
  bid: number | null;
  ask: number | null;
  open: number | null;
  low: number | null;
  high: number | null;
  /** Contratos em aberto. */
  openInterest: number;
  /** Numero de negocios no dia. */
  trades: number;
  /** Taxa de referencia: last, senao mid bid/ask, senao null. */
  rate: number | null;
  /** Variacao do dia em bps vs ajuste D-1 (null se faltar perna). */
  changeBps: number | null;
};

export type LiveCurve = {
  /** Timestamp informado pela B3 (ex.: "2026-06-04 13:36:58"). */
  quotedAt: string | null;
  /** True se quotedAt cai no dia corrente (pregao de hoje). */
  isToday: boolean;
  contracts: LiveContract[];
};

function toNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseSecurity(s: B3Security): LiveContract | null {
  const symbol = s.symb ?? "";
  const maturity = s.asset?.AsstSummry?.mtrtyCode ?? "";
  // Descarta o registro "SPOT" (DI1D, vencimento 9999) e lixo sem vencimento.
  if (!symbol || !maturity || maturity.startsWith("9999") || s.mkt?.cd !== "FUT") return null;

  const last = toNum(s.SctyQtn?.curPrc);
  const bid = toNum(s.buyOffer?.price);
  const ask = toNum(s.sellOffer?.price);
  const prevAdjust = toNum(s.SctyQtn?.prvsDayAdjstmntPric);

  const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
  const rate = last ?? mid;

  return {
    symbol,
    maturity,
    last,
    prevAdjust,
    bid,
    ask,
    open: toNum(s.SctyQtn?.opngPric),
    low: toNum(s.SctyQtn?.minPric),
    high: toNum(s.SctyQtn?.maxPric),
    openInterest: toNum(s.asset?.AsstSummry?.opnCtrcts) ?? 0,
    trades: toNum(s.asset?.AsstSummry?.tradQty) ?? 0,
    rate,
    changeBps: rate != null && prevAdjust != null ? Math.round((rate - prevAdjust) * 100) : null,
  };
}

/** Compara apenas a parte de data (fuso de SP ~ suficiente para badge ao vivo/fechamento). */
function isSameDayAsNow(dtTm: string): boolean {
  const d = dtTm.slice(0, 10);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return d === today;
}

/**
 * Busca e normaliza a curva de um derivativo (DI1, DAP, ...).
 * Lanca em rede/HTTP errado; retorna contratos ordenados por vencimento.
 */
export async function fetchLiveCurve(code: string, signal?: AbortSignal): Promise<LiveCurve> {
  const res = await fetch(`${B3_LIVE_BASE}/${encodeURIComponent(code)}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`B3 live HTTP ${res.status}`);
  const json = (await res.json()) as B3Payload;
  if (json?.BizSts?.cd !== "OK" || !Array.isArray(json.Scty)) {
    throw new Error("B3 live payload inesperado");
  }

  const contracts = json.Scty.map(parseSecurity)
    .filter((c): c is LiveContract => c != null)
    .sort((a, b) => a.maturity.localeCompare(b.maturity));

  const quotedAt = json.Msg?.dtTm ?? null;
  return {
    quotedAt,
    isToday: quotedAt ? isSameDayAsNow(quotedAt) : false,
    contracts,
  };
}

type B3InstrumentPayload = {
  BizSts?: { cd?: string };
  Msg?: { dtTm?: string };
  Trad?: { scty?: { symb?: string; SctyQtn?: { curPrc?: number; prcFlcn?: number; opngPric?: number; minPric?: number; maxPric?: number } } }[];
};

export type LiveIndexQuote = {
  symbol: string;
  /** Nivel atual (pontos). */
  last: number;
  /** Variacao % do dia informada pela B3 (prcFlcn). */
  changePct: number | null;
  low: number | null;
  high: number | null;
  quotedAt: string | null;
  isToday: boolean;
};

/**
 * Cotacao intraday de instrumento/indice (ex.: IBOV) — delayed ~15 min.
 * Mesmo servico do widget da B3; client-side only (ver header do arquivo).
 */
export async function fetchIndexQuote(symbol: string, signal?: AbortSignal): Promise<LiveIndexQuote | null> {
  const res = await fetch(`${B3_LIVE_BASE.replace("DerivativeQuotation", "InstrumentQuotation")}/${encodeURIComponent(symbol)}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`B3 instrument HTTP ${res.status}`);
  const json = (await res.json()) as B3InstrumentPayload;
  const qtn = json?.Trad?.[0]?.scty?.SctyQtn;
  if (json?.BizSts?.cd !== "OK" || !qtn || typeof qtn.curPrc !== "number") return null;
  const quotedAt = json.Msg?.dtTm ?? null;
  return {
    symbol,
    last: qtn.curPrc,
    changePct: typeof qtn.prcFlcn === "number" ? qtn.prcFlcn : null,
    low: typeof qtn.minPric === "number" ? qtn.minPric : null,
    high: typeof qtn.maxPric === "number" ? qtn.maxPric : null,
    quotedAt,
    isToday: quotedAt ? isSameDayAsNow(quotedAt) : false,
  };
}

/** Rotulo curto pt-BR de vencimento: "jan/27". */
export function maturityLabel(maturityIso: string): string {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = maturityIso.split("-");
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return maturityIso;
  return `${months[mi]}/${y.slice(2)}`;
}

/**
 * Interpola (linear em dias corridos) a taxa da curva em uma data alvo.
 * Aproximacao editorial — nao substitui interpolacao em DU/flat-forward.
 */
export function interpolateRate(
  contracts: LiveContract[],
  targetIso: string,
): number | null {
  const pts = contracts
    .filter((c) => c.rate != null)
    .map((c) => ({ t: Date.parse(c.maturity), r: c.rate as number }))
    .sort((a, b) => a.t - b.t);
  if (pts.length === 0) return null;

  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) return null;
  if (target <= pts[0].t) return pts[0].r;
  if (target >= pts[pts.length - 1].t) return pts[pts.length - 1].r;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (target >= a.t && target <= b.t) {
      const w = (target - a.t) / (b.t - a.t);
      return a.r + w * (b.r - a.r);
    }
  }
  return null;
}
