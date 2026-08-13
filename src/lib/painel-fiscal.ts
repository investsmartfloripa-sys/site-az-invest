/**
 * Loaders dos JSONs do Painel Fiscal.
 *
 * - fiscal-classicos.json: dados crus (BCB SGS + Tesouro RTN + Focus)
 * - fiscal-termometro.json: aplicacao das formulas de Ray Dalio (How Countries Go Broke)
 */
import { fetchPainelBlob } from "@/lib/painel-blob";

export const FISCAL_REVALIDATE_SECONDS = 60;

// === Tipos base ===
export type PontoMensal = { data: string; valor: number | null };
export type PontoMensal12m = { data: string; valor_12m: number | null };
export type PontoMensalPct = { data: string; valor_pct: number | null };
export type PontoDiario = { data: string; valor: number | null };
export type PontoPibYoY = { data: string; valor_yoy_pct: number | null };

export type SelicRealPonto = {
  data: string;
  selic_nominal_pct: number | null;
  ipca_12m_pct: number | null;
  selic_real_pct: number | null;
};

export type FocusPonto = {
  data: string;
  mediana: number | null;
  media: number | null;
  dp: number | null;
  min: number | null;
  max: number | null;
};

export type DestaqueRecente =
  | { data: string; valor?: number | null; valor_pct?: number | null; valor_yoy_pct?: number | null; selic_real_pct?: number | null }
  | number
  | null;

// === fiscal-classicos.json ===

/** v2: r implÃ­cita da DLSP Ã— g nominal â€” perÃ­metro Ãºnico (consolidado), calculado SÃ“ no pipeline. */
export type SustentabilidadePonto = {
  data: string;
  r_aa_pct: number;
  g_aa_pct: number;
  r_menos_g_pp: number;
  primario_estabilizador_pct_pib: number | null;
  primario_realizado_sp_pct_pib: number | null;
  dlsp_pct_pib: number | null;
};

/** v2: por que a dÃ­vida (DLSP) subiu â€” decomposiÃ§Ã£o anual com sinal p/ empilhar. */
export type DecomposicaoDlspAno = {
  ano: string;
  delta_pp: number;
  juros_pp: number;
  primario_pp: number;
  efeito_crescimento_pp: number;
  residuo_pp: number;
  dlsp_fim_pct_pib: number;
};

export type FiscalClassicosData = {
  schema_version?: number;
  gerado_em: string;
  mes_recente: string | null;
  pib_nominal_12m_brl_milhoes: number | null;
  divida: {
    dbgg_pct_pib: PontoMensal[];
    dlsp_total_pct_pib: PontoMensal[];
    dlsp_gov_central_pct_pib: PontoMensal[];
  };
  receita_e_gastos: {
    receita_liquida_12m_brl_mm: PontoMensal12m[];
    despesa_total_12m_brl_mm: PontoMensal12m[];
    primario_central_12m_brl_mm: PontoMensal12m[];
    juros_central_12m_brl_mm: PontoMensal12m[];
    receita_liquida_pct_pib: PontoMensalPct[];
    despesa_total_pct_pib: PontoMensalPct[];
    primario_central_pct_pib: PontoMensalPct[];
    juros_central_pct_pib: PontoMensalPct[];
    despesa_pct_receita: PontoMensalPct[];
    juros_pct_receita: PontoMensalPct[];
    primario_pct_receita: PontoMensalPct[];
    previdencia_12m_pct_pib: PontoMensalPct[];
    pessoal_12m_pct_pib: PontoMensalPct[];
    previdencia_12m_pct_receita: PontoMensalPct[];
    pessoal_12m_pct_receita: PontoMensalPct[];
    discricionarias_12m_brl_mm: PontoMensal12m[];
    outras_obrigatorias_12m_brl_mm: PontoMensal12m[];
    abono_seguro_12m_pct_pib?: PontoMensalPct[];
    bpc_loas_12m_pct_pib?: PontoMensalPct[];
    fundeb_12m_pct_pib?: PontoMensalPct[];
    subsidios_12m_pct_pib?: PontoMensalPct[];
    discricionarias_12m_pct_pib?: PontoMensalPct[];
    outras_obrigatorias_12m_pct_pib?: PontoMensalPct[];
    abono_seguro_12m_pct_receita?: PontoMensalPct[];
    bpc_loas_12m_pct_receita?: PontoMensalPct[];
    fundeb_12m_pct_receita?: PontoMensalPct[];
    subsidios_12m_pct_receita?: PontoMensalPct[];
    discricionarias_12m_pct_receita?: PontoMensalPct[];
    outras_obrigatorias_12m_pct_receita?: PontoMensalPct[];
    nfsp_sp_12m_pct_pib: PontoMensal[];
    primario_sp_12m_pct_pib: PontoMensalPct[];
    juros_nominais_sp_12m_pct_pib: PontoMensal[];
    nominal_sp_12m_pct_pib: PontoMensalPct[];
    // === Tributos individuais (12m % PIB) ===
    imposto_renda_12m_pct_pib?: PontoMensalPct[];
    cofins_12m_pct_pib?: PontoMensalPct[];
    csll_12m_pct_pib?: PontoMensalPct[];
    pis_pasep_12m_pct_pib?: PontoMensalPct[];
    ipi_12m_pct_pib?: PontoMensalPct[];
    iof_12m_pct_pib?: PontoMensalPct[];
    imposto_importacao_12m_pct_pib?: PontoMensalPct[];
    cide_12m_pct_pib?: PontoMensalPct[];
    rgps_arrecadacao_12m_pct_pib?: PontoMensalPct[];
    dividendos_12m_pct_pib?: PontoMensalPct[];
    recursos_naturais_12m_pct_pib?: PontoMensalPct[];
  };
  monetaria: {
    selic_diaria_pct: PontoDiario[];
    ipca_12m_pct: PontoMensal[];
    selic_real_ex_post_pct: SelicRealPonto[];
    pib_real_yoy_pct: PontoPibYoY[];
  };
  composicao_dpmfi?: {
    selic_pct: PontoMensal[];
    prefixado_pct: PontoMensal[];
    cambio_pct: PontoMensal[];
    tr_pct?: PontoMensal[];
    outros_pct?: PontoMensal[];
    /** v2 (SGS 12001): a fatia de Ã­ndices de preÃ§os que faltava â€” o stack fecha em ~100%. */
    indices_precos_pct?: PontoMensal[];
  };
  credito_economia?: {
    credito_total_pct_pib: PontoMensal[];
  };
  stress: {
    reer_index: PontoMensal[];
    reservas_usd_mm_mensal: PontoMensal[];
  };
  pib: {
    acumulado_12m_brl_milhoes_mensal: PontoMensal[];
    real_idx: PontoMensal[];
  };
  expectativas_focus: Record<string, Record<string, FocusPonto[]>>;
  metas_ldo?: {
    _fonte: string;
    anos: Record<string, { centro: number; banda_inf: number; banda_sup: number }>;
  };
  // === v2 ===
  sustentabilidade?: { _perimetro: string; serie: SustentabilidadePonto[] };
  decomposicao_dlsp?: { _nota: string; anos: DecomposicaoDlspAno[] };
  receita_familias?: {
    _nota: string;
    administrada_rfb_12m_pct_pib: PontoMensalPct[];
    incentivos_fiscais_12m_pct_pib: PontoMensalPct[];
    rgps_12m_pct_pib: PontoMensalPct[];
    nao_administrada_12m_pct_pib: PontoMensalPct[];
    dividendos_concessoes_12m_pct_pib: PontoMensalPct[];
  };
  despesa_rubricas_v2?: {
    _nota: string;
    demais_obrigatorias_12m_pct_pib: PontoMensalPct[];
    obrig_controle_fluxo_12m_pct_pib: PontoMensalPct[];
  };
  arcabouco?: {
    _nota: string;
    corredor: { piso_pct: number; teto_pct: number };
    despesa_real_12m_yoy_pct: PontoPibYoY[];
    receita_real_12m_yoy_pct: PontoPibYoY[];
  };
  acompanhamento_meta?: {
    _nota: string;
    primario_central_ytd_brl_mm: Record<string, { mes: number; acum_brl_mm: number }[]>;
  };
  /** v3: poupanÃ§a bruta trimestral (IBGE CNT, SIDRA t/2072) â€” insumo do Dalio nÂº 4. */
  poupanca?: {
    _fonte: string;
    serie: PoupancaPonto[];
  };
  destaques: Record<string, DestaqueRecente>;
};

/** PoupanÃ§a bruta acumulada 4 trimestres â€” data = mÃªs de fim do trimestre. */
export type PoupancaPonto = {
  data: string;
  poupanca_4t_brl_mm: number;
  pib_4t_brl_mm: number;
  taxa_poupanca_pct_pib: number;
};

// === fiscal-termometro.json (Dalio) ===
export type Lever = {
  i_estavel_aa?: number;
  i_atual_aa?: number;
  inflacao_estavel_aa?: number;
  inflacao_atual_aa?: number;
  corte_pct_da_despesa?: number;
  despesa_atual_pct_receita?: number;
  despesa_alvo_pct_receita?: number;
  aumento_pct_da_receita?: number;
  delta_pp?: number;
};

export type Matriz = {
  titulo: string;
  subtitulo: string;
  eixo_y_starting: number[];
  eixo_x_deficit?: number[];
  eixo_x_gap_pp?: number[];
  valores: number[][];
  brasil?: { starting: number | null; deficit?: number | null; gap_pp?: number | null };
};

export type Nivel = "verde" | "amarelo" | "vermelho" | "break" | "sem_dado";

export type IndicadorSemaforo = {
  titulo: string;
  categoria: string;
  unidade: string;
  direcao: "maior_pior" | "maior_melhor";
  verde: number;
  amarelo: number;
  break: number;
  narrativa: string;
  valor: number | null;
  nivel: Nivel;
  distancia_break: number | null;
  /** v3: sÃ©rie mensal histÃ³rica do indicador (camada tempo) â€” ausente nos levers. */
  serie?: PontoMensal[];
};

/** Faixas de risco de um indicador (calibradas pela AZ a partir do livro). */
export type FaixasRisco = {
  direcao: "maior_pior" | "maior_melhor";
  verde: number;
  amarelo: number;
  break: number;
  fonte: string;
};

/** ReferÃªncia da literatura sobreposta a um grÃ¡fico (FMI, Reinhart-Rogoff...). */
export type RefLiteratura = { valor: number; label: string };

/**
 * v3: os 4 indicadores prioritÃ¡rios de How Countries Go Broke.
 * As sÃ©ries de dÃ­vida/renda e serviÃ§o/renda NÃƒO vivem aqui: o front lÃª
 * indicadores_semaforo.{dbgg_pct_receita, dbgg_pct_pib, juros_pct_receita}.serie
 * (o pipeline parou de duplicÃ¡-las byte a byte no dalio4).
 */
export type Dalio4 = {
  _nota: string;
  divida_renda: {
    faixas_pct_receita: FaixasRisco;
    faixas_pct_pib: FaixasRisco;
    referencias_pct_pib: RefLiteratura[];
    _nota: string;
  };
  servico_renda: {
    faixas: FaixasRisco;
    _nota: string;
  };
  juros_inflacao_crescimento: {
    serie: {
      data: string;
      r_aa_pct: number;
      g_aa_pct: number;
      ipca_12m_pct: number | null;
      r_menos_g_pp: number;
    }[];
    faixas_gap: FaixasRisco;
    _nota: string | null;
  };
  divida_servico_poupanca: {
    serie: {
      data: string;
      taxa_poupanca_pct_pib: number;
      divida_anos_poupanca: number | null;
      juros_pct_poupanca: number | null;
    }[];
    _nota: string;
  };
};

/**
 * Onda 3: spread soberano VIVO (proxy declarada no _nota do bloco) — o
 * sucessor do EMBI+ descontinuado. Unidade: p.p.
 */
export type SpreadSoberano = {
  _fonte: string;
  _nota: string;
  unidade: string;
  serie: PontoMensal[];
  ultimo: { data: string; valor: number };
  percentis_10a: { p25: number; p50: number; p75: number };
};

/**
 * Onda 3: serviço TOTAL da dívida — (juros 12m + principal vincendo 12m) ÷
 * receita 12m. Ausente/null enquanto o blob DPF (RMD) não existir.
 */
export type ServicoTotal = {
  _nota: string;
  serie: { data: string; valor_pct_receita: number | null }[];
};

/** v3: EMBI+ histÃ³rico (fonte pÃºblica descontinuada em jul/2024 â€” flag no bloco). */
export type EmbiBlock = {
  _fonte: string;
  serie: PontoMensal[];
  ultimo: { data: string; valor: number };
  percentis_10a: { p25: number | null; p50: number | null; p75: number | null };
  descontinuada: boolean;
};

/** v3: projeÃ§Ã£o ilustrativa da DBGG com insumos do Focus (sem efeito cÃ¢mbio). */
export type ProjecaoDbgg = {
  _nota: string;
  historico_anual: PontoMensal[];
  premissas: { i_aa_pct: number; primario_atual_pct_pib: number };
  anos: {
    ano: number;
    g_nominal_focus_aa_pct: number;
    primario_cenario_meta_pct_pib: number;
    dbgg_cenario_meta_pct_pib: number;
    dbgg_cenario_primario_atual_pct_pib: number;
    /** Ano alÃ©m do horizonte legal da LDO (pÃ³s-2027) â€” meta extrapolada (hipÃ³tese AZ). */
    meta_extrapolada?: boolean;
    /** Ano parcial do prÃ³prio ano-base: fraÃ§Ã£o decorrida (0â€“1). */
    fracao_ano?: number;
  }[];
};

export type FiscalTermometroData = {
  schema_version?: number;
  gerado_em: string;
  fonte_base: string | null;
  indicadores_semaforo?: Record<string, IndicadorSemaforo>;
  categorias_ordem?: string[];
  foto_brasil: {
    divida: { dbgg_pct_pib: number | null; dbgg_pct_receita: number | null };
    receita: { receita_liquida_pct_pib: number | null };
    gastos: { despesa_total_pct_pib: number | null; despesa_total_pct_receita: number | null };
    deficit_primario: { primary_deficit_pct_pib: number | null; primary_deficit_pct_receita: number | null };
    juros: { juros_pct_pib: number | null; juros_pct_receita: number | null; taxa_nominal_efetiva_aa: number | null };
    /** Fallbacks hardcoded eliminados no pipeline: pode vir null quando faltar insumo. */
    macro: {
      pib_real_yoy_pct: number | null;
      ipca_12m_pct: number | null;
      selic_real_ex_post_pct: number | null;
      g_nominal_aa_pct: number;
      i_nominal_aa_pct: number;
      gap_i_menos_g_pp: number;
    };
  };
  matrizes: {
    endlevel_por_deficit: Matriz;
    endlevel_por_gap: Matriz;
  };
  levers: {
    gap_atual_pp: number;
    lever_juros?: Lever;
    lever_inflacao?: Lever;
    lever_corte_despesa?: Lever;
    lever_aumento_receita?: Lever;
  } | null;
  /** v3 â€” presentes sÃ³ depois que o pipeline novo publica. */
  dalio4?: Dalio4;
  embi?: EmbiBlock | null;
  projecao_dbgg?: ProjecaoDbgg | null;
  /** Onda 3 â€” presentes sÃ³ depois que o pipeline novo publica. */
  spread_soberano?: SpreadSoberano | null;
  servico_total?: ServicoTotal | null;
  premissas: {
    i_nominal_aa: number;
    g_nominal_aa: number;
    primary_deficit_pct_receita: number | null;
    debt_pct_receita: number | null;
    anos_projecao: number;
  };
  /** Onda 0: nota de calibração das faixas (renderizada na ficha técnica). */
  calibracao_nota?: string;
  metodologia: string;
};

// === fiscal-dbgg-fatores.json (Onda 3 — build_fiscal_dbgg_fatores.py) ===

/**
 * Decomposição OFICIAL da variação da DBGG (Nota de Imprensa/BCB), anual em
 * p.p. do PIB. juros + emissões + câmbio + outros + efeito PIB ≈ Δ total.
 */
export type DbggFatoresAno = {
  ano: number;
  variacao_dbgg_pp_pib: number;
  juros_nominais_pp: number;
  emissoes_liquidas_pp: number;
  ajuste_cambial_pp: number;
  outros_pp: number;
  efeito_pib_pp: number;
};

/** Mesma decomposição em fluxo mensal, R$ milhões (sem efeito PIB — só fatores). */
export type DbggFatoresMes = {
  data: string;
  variacao_dbgg_brl_mm: number;
  juros_nominais_brl_mm: number;
  emissoes_liquidas_brl_mm: number;
  ajuste_cambial_brl_mm: number;
  outros_brl_mm: number;
};

export type FiscalDbggFatoresData = {
  schema_version: number;
  gerado_em: string;
  _fonte: string;
  /** "outros" = dívida externa-outros ajustes + reconhecimento de dívidas + privatizações. */
  _nota: string;
  anual: DbggFatoresAno[];
  mensal: DbggFatoresMes[];
};

// === fiscal-dpf-rmd.json (Onda 3 — build_dpf_rmd.py) ===

/** Detentores da DPMFi em mercado, estoque em R$ bilhões por categoria. */
export type DetentoresDpmfiPonto = {
  data: string;
  instituicoes_financeiras: number;
  fundos: number;
  previdencia: number;
  nao_residentes: number;
  governo: number;
  seguradoras: number;
  outros: number;
};

/** Relatório Mensal da Dívida (RMD/Tesouro): prazo, rolagem, custo e detentores. */
export type FiscalDpfRmdData = {
  schema_version: number;
  gerado_em: string;
  _fonte: string;
  _nota: string;
  prazo_medio_dpf_anos: PontoMensal[];
  vincendo_12m_pct: PontoMensal[];
  custo_medio_12m_aa_pct: PontoMensal[];
  pct_nao_residentes: PontoMensal[];
  detentores_brl_bi: DetentoresDpmfiPonto[];
  estoque_dpf_brl_bi: PontoMensal[];
};

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  try {
    // TTL curto + cache tag `blob:<path>`, purgÃ¡vel pelo POST /api/revalidate
    const res = await fetchPainelBlob(path, FISCAL_REVALIDATE_SECONDS);
    if (!res?.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadFiscalClassicos(): Promise<FiscalClassicosData | null> {
  return fetchBlobJson<FiscalClassicosData>("data/fiscal-classicos.json");
}
export async function loadFiscalTermometro(): Promise<FiscalTermometroData | null> {
  return fetchBlobJson<FiscalTermometroData>("data/fiscal-termometro.json");
}
export async function loadFiscalDbggFatores(): Promise<FiscalDbggFatoresData | null> {
  return fetchBlobJson<FiscalDbggFatoresData>("data/fiscal-dbgg-fatores.json");
}
export async function loadFiscalDpfRmd(): Promise<FiscalDpfRmdData | null> {
  return fetchBlobJson<FiscalDpfRmdData>("data/fiscal-dpf-rmd.json");
}
