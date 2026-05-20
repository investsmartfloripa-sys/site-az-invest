/**
 * Loaders dos JSONs das rotas /painel-economico/economia/brasil/atividade/*.
 */

import { painelBlobUrl } from "@/lib/painel-blob";

export const ATIVIDADE_REVALIDATE_SECONDS = 86400; // 24h

type NumOrNull = number | null;
export type AtividadeMetadata = { fonte?: string; fonte_principal?: string; fonte_focus?: string; nota: string };

// PIB
export type PibVariacaoPonto = Record<string, NumOrNull | string> & { trim: string };
export type PibIndicePonto = { trim: string; idx_sa_pib: NumOrNull; idx_ns_pib: NumOrNull };
export type PibContasPonto = Record<string, NumOrNull | string> & { trim: string };
export type FocusPonto = { data: string; mediana: NumOrNull; media: NumOrNull; dp: NumOrNull; min: NumOrNull; max: NumOrNull };

export type AtividadePibData = {
  gerado_em: string;
  trim_recente: string;
  variacao: { serie: PibVariacaoPonto[] };
  indice_volume: { serie: PibIndicePonto[] };
  contas_economicas: { serie: PibContasPonto[] };
  focus: Record<string, FocusPonto[]>;
  metadata: AtividadeMetadata;
};

// IBC-Br
export type IbcBrPonto = {
  mes: string;
  indice_sa: NumOrNull;
  indice_ns: NumOrNull;
  var_mom: NumOrNull;
  var_yoy: NumOrNull;
  indice_sa_mm3: NumOrNull;
};

export type AtividadeIbcBrData = {
  gerado_em: string;
  mes_recente: string;
  serie: IbcBrPonto[];
  metadata: AtividadeMetadata;
};

// PIM
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
export type PimAtividadeRanking = { atividade: string; var_yoy: number };

export type AtividadePimData = {
  gerado_em: string;
  mes_recente: string;
  geral: { serie: PimGeralPonto[] };
  secoes: { categorias: string[]; serie: PimSecoesPonto[] };
  categorias_economicas: { categorias: string[]; serie: PimCategoriasPonto[] };
  atividades_detalhe: { mes: string; top_altas: PimAtividadeRanking[]; top_quedas: PimAtividadeRanking[] };
  metadata: AtividadeMetadata;
};

// PMC
export type PmcPonto = Record<string, NumOrNull | string> & { mes: string };
export type PmcAtividadeRanking = { atividade: string; var_yoy: number };

export type AtividadePmcData = {
  gerado_em: string;
  mes_recente: string;
  serie: PmcPonto[];
  atividades: {
    mes: string;
    restrito_top_altas: PmcAtividadeRanking[];
    restrito_top_quedas: PmcAtividadeRanking[];
    ampliado_top_altas: PmcAtividadeRanking[];
    ampliado_top_quedas: PmcAtividadeRanking[];
  };
  metadata: AtividadeMetadata;
};

// PMS
export type PmsPonto = Record<string, NumOrNull | string> & { mes: string };
export type PmsCategoriaRanking = { categoria: string; var_yoy: number };

export type AtividadePmsData = {
  gerado_em: string;
  mes_recente: string;
  serie: PmsPonto[];
  segmentos: { mes: string; top_altas: PmsCategoriaRanking[]; top_quedas: PmsCategoriaRanking[] };
  atividades: { mes: string; top_altas: PmsCategoriaRanking[]; top_quedas: PmsCategoriaRanking[] };
  metadata: AtividadeMetadata;
};

// Loaders
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

// Helpers
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
  { label: "5 anos", n: 60 },
  { label: "10 anos", n: 120 },
  { label: "Desde início", n: Number.MAX_SAFE_INTEGER },
] as const;

export const HORIZONTES_TRIMESTRAIS = [
  { label: "4T", n: 4 },
  { label: "12T (3 anos)", n: 12 },
  { label: "20T (5 anos)", n: 20 },
  { label: "40T (10 anos)", n: 40 },
  { label: "Desde início", n: Number.MAX_SAFE_INTEGER },
] as const;
