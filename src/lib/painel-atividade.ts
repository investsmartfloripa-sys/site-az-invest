/**
 * Loaders dos JSONs das rotas /painel-economico/economia/brasil/atividade/*.
 */

import { painelBlobUrl } from "@/lib/painel-blob";

export const ATIVIDADE_REVALIDATE_SECONDS = 86400;

type NumOrNull = number | null;
export type AtividadeMetadata = { fonte?: string; fonte_principal?: string; fonte_focus?: string; nota: string };

// --- PIB ---
export type PibVariacaoPonto = Record<string, NumOrNull | string> & { trim: string };
export type PibIndicePonto = Record<string, NumOrNull | string> & { trim: string };
export type PibValoresPonto = Record<string, NumOrNull | string> & { trim: string };
export type PibContasPonto = Record<string, NumOrNull | string> & { trim: string };
export type FocusPonto = { data: string; mediana: NumOrNull; media: NumOrNull; dp: NumOrNull; min: NumOrNull; max: NumOrNull };

/** Contribuição ao crescimento YoY (v2): chaves oferta_* e demanda_* em p.p. */
export type PibContribPonto = Record<string, NumOrNull | string> & { trim: string; pib_yoy: number };

export type PibCarrego = { ano: number; valor: number; trimestres_divulgados: number } | null;

export type PibPerCapitaPonto = {
  ano: string;
  per_capita_nominal: NumOrNull;
  var_real_per_capita: NumOrNull;
  var_real_pib: NumOrNull;
  populacao_mil: NumOrNull;
};

export type AtividadePibData = {
  schema_version?: number;
  gerado_em: string;
  trim_recente: string;
  variacao: { serie: PibVariacaoPonto[] };
  indice_volume: { serie: PibIndicePonto[] };
  valores_correntes?: { serie: PibValoresPonto[] };
  contas_economicas: { serie: PibContasPonto[] };
  pesos_atuais?: Record<string, number>;
  labels?: Record<string, string>;
  focus: Record<string, FocusPonto[]>;
  // v2
  contribuicoes?: { serie: PibContribPonto[] };
  carrego?: PibCarrego;
  per_capita?: { serie: PibPerCapitaPonto[] };
  metadata: AtividadeMetadata;
};

// --- IBC-Br ---
export type IbcBrPonto = {
  mes: string;
  indice_sa: NumOrNull;
  indice_ns: NumOrNull;
  var_mom: NumOrNull;
  /** v2: calculada sobre o índice NS (convenção oficial). */
  var_yoy: NumOrNull;
  var_3m: NumOrNull;
  indice_sa_mm3: NumOrNull;
  var_yoy_mm3: NumOrNull;
  /** v2: mm3 do índice SA vs mm3 três meses antes, anualizada (3m/3m SAAR). */
  var_3m3m_saar?: NumOrNull;
  /** v2: a mesma razão SEM anualizar — "ritmo trimestral" (convenção BCB RI/IBGE). */
  var_ritmo_trimestral?: NumOrNull;
};

export type AtividadeIbcBrData = {
  schema_version?: number;
  gerado_em: string;
  mes_recente: string;
  serie: IbcBrPonto[];
  heatmap?: { anos: string[]; valores: Record<string, (number | null)[]> };
  medias_anuais?: { ano: string; media: number; n: number }[];
  metadata: AtividadeMetadata;
};

// --- PIM ---
export type PimGeralPonto = {
  mes: string;
  var_mom_sa: NumOrNull;
  var_yoy: NumOrNull;
  var_acum_ano: NumOrNull;
  var_acum_12m: NumOrNull;
  indice: NumOrNull;
  indice_sa: NumOrNull;
};

export type PimSecoesPonto = Record<string, NumOrNull | string> & { mes: string };
export type PimCategoriasPonto = Record<string, NumOrNull | string> & { mes: string };

export type PimAtividadeItem = {
  id: string;
  atividade: string;
  var_yoy: NumOrNull;
  var_mom_sa: NumOrNull;
  var_acum_12m: NumOrNull;
  indice_sa: NumOrNull;
};

/** v2: difusão por atividades (cálculo próprio — % de atividades em alta). */
export type PimDifusaoPonto = { mes: string; pct: number; n: number; criterio: "mom_sa" | "yoy"; pct_mm3: NumOrNull };

export type AtividadePimData = {
  schema_version?: number;
  gerado_em: string;
  mes_recente: string;
  geral: { serie: PimGeralPonto[] };
  secoes: { categorias: string[]; serie: PimSecoesPonto[] };
  categorias_economicas: { categorias: string[]; serie: PimCategoriasPonto[] };
  atividades: {
    mes_recente: string;
    serie_mensal: Record<string, PimAtividadeItem[]>;
  };
  construcao?: { serie: PimGeralPonto[] };
  indicadores_especiais?: {
    labels: Record<string, string>;
    categorias_ids: string[];
    serie: Record<string, NumOrNull | string>[];
  };
  // v2
  difusao?: { serie: PimDifusaoPonto[] };
  picos?: Record<string, { mes: string; indice_sa: number }>;
  metadata: AtividadeMetadata;
};

// --- PMC ---
export type PmcPonto = Record<string, NumOrNull | string> & { mes: string };

export type PmcAtividadeItem = {
  id: string;
  atividade: string;
  var_yoy: NumOrNull;
  var_mom_sa: NumOrNull;
  var_acum_12m: NumOrNull;
  indice_sa: NumOrNull;
};

export type AtividadePmcData = {
  /** v2 também adiciona restrito_deflator_yoy / ampliado_deflator_yoy em cada PmcPonto. */
  schema_version?: number;
  gerado_em: string;
  mes_recente: string;
  serie: PmcPonto[];
  atividades: {
    mes_recente: string;
    restrito_mensal: Record<string, PmcAtividadeItem[]>;
    ampliado_mensal: Record<string, PmcAtividadeItem[]>;
  };
  metadata: AtividadeMetadata;
};

// --- PMS ---
export type PmsPonto = Record<string, NumOrNull | string> & { mes: string };

export type PmsCategoriaItem = {
  id: string;
  categoria: string;
  var_yoy: NumOrNull;
  var_mom_sa: NumOrNull;
  var_acum_12m: NumOrNull;
  indice_sa: NumOrNull;
};

export type AtividadePmsData = {
  schema_version?: number;
  gerado_em: string;
  mes_recente: string;
  serie: PmsPonto[];
  segmentos: {
    mes_recente: string;
    serie_mensal: Record<string, PmsCategoriaItem[]>;
  };
  atividades: {
    mes_recente: string;
    serie_mensal: Record<string, PmsCategoriaItem[]>;
  };
  turismo?: { serie: PmsPonto[] };
  transportes?: { labels_transportes: Record<string, string>; serie: PmsPonto[] };
  metadata: AtividadeMetadata;
};

// --- Loaders ---
async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: ATIVIDADE_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadAtividadePib(): Promise<AtividadePibData | null> {
  return fetchBlobJson<AtividadePibData>("data/atividade_pib.json");
}
export async function loadAtividadeIbcBr(): Promise<AtividadeIbcBrData | null> {
  return fetchBlobJson<AtividadeIbcBrData>("data/atividade_ibcbr.json");
}
export async function loadAtividadePim(): Promise<AtividadePimData | null> {
  return fetchBlobJson<AtividadePimData>("data/atividade_pim.json");
}
export async function loadAtividadePmc(): Promise<AtividadePmcData | null> {
  return fetchBlobJson<AtividadePmcData>("data/atividade_pmc.json");
}
export async function loadAtividadePms(): Promise<AtividadePmsData | null> {
  return fetchBlobJson<AtividadePmsData>("data/atividade_pms.json");
}

/** Cronologia CODACE (recessões) — para sombrear séries com 5+ anos. */
export type CodaceFaixaAtividade = { pico: string; vale: string; tipo: string };
export type AtividadeCodaceData = {
  gerado_em: string;
  trimestral: CodaceFaixaAtividade[];
  mensal: CodaceFaixaAtividade[];
};

export async function loadAtividadeCodace(): Promise<AtividadeCodaceData | null> {
  return fetchBlobJson<AtividadeCodaceData>("data/visao_geral_codace.json");
}

// --- Helpers ---
export function formatTrim(trim: string): string {
  const m = trim.match(/^(\d{4})-T(\d{1,2})$/);
  if (!m) return trim;
  return `${parseInt(m[2], 10)}T${m[1]}`;
}

export function formatMes(mes: string): string {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return mes;
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const idx = parseInt(m[2], 10) - 1;
  return `${meses[idx] ?? m[2]}/${m[1]}`;
}

export function tail<T>(serie: T[], n: number): T[] {
  if (n >= serie.length) return serie;
  return serie.slice(serie.length - n);
}

export const HORIZONTES_MENSAIS = [
  { label: "12m", n: 12 },
  { label: "24m", n: 24 },
  { label: "36m", n: 36 },
  { label: "5 anos", n: 60 },
  { label: "Tudo", n: Number.MAX_SAFE_INTEGER },
] as const;

export const HORIZONTES_TRIMESTRAIS = [
  { label: "4T", n: 4 },
  { label: "12T (3 anos)", n: 12 },
  { label: "20T (5 anos)", n: 20 },
  { label: "40T (10 anos)", n: 40 },
  { label: "Tudo", n: Number.MAX_SAFE_INTEGER },
] as const;

// Labels canônicos das classificações do PIB (caso o JSON não traga)
export const LABELS_PIB_FALLBACK: Record<string, string> = {
  agro: "Agropecuária",
  industria: "Indústria total",
  industria_extrativa: "Indústria extrativa",
  industria_transformacao: "Indústria de transformação",
  construcao: "Construção",
  eletricidade_gas: "Eletricidade, gás e água",
  servicos: "Serviços total",
  comercio: "Comércio",
  transporte: "Transporte e armazenagem",
  informacao: "Informação e comunicação",
  financeiras: "Atividades financeiras",
  outros_servicos: "Outros serviços",
  imobiliarias: "Atividades imobiliárias",
  admin_publica: "Admin, saúde, educação públicas",
  valor_adicionado: "Valor adicionado a preços básicos",
  impostos: "Impostos líquidos sobre produtos",
  pib: "PIB a preços de mercado",
  consumo_familias: "Consumo das famílias",
  consumo_governo: "Consumo do governo",
  fbcf: "FBCF (investimento)",
  exportacoes: "Exportações",
  importacoes: "Importações",
};
