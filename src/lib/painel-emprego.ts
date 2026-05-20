/**
 * Loaders dos JSONs das rotas /painel-economico/economia/brasil/emprego/{pnad,caged}.
 *
 * 3 JSONs no Blob:
 * - data/emprego_pnad.json         — gerado por build_emprego_pnad.py (cron mensal dia 16)
 * - data/emprego_caged_total.json  — gerado por build_emprego_caged_total.py (cron diário 25-30)
 * - data/emprego_caged_quebras.json — gerado por build_emprego_caged_quebras.py (cron diário 25-30)
 * - data/ipca.json (opcional, pra deflator) — gerado por build_ipca.py
 */

import { painelBlobUrl } from "@/lib/painel-blob";

export const EMPREGO_REVALIDATE_SECONDS = 21600;

// ---------------------------------------------------------------------------
// PNAD
// ---------------------------------------------------------------------------
export type PnadTaxaPonto = Record<string, number | null | string> & { trim: string };
export type PnadComposicaoPonto = Record<string, number | null | string> & { trim: string };
export type PnadSetorPonto = Record<string, number | null | string> & { trim: string };

export type PnadData = {
  gerado_em: string;
  trim_recente: string;
  taxas: { serie: PnadTaxaPonto[]; indicadores: string[] };
  composicao: { serie: PnadComposicaoPonto[]; categorias: string[] };
  setor: { serie: PnadSetorPonto[]; categorias: string[] };
  metadata: { fonte: string; nota: string };
};

// ---------------------------------------------------------------------------
// CAGED
// ---------------------------------------------------------------------------
export type CagedTotalPonto = {
  mes: string;
  saldo: number | null;
  admissoes: number | null;
  demissoes: number | null;
  saldo_mm12: number | null;
};

export type CagedTotalData = {
  gerado_em: string;
  mes_recente: string;
  serie: CagedTotalPonto[];
  metadata: { fonte: string; nota: string };
};

export type CagedQuebraPonto = {
  mes: string;
  total_linhas?: number;
  total_admissoes?: number;
  total_demissoes?: number;
  saldo_microdado: number;
  salario_minimo_aplicado: number;
  salario_medio_admissao: number | null;
  salario_medio_demissao: number | null;
  diferencial: number | null;
  saldo_por_setor_ibge: Record<string, number>;
  saldo_por_faixa_salario: Record<string, number>;
};

export type CagedQuebrasData = {
  gerado_em: string;
  mes_recente: string;
  serie: CagedQuebraPonto[];
  metadata: { fonte: string; nota: string; cnae_para_setor: Record<string, string> };
};

// ---------------------------------------------------------------------------
// IPCA (apenas variação mensal — usado pra deflator no CAGED)
// ---------------------------------------------------------------------------
export type IpcaCheioPonto = Record<string, number | null | string> & { mes: string };

export type IpcaForEmprego = {
  serie: IpcaCheioPonto[];
};

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------
async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: EMPREGO_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadPnadData(): Promise<PnadData | null> {
  return fetchBlobJson<PnadData>("data/emprego_pnad.json");
}

export async function loadCagedTotal(): Promise<CagedTotalData | null> {
  return fetchBlobJson<CagedTotalData>("data/emprego_caged_total.json");
}

export async function loadCagedQuebras(): Promise<CagedQuebrasData | null> {
  return fetchBlobJson<CagedQuebrasData>("data/emprego_caged_quebras.json");
}

/** Carrega o IPCA cheio (var mensal) pra usar como deflator de série nominal. */
export async function loadIpcaSerieMensal(): Promise<IpcaForEmprego | null> {
  const raw = await fetchBlobJson<{ ipca_cheio?: { serie?: IpcaCheioPonto[] } }>("data/ipca.json");
  if (!raw?.ipca_cheio?.serie) return null;
  return { serie: raw.ipca_cheio.serie };
}

export async function loadCagedFull(): Promise<{
  total: CagedTotalData | null;
  quebras: CagedQuebrasData | null;
  ipca: IpcaForEmprego | null;
}> {
  const [total, quebras, ipca] = await Promise.all([
    loadCagedTotal(),
    loadCagedQuebras(),
    loadIpcaSerieMensal(),
  ]);
  return { total, quebras, ipca };
}

// Constantes canônicas
export const SETORES_IBGE_ORDEM = [
  "Agropecuária",
  "Indústria geral",
  "Construção",
  "Comércio",
  "Serviços",
] as const;

export const FAIXAS_11_ORDEM = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

export const FAIXAS_11_NOMES: Record<string, string> = {
  "01": "até 0,5 SM",
  "02": "0,5 a 1 SM",
  "03": "1 a 1,5 SM",
  "04": "1,5 a 2 SM",
  "05": "2 a 3 SM",
  "06": "3 a 4 SM",
  "07": "4 a 5 SM",
  "08": "5 a 7 SM",
  "09": "7 a 10 SM",
  "10": "10 a 15 SM",
  "11": "15 a 20 SM",
  "12": "+ 20 SM",
};

export const FAIXAS_5_ORDEM = ["≤ 1 SM", "1-2 SM", "2-3 SM", "3-5 SM", "> 5 SM"] as const;

export function agrupa5(faixas11: Record<string, number>): Record<string, number> {
  const g: Record<string, number> = { "≤ 1 SM": 0, "1-2 SM": 0, "2-3 SM": 0, "3-5 SM": 0, "> 5 SM": 0 };
  for (const [k, v] of Object.entries(faixas11)) {
    const idx = parseInt(k, 10);
    if (idx <= 2) g["≤ 1 SM"] += v;
    else if (idx <= 4) g["1-2 SM"] += v;
    else if (idx <= 5) g["2-3 SM"] += v;
    else if (idx <= 7) g["3-5 SM"] += v;
    else g["> 5 SM"] += v;
  }
  return g;
}

/** Constrói índice acumulado de preços a partir da var mensal do IPCA cheio.
 *  Retorna Map<mes_YYYY-MM, indice> com base inicial 100 no primeiro mês.
 *  Use deflator(mesAtual, mesAlvo) = idx[mesAtual] / idx[mesAlvo] pra trazer R$ de mesAlvo pra mesAtual. */
export function buildIpcaIndex(ipca: IpcaForEmprego | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!ipca) return map;
  let idx = 100;
  // Ordena por mes pra acumular corretamente
  const sorted = [...ipca.serie].sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
  for (const item of sorted) {
    const v = item["IPCA cheio"];
    if (typeof v === "number") {
      idx = idx * (1 + v / 100);
    }
    map.set(item.mes, idx);
  }
  return map;
}

/** Deflaciona valor nominal em mesOrigem pra valor real em moeda de mesBase. */
export function deflaciona(
  valor: number | null | undefined,
  mesOrigem: string,
  mesBase: string,
  index: Map<string, number>,
): number | null {
  if (valor == null) return null;
  const idxBase = index.get(mesBase);
  const idxOrig = index.get(mesOrigem);
  if (!idxBase || !idxOrig) return null;
  return valor * (idxBase / idxOrig);
}
