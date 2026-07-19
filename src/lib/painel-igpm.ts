/**
 * Loader dos JSONs da rota /painel-economico/economia/brasil/inflacao/igp-m.
 *
 * JSON gerado por `data-pipeline/python/build_igpm.py` (cron diário 9h BRT em
 * `.github/workflows/ipca-pipeline.yml`). Upload em `data/igpm.json` no Vercel Blob.
 *
 * Códigos SGS:
 *  189   IGP-M variação mensal (o 12m é COMPOSTO no builder — o antigo
 *        SGS 192 NÃO era IGP-M 12m e foi aposentado no schema v2)
 *  7450  IPA-M cheio (peso de origem 60%)
 *  7453  IPC-M cheio (30%) — corrigido 2026-07 (era 7456, que é o INCC-M)
 *  7456  INCC-M cheio (10%) — corrigido 2026-07 (era 7465, que é IPC-Fipe
 *        Alimentação); identificação travada por spot-check no builder
 *  433   IPCA mensal (referência)
 *  13522 IPCA 12m (referência)
 *
 * schema_version 2 (2026-06): decomposição com pesos efetivos encadeados e
 * resíduo explícito (`decomposicao`), correlação IPA->IPCA (`antecipacao`),
 * reajustes de aluguel (`aluguel`), série completa p/ tabela/CSV (`analise`)
 * e estatísticas pós-1996 — tudo calculado no builder, nunca no front.
 *
 * schema_version 3 (2026-07): tabs de escrutínio — tabela-síntese (família
 * IGP + componentes + origem do IPA), transformações e momentum por índice
 * (STL/SAAR; IPA anualizado SEM dessaz), decomposição do 12m com resíduo
 * como fatia própria, série longa pós-96 com réguas PRÓPRIAS (o IGP não tem
 * meta), origem agro×industrial do IPA (identificação revalidada por build)
 * e Focus IGP-M (anuais + mensal com surpresas, mesmo shape do IPCA).
 */
import type { FocusMensalBlock } from "@/lib/painel-ipca";
import { painelBlobUrl } from "@/lib/painel-blob";

export const IGPM_REVALIDATE_SECONDS = 3600;

export type SerieIgpmOverview = Record<string, number | null | string> & { mes: string };

/** Estatísticas da variação mensal (janela declarada em `desde`). */
export type EstatisticasJanela = {
  n: number;
  desde?: string | null;
  media: number;
  mediana: number;
  std: number;
  min: number;
  max: number;
  positivos_pct: number;
  negativos_pct: number;
};

/** Régua do acumulado 12m: distribuição histórica pós-corte + percentil do valor atual. */
export type Estatisticas12m = {
  desde: string;
  n: number;
  media: number;
  mediana: number;
  negativos_pct: number;
  percentil_atual?: number;
};

export type OverviewBlock = {
  serie: SerieIgpmOverview[];
  componentes: string[];
  mes_recente: string;
  ultimo_mensal: number | null;
  /** schema v2: 12m COMPOSTO no builder (validado contra oficiais FGV). */
  ultimo_12m: number | null;
  /** schema v2: padrão do mês civil do IGP-M cheio (jan/1996+). */
  sazonalidade_pos96?: Record<string, SazonalidadeMes>;
  estatisticas_pos96?: EstatisticasJanela;
  estatisticas_12m?: Estatisticas12m;
};

/**
 * schema v2 — âncora: decomposição mensal com PESOS EFETIVOS encadeados
 * (w_c,t = w_c0·I_c,t−1 / Σ w_c0·I_c,t−1) e resíduo estrutural EXPLÍCITO.
 * Cada item da série traz "<comp> (contrib)", "<comp> (peso efetivo)",
 * "IGP-M", "IGP-M 12m" (p/ sombrear deflação) e "residuo_pp".
 */
export type DecomposicaoBlock = {
  metodo: string;
  base_encadeamento: string;
  componentes: string[];
  serie: SerieIgpmOverview[];
};

/** schema v2 — correlação cruzada IPA-M 12m × IPCA 12m (defasagens 0–6m). */
export type AntecipacaoLag = {
  lag: number;
  corr_pos96: number | null;
  n_pos96: number;
  corr_pos2016: number | null;
  n_pos2016: number;
};

export type AntecipacaoBlock = {
  janela_total: string;
  janela_recente: string;
  lags: AntecipacaoLag[];
  melhor_lag: number;
  melhor_corr_pos96: number | null;
  melhor_lag_pos2016: number | null;
  melhor_corr_pos2016: number | null;
  serie: Array<{ mes: string; ipa_12m: number | null; ipca_12m: number | null }>;
};

/** schema v2 — reajuste anual de contrato indexado ao IGP-M (cláusula de não-redução aplicada). */
export type AluguelReajuste = {
  ano: number;
  mes: string;
  igpm_12m: number;
  ipca_12m: number;
  aplicado_pct: number;
  clausula_nao_reducao: boolean;
};

export type AluguelBlock = {
  mes_referencia: string;
  reajustes: AluguelReajuste[];
};

/** schema v2 — série mensal completa (120m) p/ a tabela/CSV da análise. */
export type AnalisePonto = {
  mes: string;
  igpm: number | null;
  ipa: number | null;
  ipc: number | null;
  incc: number | null;
  igpm_12m: number | null;
  ipca_12m: number | null;
  spread_12m: number | null;
};

export type ComparativoPonto = {
  mes: string;
  igpm_12m: number | null;
  ipca_12m: number | null;
  spread: number | null;
};

export type SerieLongaPonto = {
  mes: string;
  mensal: number | null;
  acum_12m: number | null;
  acum_ano: number | null;
  ipca_mensal: number | null;
  ipca_12m: number | null;
  spread_12m: number | null;
};

export type EstatisticasComp = {
  n?: number;
  media?: number;
  mediana?: number;
  std?: number;
  min?: number;
  max?: number;
  positivos_pct?: number;
  negativos_pct?: number;
};

export type SazonalidadeMes = {
  media: number | null;
  /** schema v2: estatística central recomendada (robusta a outliers). */
  mediana?: number | null;
  std: number | null;
  n: number;
  min: number | null;
  max: number | null;
};

export type RankingPonto = { mes: string; valor: number };

export type SubPainelComponente = {
  peso_igpm: number;
  serie_longa: SerieLongaPonto[];
  estatisticas: EstatisticasComp;
  /** schema v2: régua do 12m (percentil do atual, média/mediana pós-96). */
  estatisticas_12m?: Estatisticas12m;
  sazonalidade: Record<string, SazonalidadeMes>;
  maiores_altas: RankingPonto[];
  maiores_quedas: RankingPonto[];
  ultimo_mes: string;
  ultimo_mensal: number | null;
  ultimo_12m: number | null;
  ultimo_ano: number | null;
};

// ---------------------------------------------------------------------------
// schema v3 (jul/2026) — blocos das tabs de escrutínio. TODO cálculo (12m
// composto, dessaz STL, SAAR, encadeamentos, réguas) nasce no builder.
// ---------------------------------------------------------------------------

/** Linha da tabela-síntese (família IGP, componentes ou origem do IPA). */
export type SinteseIgpmLinha = {
  id: string;
  nome: string;
  m2: number | null;
  m1: number | null;
  m0: number | null;
  acum_ano: number | null;
  acum_12m: number | null;
  /** Peso EFETIVO encadeado (%) do componente no mês — só na seção componentes. */
  peso: number | null;
  contrib_pp: number | null;
  /** Série com janela própria (IGP-10, IGP-DI, origem do IPA): mês de referência dela. */
  mes_proprio?: string;
};

export type SinteseIgpmSecao = {
  id: "familia" | "componentes" | "origem";
  titulo: string;
  linhas: SinteseIgpmLinha[];
};

export type TabelaSinteseIgpmBlock = {
  mes_recente: string;
  meses: [string, string, string];
  secoes: SinteseIgpmSecao[];
};

/** Linha da tabela de transformações por índice (IGP-M, IPA-M, IPC-M, INCC-M). */
export type TransformacaoIgpm = {
  id: string;
  nome: string;
  mes: number | null;
  saar_3m: number | null;
  saar_6m: number | null;
  /** true = 3m/6m sobre série dessazonalizada (STL); false = anualizado cru (IPA). */
  dessaz: boolean;
  acum_ano: number | null;
  acum_12m: number | null;
};

export type IgpmMomentumPonto = {
  mes: string;
  /** Variação-base da janela: dessazonalizada (STL) ou crua, conforme `dessaz`. */
  var_base: number;
  saar_3m: number | null;
  saar_6m: number | null;
  dessaz: boolean;
};

export type IgpmMomentumBlock = {
  metodo: string;
  ajuste_desde: string;
  publica_desde: string;
  /** Chaves: "IGP-M", "IPA-M", "IPC-M", "INCC-M". */
  series: Record<string, IgpmMomentumPonto[]>;
};

/** Ponto da decomposição do acumulado 12m — resíduo é fatia PRÓPRIA (nunca realocado). */
export type Decomposicao12mPonto = {
  mes: string;
  "IPA-M": number;
  "IPC-M": number;
  "INCC-M": number;
  residuo: number;
  "IGP-M 12m": number;
};

export type Decomposicao12mBlock = {
  serie: Decomposicao12mPonto[];
  componentes: string[];
};

export type SerieLongaIgpmPonto = {
  mes: string;
  var: number | null;
  acum_12m: number | null;
  ipca_12m: number | null;
};

/** IGP-M pós-Real com réguas PRÓPRIAS (mediana e p10–p90 do 12m — sem meta). */
export type SerieLongaIgpmBlock = {
  desde: string;
  serie: SerieLongaIgpmPonto[];
  reguas: {
    desde: string;
    mediana_12m: number | null;
    p10_12m: number | null;
    p90_12m: number | null;
    n: number;
  };
};

export type OrigemIpaPonto = {
  mes: string;
  agro: number | null;
  ind: number | null;
  agro_12m: number | null;
  ind_12m: number | null;
};

/** Abertura agro×industrial do atacado (família IPA-DI) — só publica se a identificação passar. */
export type OrigemIpaBlock = {
  familia: string;
  identificacao: {
    metodo: string;
    codigo_agro: number;
    codigo_ind: number;
    w_agro: number;
    r2: number;
  };
  serie: OrigemIpaPonto[];
  ultimo: OrigemIpaPonto | null;
};

export type FocusAnualIgpmPonto = {
  data: string;
  mediana: number | null;
  media: number | null;
  dp: number | null;
  min: number | null;
  max: number | null;
};

export type IgpmData = {
  /** 2 = 12m composto + pesos efetivos (jun/2026); 3 = tabs de escrutínio (jul/2026). */
  schema_version?: number;
  gerado_em: string;
  mes_recente: string;
  fontes: Record<string, number>;
  pesos: Record<string, number>;
  overview: OverviewBlock;
  decomposicao?: DecomposicaoBlock;
  antecipacao?: AntecipacaoBlock;
  aluguel?: AluguelBlock;
  analise?: { serie: AnalisePonto[] };
  comparativo_ipca: ComparativoPonto[];
  componentes: Record<string, SubPainelComponente>;
  igpm: OverviewBlock;
  /** schema v3 ↓ — opcionais p/ tolerar JSON antigo em cache. */
  tabela_sintese?: TabelaSinteseIgpmBlock;
  transformacoes?: TransformacaoIgpm[];
  momentum?: IgpmMomentumBlock;
  decomposicao_12m?: Decomposicao12mBlock;
  serie_longa?: SerieLongaIgpmBlock;
  origem_ipa?: OrigemIpaBlock | null;
  /** Chave = ano-referência ("2026"...) — shape idêntico ao Focus anual do IPCA. */
  focus_anuais?: Record<string, FocusAnualIgpmPonto[]>;
  /** Mesmo shape do bloco mensal do IPCA (vespera + próximos + surpresas). */
  focus_mensal?: FocusMensalBlock | null;
};

/**
 * Contrato do robô de publicação (data/igpm_release.json, schema v1) —
 * resumo legível por máquina da última divulgação. Campos: ver
 * `release_igpm_build` em data-pipeline/python/build_igpm.py.
 */
export const IGPM_RELEASE_BLOB_PATH = "data/igpm_release.json";

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: IGPM_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadIgpmData(): Promise<IgpmData | null> {
  return fetchBlobJson<IgpmData>("data/igpm.json");
}
