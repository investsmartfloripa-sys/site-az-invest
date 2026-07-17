/**
 * Loader dos JSONs da rota /painel-economico/economia/brasil/inflacao/ipca.
 *
 * JSON gerado pelo script `data-pipeline/python/build_ipca.py` (cron diário 9h BRT
 * em `.github/workflows/ipca-pipeline.yml`), upload pro Vercel Blob em `data/ipca.json`.
 */

import { painelBlobUrl } from "@/lib/painel-blob";

/** Cache ISR de 1 hora. */
export const IPCA_REVALIDATE_SECONDS = 3600;

export type SerieGrupo = Record<string, number | null | string> & { mes: string };

export type IpcaIndice = {
  serie: SerieGrupo[];
  pesos_recentes: Record<string, number>;
  mes_recente: string;
  grupos: string[];
  /**
   * schema v2: contribuição de cada grupo ao acumulado 12m, ENCADEADA no
   * builder com resíduo realocado pró-rata — a pilha fecha exatamente com o
   * "IPCA 12m" oficial (v2265) presente em cada item. Nunca recalcular no front.
   */
  serie_contrib_12m?: SerieGrupo[];
};

export type NucleosBlock = {
  serie: Array<Record<string, number | null | string> & { mes: string }>;
  /** schema v2: 12m composto de cada núcleo + media_nucleos / nucleos_min / nucleos_max (5 núcleos do BC). */
  serie_12m?: Array<Record<string, number | null | string> & { mes: string }>;
  /** Núcleos que entram na média (EX0, EX3, MS, DP, P — sem MA). */
  conjunto_media?: string[];
};
export type DifusaoBlock = {
  serie: Array<{ mes: string; difusao: number | null; mm3?: number | null }>;
  /** schema v2: régua histórica calculada no builder (jan/2012+). */
  media_historica?: { desde: string; media: number | null; dp: number | null; n: number };
};
export type CategoriasBlock = {
  serie: Array<Record<string, number | null | string> & { mes: string }>;
  /** schema v2: 12m composto de Livres/Monitorados/Serviços/Comercializáveis. */
  serie_12m?: Array<Record<string, number | null | string> & { mes: string }>;
};

export type Influencia = {
  subitem: string;
  var: number;
  peso: number;
  contrib_pp: number;
  /** schema v3: acumulados oficiais do subitem (v69/v2265 da SIDRA). */
  acum_ano?: number | null;
  acum_12m?: number | null;
};

export type FocusPonto = {
  data: string;
  mediana: number | null;
  media: number | null;
  dp: number | null;
  min: number | null;
  max: number | null;
};

/** Estatística da variação mensal de um mês civil (janela de 10 anos do builder). */
export type SazonalidadeStats = {
  mediana: number | null;
  media: number | null;
  min: number | null;
  max: number | null;
  n: number;
};

// ---------------------------------------------------------------------------
// schema v3 (jul/2026) — blocos das tabs de escrutínio. TODO cálculo (12m
// composto, dessaz STL, SAAR, acumulados) nasce no builder, nunca aqui.
// ---------------------------------------------------------------------------
export type SerieLongaPonto = {
  mes: string;
  var: number | null;
  acum_12m: number | null;
  meta: number;
  piso: number;
  teto: number;
};
export type MetaAnual = { ano: number; meta: number; tol: number; continua?: boolean };
export type SerieLongaBlock = { desde: string; serie: SerieLongaPonto[]; metas_anuais: MetaAnual[] };

export type MomentumPonto = { mes: string; var_sa: number; saar_3m: number | null; saar_6m: number | null };
export type MomentumBlock = {
  metodo: string;
  ajuste_desde: string;
  publica_desde: string;
  /** ids: "ipca", "EX0", "EX3", "MS", "DP", "P", "servicos", "livres". */
  series: Record<string, MomentumPonto[]>;
  media_nucleos_saar3m: Array<{ mes: string; saar_3m: number }>;
};

export type SinteseLinha = {
  id: string;
  nome: string;
  m2: number | null;
  m1: number | null;
  m0: number | null;
  acum_ano: number | null;
  acum_12m: number | null;
  peso: number | null;
  contrib_pp?: number | null;
  unidade?: string;
  /** IPCA-15: mês de referência próprio (pode divergir do cheio). */
  mes_proprio?: string;
};
export type TabelaSinteseBlock = {
  mes_recente: string;
  meses: string[];
  secoes: Array<{ id: string; titulo: string; linhas: SinteseLinha[] }>;
};

export type HierarquiaNo = {
  nome: string;
  codigo: string;
  nivel: string;
  var: number | null;
  peso: number | null;
  acum_ano: number | null;
  acum_12m: number | null;
  contrib_pp: number | null;
};
export type HierarquiaSubgrupo = HierarquiaNo & { itens: HierarquiaNo[] };
export type HierarquiaGrupo = HierarquiaNo & { subgrupos: HierarquiaSubgrupo[] };
export type AberturaHierarquica = { geral: HierarquiaNo | null; grupos: HierarquiaGrupo[] };

export type FocusMensalStats = {
  data_pesquisa: string | null;
  mediana: number | null;
  media: number | null;
  dp: number | null;
  min: number | null;
  max: number | null;
  n_respondentes?: number | null;
};
export type FocusMensalBlock = {
  mes_referencia: string;
  vespera: FocusMensalStats | null;
  proximos: Array<FocusMensalStats & { mes_ref: string }>;
  surpresas: Array<{
    mes: string;
    realizado: number;
    esperado: number;
    surpresa_pp: number;
    data_pesquisa: string | null;
  }>;
};
export type Focus12mPonto = { mes: string; data: string; mediana: number };

export type IpcaData = {
  /** 2 = acumulados compostos/contribuições encadeadas (jun/2026); 3 = tabs de escrutínio (jul/2026). */
  schema_version?: number;
  gerado_em: string;
  mes_recente: string;
  ipca_cheio: IpcaIndice;
  ipca_15: IpcaIndice;
  nucleos: NucleosBlock;
  difusao: DifusaoBlock;
  categorias?: CategoriasBlock;
  /** schema v2: mediana/mín/máx da variação mensal por mês civil ("01".."12"). */
  sazonalidade?: { janela: string; por_mes: Record<string, SazonalidadeStats> };
  focus?: Record<string, FocusPonto[]>;
  maiores_influencias: {
    mes: string;
    top_altas: Influencia[];
    top_quedas: Influencia[];
    /** schema v2: lista completa de subitens do mês corrente (~440). */
    todos?: Influencia[];
  };
  /** schema v3 ↓ — opcionais p/ tolerar JSON antigo em cache. */
  serie_longa?: SerieLongaBlock;
  momentum?: MomentumBlock;
  tabela_sintese?: TabelaSinteseBlock;
  abertura_hierarquica?: AberturaHierarquica;
  focus_mensal?: FocusMensalBlock | null;
  focus_12m?: Focus12mPonto[];
};

/**
 * Contrato do robô de publicação (data/ipca_release.json, schema v1) —
 * resumo legível por máquina da última divulgação. Campos: ver
 * `release_build` em data-pipeline/python/build_ipca.py.
 */
export const IPCA_RELEASE_BLOB_PATH = "data/ipca_release.json";

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: IPCA_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadIpcaData(): Promise<IpcaData | null> {
  return fetchBlobJson<IpcaData>("data/ipca.json");
}
