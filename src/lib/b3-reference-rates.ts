/**
 * ETTJ oficial da B3 — "Taxas Referenciais BM&FBOVESPA" (server-side).
 *
 * CONTEXTO (04/08/2026): a B3 desligou o feed intraday publico. O host
 * `cotacao.b3.com.br` responde HTTP 520 em TODA a origem (inclusive rotas
 * inexistentes), de qualquer rede e regiao — nao e mudanca de API nem queda de
 * PoP. A propria pagina de Cotacoes virou um aviso de desativacao, citando o
 * Comunicado Externo 001/2026-VTEC, que migrou os dados publicos para o Boletim
 * Diario do Mercado. Nao existe substituto gratuito INTRADAY: agregadores
 * (Yahoo, brapi, Stooq) nao carregam derivativo nenhum da B3 — nem mini-indice,
 * nem mini-dolar — porque o segmento BM&F e licenciado a parte do segmento
 * Listado (acoes), que eles redistribuem.
 *
 * Esta API e o que restou de oficial, gratuito e estruturado para a CURVA: e a
 * mesma familia do "TaxaSwap" que ja alimenta os cortes D-30/D-90 do pipeline R,
 * publicada por pregao. Durante o dia, a data mais recente e a do pregao
 * anterior — por isso as series daqui sao rotuladas D-1 no painel.
 *
 * IMPORTANTE: o endpoint NAO envia cabecalhos CORS, entao so pode ser chamado
 * do SERVIDOR (verificado: sem `access-control-allow-origin` na resposta).
 */

const BASE = "https://sistemaswebb3-derivativos.b3.com.br/referenceRatesProxy/Search";

/** Navegador real: a B3 recusa alguns user-agents de biblioteca. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * Produtos usados no painel (ha outros no catalogo: ACC, DOC, DOL, TR...).
 * - PRE = "DI x pre"   → curva prefixada
 * - DIC = "DI x IPCA"  → curva de juro real (IPCA+)
 */
export type B3CurveId = "PRE" | "DIC";

export type B3CurvePoint = {
  /** Vencimento ISO (yyyy-mm-dd), derivado do prazo em dias corridos. */
  maturity: string;
  /** Taxa % a.a. (base 252 du). */
  rate: number;
};

export type B3ReferenceCurve = {
  /** Data do pregao de referencia (ISO). */
  date: string;
  points: B3CurvePoint[];
};

/** Os parametros da B3 viajam como base64 de um JSON na propria URL. */
function encodeParams(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: { "User-Agent": UA, Referer: "https://sistemaswebb3-derivativos.b3.com.br/" },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Fonte externa: qualquer falha degrada para "sem D-1" (o painel segue com D-30/D-90).
    return null;
  }
}

/** Soma dias corridos a uma data ISO, em UTC (evita salto por fuso/horario de verao). */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "14,15" → 14.15. Retorna null para vazio/invalido. */
function parseRate(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const n = Number(raw.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type GetListResponse = {
  results?: { day252?: number; day360?: number; rate?: string | number }[];
};

/**
 * Curva de referencia mais recente publicada pela B3 para o produto.
 *
 * Dois saltos, como o proprio site da B3 faz: `GetDate` devolve os pregoes
 * disponiveis (mais recente primeiro) e `GetList` a curva daquele pregao.
 * O vencimento de cada vertice sai de `day360` (dias corridos) somado a data
 * de referencia — `day252` e o prazo em dias uteis, base da taxa.
 */
/**
 * `revalidate` de 15 min: a ETTJ vira UMA vez por dia, mas so no fim da noite
 * (em 04/08/2026 a curva do dia apareceu por volta das 19h40). Com 1 hora de
 * cache o painel ficava ate 60 min anunciando o pregao anterior depois da
 * publicacao — e, pior, as curvas PRE e DIC revalidavam em momentos diferentes
 * e o bloco exibia duas datas ao mesmo tempo. 15 min encurta essa janela sem
 * pesar na fonte (~96 chamadas/dia).
 */
export async function fetchB3ReferenceCurve(
  id: B3CurveId,
  revalidate = 900,
): Promise<B3ReferenceCurve | null> {
  const dates = await getJson<string[]>(
    `GetDate/${encodeParams({ language: "pt-br", id })}`,
    revalidate,
  );
  const date = dates?.[0]?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const list = await getJson<GetListResponse>(
    `GetList/${encodeParams({ language: "pt-br", id, date })}`,
    revalidate,
  );
  const rows = list?.results;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Um vencimento por data: se dois vertices caem no mesmo dia corrido, o
  // primeiro (prazo menor em du) prevalece.
  const byMaturity = new Map<string, number>();
  for (const r of rows) {
    const rate = parseRate(r?.rate);
    const dc = typeof r?.day360 === "number" ? r.day360 : null;
    if (rate == null || dc == null || dc < 0) continue;
    const maturity = addDays(date, dc);
    if (!byMaturity.has(maturity)) byMaturity.set(maturity, rate);
  }
  if (byMaturity.size === 0) return null;

  const points = [...byMaturity.entries()]
    .map(([maturity, rate]) => ({ maturity, rate }))
    .sort((a, b) => a.maturity.localeCompare(b.maturity));

  return { date, points };
}

/** Rotulo pt-BR da data de referencia: "03/08/2026". */
export function refDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
