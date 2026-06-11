/**
 * Metadados do "mundo" da página de Índices globais (sem JSX, server-safe):
 *  - mapa ticker → região / bandeira / nome de praça (prosa da manchete);
 *  - praças do Relógio dos Mercados com horário FIXO de pregão local + IANA tz;
 *  - nomes de prosa do título da "Corrida do ano".
 *
 * A cesta segue o pipeline (data-pipeline/python/build_world_indices_returns.py,
 * 16 índices). Se o pipeline ganhar índice novo, adicione aqui também — ticker
 * desconhecido degrada com honestidade (fica fora da manchete e das regiões).
 */

export type RegiaoId = "americas" | "europa" | "asia";

export const REGIOES: { id: RegiaoId; label: string; descricao: string }[] = [
  {
    id: "americas",
    label: "Américas",
    descricao: "NY dá o tom; o Brasil entra via EWZ (ETF em US$ listado em NY).",
  },
  {
    id: "europa",
    label: "Europa",
    descricao: "Londres, Frankfurt, Zurique e Madri — o meio do dia global.",
  },
  {
    id: "asia",
    label: "Ásia-Pacífico",
    descricao: "Onde o dia dos mercados começa: de Tóquio a Mumbai.",
  },
];

export type IndiceMundo = {
  regiao: RegiaoId;
  /** Código ISO-3166 minúsculo p/ flagcdn (mesmo padrão do FlagYTick do MarketsPanel). */
  flag: string;
  /** País/economia curto p/ rótulos ("EUA", "Hong Kong"). */
  pais: string;
  /** Nome curto do índice ("S&P 500"). */
  indice: string;
  /** Nome de PRAÇA usado na prosa da manchete ("Tóquio", "Frankfurt"). */
  praca: string;
};

/** Cesta intradiária do panorama (16 índices) — chave = ticker Yahoo. */
export const INDICES_MUNDO: Record<string, IndiceMundo> = {
  // Américas
  "^GSPC": { regiao: "americas", flag: "us", pais: "EUA", indice: "S&P 500", praca: "NY" },
  "^MXX": { regiao: "americas", flag: "mx", pais: "México", indice: "IPC", praca: "Cidade do México" },
  "^MERV": { regiao: "americas", flag: "ar", pais: "Argentina", indice: "Merval", praca: "Buenos Aires" },
  GXG: { regiao: "americas", flag: "co", pais: "Colômbia", indice: "GXG", praca: "Bogotá" },
  EWZ: { regiao: "americas", flag: "br", pais: "Brasil", indice: "EWZ", praca: "o Brasil" },
  // Europa
  "^FTSE": { regiao: "europa", flag: "gb", pais: "Reino Unido", indice: "FTSE 100", praca: "Londres" },
  "^GDAXI": { regiao: "europa", flag: "de", pais: "Alemanha", indice: "DAX", praca: "Frankfurt" },
  "^SSMI": { regiao: "europa", flag: "ch", pais: "Suíça", indice: "SMI", praca: "Zurique" },
  "^IBEX": { regiao: "europa", flag: "es", pais: "Espanha", indice: "IBEX 35", praca: "Madri" },
  // Ásia-Pacífico
  "^N225": { regiao: "asia", flag: "jp", pais: "Japão", indice: "Nikkei 225", praca: "Tóquio" },
  "^HSI": { regiao: "asia", flag: "hk", pais: "Hong Kong", indice: "Hang Seng", praca: "Hong Kong" },
  "000001.SS": { regiao: "asia", flag: "cn", pais: "China", indice: "SSE Composite", praca: "Xangai" },
  "^KS11": { regiao: "asia", flag: "kr", pais: "Coreia do Sul", indice: "KOSPI", praca: "Seul" },
  "^TWII": { regiao: "asia", flag: "tw", pais: "Taiwan", indice: "TAIEX", praca: "Taipé" },
  "^STI": { regiao: "asia", flag: "sg", pais: "Singapura", indice: "STI", praca: "Singapura" },
  "^NSEI": { regiao: "asia", flag: "in", pais: "Índia", indice: "Nifty 50", praca: "Mumbai" },
};

// ---------------------------------------------------------------------------
// Relógio dos Mercados — horários FIXOS de pregão local (sem API)
// ---------------------------------------------------------------------------

export type PracaRelogio = {
  id: string;
  cidade: string;
  /** Nome do índice de referência exibido sob a cidade. */
  indice: string;
  flag: string;
  /** Ticker da cesta intradiária cujo retorno 1d colore a praça. */
  ticker: string;
  /** IANA timezone — o status "agora" é via Intl, no client. */
  tz: string;
  /**
   * Sessões do pregão em MINUTOS locais [início, fim) — Tóquio e Hong Kong
   * têm pausa de almoço (duas sessões). Horários regulares assumidos:
   * TSE 09:00–11:30/12:30–15:30 · HKEX 09:30–12:00/13:00–16:00 ·
   * NSE 09:15–15:30 · Xetra 09:00–17:30 · LSE 08:00–16:30 · NYSE 09:30–16:00.
   * NÃO considera feriados locais nem leilões de abertura/fechamento.
   */
  sessoes: Array<[number, number]>;
};

const h = (hh: number, mm: number) => hh * 60 + mm;

/** Ordem fixa: o dia segue o sol — Tóquio → Hong Kong → Mumbai → Frankfurt → Londres → NY. */
export const PRACAS_RELOGIO: PracaRelogio[] = [
  {
    id: "toquio",
    cidade: "Tóquio",
    indice: "Nikkei 225",
    flag: "jp",
    ticker: "^N225",
    tz: "Asia/Tokyo",
    sessoes: [
      [h(9, 0), h(11, 30)],
      [h(12, 30), h(15, 30)],
    ],
  },
  {
    id: "hong-kong",
    cidade: "Hong Kong",
    indice: "Hang Seng",
    flag: "hk",
    ticker: "^HSI",
    tz: "Asia/Hong_Kong",
    sessoes: [
      [h(9, 30), h(12, 0)],
      [h(13, 0), h(16, 0)],
    ],
  },
  {
    id: "mumbai",
    cidade: "Mumbai",
    indice: "Nifty 50",
    flag: "in",
    ticker: "^NSEI",
    tz: "Asia/Kolkata",
    sessoes: [[h(9, 15), h(15, 30)]],
  },
  {
    id: "frankfurt",
    cidade: "Frankfurt",
    indice: "DAX",
    flag: "de",
    ticker: "^GDAXI",
    tz: "Europe/Berlin",
    sessoes: [[h(9, 0), h(17, 30)]],
  },
  {
    id: "londres",
    cidade: "Londres",
    indice: "FTSE 100",
    flag: "gb",
    ticker: "^FTSE",
    tz: "Europe/London",
    sessoes: [[h(8, 0), h(16, 30)]],
  },
  {
    id: "nova-york",
    cidade: "Nova York",
    indice: "S&P 500",
    flag: "us",
    ticker: "^GSPC",
    tz: "America/New_York",
    sessoes: [[h(9, 30), h(16, 0)]],
  },
];

// ---------------------------------------------------------------------------
// Corrida do ano — nomes de prosa do catálogo diário (market_history_full)
// ---------------------------------------------------------------------------

/** Nome com artigo p/ títulos afirmativos ("o Hang Seng (Hong Kong) lidera..."). */
export const CORRIDA_NOMES: Record<string, string> = {
  "^GSPC": "o S&P 500",
  "^IXIC": "o Nasdaq",
  "^DJI": "o Dow Jones",
  "^STOXX50E": "o Euro Stoxx 50",
  "^FTSE": "o FTSE 100 (Londres)",
  "^N225": "o Nikkei (Tóquio)",
  "^BVSP": "o Ibovespa",
  "^HSI": "o Hang Seng (Hong Kong)",
  "000001.SS": "Xangai",
};
