/**
 * Loader do JSON do Painel Contas Externas — Brasil, BPM6.
 *
 * 1 JSON no Blob: data/contas_externas.json — gerado por build_contas_externas.py
 * (workflow contas-externas-pipeline.yml, cron diário 23h30 UTC).
 */

import { fetchPainelBlob } from "@/lib/painel-blob";

export const CONTAS_EXTERNAS_REVALIDATE_SECONDS = 3600; // 1h
const BLOB_PATH = "data/contas_externas.json";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type NumOrNull = number | null;

export type HeroKpi = {
  data: string | null;
  valor: NumOrNull;
  unidade: string;
};

export type ContasExternasHero = {
  saldo_tc_pct_pib: HeroKpi;
  idp_pct_pib: HeroKpi;
  reservas_us_bi: HeroKpi;
  meses_importacao: HeroKpi;
};

export type SaldoAnualPonto = {
  ano: string;
  saldo_us_bi: number;
  saldo_pct_pib: number;
};

export type BpDecomposicaoPonto = {
  mes: string;
  saldo_total: NumOrNull;
  bens: NumOrNull;
  servicos: NumOrNull;
  renda_primaria: NumOrNull;
  renda_secundaria: NumOrNull;
};

export type BalancaComercialPonto = {
  mes: string;
  exportacoes: NumOrNull;
  importacoes: NumOrNull;
  saldo: NumOrNull;
};

export type IdpVsTcPonto = {
  mes: string;
  tc_pct_pib: NumOrNull;
  deficit_abs_pct_pib: NumOrNull;
  idp_pct_pib: NumOrNull;
};

export type IdpDecomposicaoPonto = {
  mes: string;
  total: NumOrNull;
  participacao: NumOrNull;
  reinvestimento: NumOrNull;
  intercompanhia: NumOrNull;
};

export type ReservasPonto = {
  data: string;
  reservas_us_bi: number;
};

// ── v2 (acumulados 12m sobre a série completa + decomposições com códigos validados) ──

/** Acumulado 12m em US$ bi: bens+serviços+rendas = total (identidade auditada no builder). */
export type Bp12mPonto = {
  mes: string;
  bens: NumOrNull;
  servicos: NumOrNull;
  renda_primaria: NumOrNull;
  renda_secundaria: NumOrNull;
  total: NumOrNull;
};

export type Balanca12mPonto = { mes: string; exportacoes: NumOrNull; importacoes: NumOrNull; saldo: NumOrNull };

/** Cobertura do déficit pelo IDP: cobertura_pct = null quando a TC está superavitária. */
export type CoberturaIdpPonto = {
  mes: string;
  idp_pct_pib: NumOrNull;
  tc_pct_pib: NumOrNull;
  cobertura_pct: NumOrNull;
};

export type Idp12mPonto = {
  mes: string;
  participacao: NumOrNull;
  reinvestimento: NumOrNull;
  intercompanhia: NumOrNull;
  total: NumOrNull;
};

/** Serviços 12m (saldos US$ bi): transportes 22728, viagens 22740, telecom/informática 22776,
 * propriedade intelectual 22779; demais = residual auditado do total 22719. */
export type Servicos12mPonto = {
  mes: string;
  transportes: NumOrNull;
  viagens: NumOrNull;
  telecom_informatica: NumOrNull;
  propriedade_intelectual: NumOrNull;
  demais: NumOrNull;
  total: NumOrNull;
};

/** Renda primária 12m: lucros/dividendos IDP 22812, reinvestidos 22815, salários 22803;
 * juros_e_demais = residual auditado de 22806; total = 22800. */
export type Renda12mPonto = {
  mes: string;
  lucros_dividendos_idp: NumOrNull;
  lucros_reinvestidos: NumOrNull;
  juros_e_demais: NumOrNull;
  salarios: NumOrNull;
  total: NumOrNull;
};

export type MesesImportacaoPonto = { mes: string; meses_bens: NumOrNull; meses_bens_servicos: NumOrNull };

// ── v3 (cockpit do BP: tabela mestra, PII, fluxo cambial, Focus, revisões) ──

/** Linha da tabela mestra do BPM6 (ordem = apresentação do BCB). */
export type BpLinha = { key: string; label: string; nivel: number; sgs: number | null };

/** Registro mensal/12m: `mes` + uma coluna por `BpLinha.key` (mensal em US$ mi; 12m em US$ bi). */
export type BpRegistro = { mes: string; pib?: NumOrNull } & Record<string, NumOrNull | string | undefined>;

export type BpMestre = {
  linhas: BpLinha[];
  mensal: BpRegistro[];
  acum_12m: BpRegistro[];
  identidade: { formula: string; tolerancia_usd_mi: number; meses_ok: number; violacoes: number };
  _nota?: string;
};

export type PiiPonto = {
  trim: string;
  mes_fim: string;
  liquida: NumOrNull;
  ativos: NumOrNull;
  ide: NumOrNull;
  carteira_ativos: NumOrNull;
  reservas: NumOrNull;
  passivos: NumOrNull;
  idp: NumOrNull;
  idp_intercompanhia: NumOrNull;
  carteira_passivos: NumOrNull;
  acoes_passivos: NumOrNull;
  titulos_passivos: NumOrNull;
  titulos_domesticos: NumOrNull;
  titulos_externos: NumOrNull;
  oi_passivos: NumOrNull;
  divida_cp: NumOrNull;
  guidotti: NumOrNull;
  pib_12m: NumOrNull;
};

export type FluxoCambialMensal = {
  mes: string;
  total: NumOrNull;
  comercial: NumOrNull;
  financeiro: NumOrNull;
  dias_uteis: number;
  total_12m: NumOrNull;
  comercial_12m: NumOrNull;
  financeiro_12m: NumOrNull;
};

export type FluxoCambial = {
  mensal: FluxoCambialMensal[];
  diario_90d: { data: string; total: NumOrNull; comercial: NumOrNull; financeiro: NumOrNull }[];
  ultimo_dia: string;
  mes_corrente_parcial: boolean;
  ano_corrente: { ano: string; total: NumOrNull; comercial: NumOrNull; financeiro: NumOrNull };
  _nota?: string;
};

export type FocusColeta = { data: string; mediana: NumOrNull; dp: NumOrNull; n: number | null };
/** indicador → ano de referência → coletas semanais. */
export type FocusExterno = {
  conta_corrente?: Record<string, FocusColeta[]>;
  balanca?: Record<string, FocusColeta[]>;
  idp?: Record<string, FocusColeta[]>;
  cambio?: Record<string, FocusColeta[]>;
  ultima_coleta?: string | null;
  _nota?: string;
};

export type RevisoesBp = {
  revised_at: string | null;
  n_meses: number;
  max_abs_diff_usd_bi?: number;
  amostra?: { mes: string; antes: number; depois: number; diff: number }[];
  _nota?: string;
};

export type ContasExternasData = {
  schema_version?: number;
  gerado_em: string;
  fonte_principal: string;
  ultima_referencia_mensal: string | null;
  ultima_referencia_diaria: string | null;
  hero: ContasExternasHero;
  bloco_a: {
    saldo_anual: SaldoAnualPonto[];
    decomposicao_mensal_36m: BpDecomposicaoPonto[];
    balanca_comercial_36m: BalancaComercialPonto[];
    /** v2 */
    decomposicao_12m?: Bp12mPonto[];
    balanca_12m?: Balanca12mPonto[];
  };
  bloco_b: {
    idp_vs_tc_pct_pib: IdpVsTcPonto[];
    idp_decomposicao_36m: IdpDecomposicaoPonto[];
    /** v2 */
    cobertura_idp?: CoberturaIdpPonto[];
    idp_decomposicao_12m?: Idp12mPonto[];
  };
  bloco_c: {
    reservas_diaria: ReservasPonto[];
    meses_importacao_recente: NumOrNull;
    /** v2 */
    reservas_mensal?: { mes: string; reservas_us_bi: NumOrNull }[];
    meses_importacao_serie?: MesesImportacaoPonto[];
  };
  /** v2 */
  bloco_servicos?: { serie_12m: Servicos12mPonto[]; _nota?: string };
  bloco_renda?: { serie_12m: Renda12mPonto[]; _nota?: string };
  /** v3 */
  bp_mestre?: BpMestre;
  pii?: { serie: PiiPonto[]; ultimo_trim?: string | null; _nota?: string };
  fluxo_cambial?: FluxoCambial;
  focus?: FocusExterno;
  revisoes?: RevisoesBp;
  metadata: {
    fonte: string;
    nota: string;
    series_sgs: Record<string, number>;
    series_diarias_sgs: Record<string, number>;
  };
};

// ---------------------------------------------------------------------------
// Comex Stat (SECEX/MDIC) — comércio exterior por produto/país
// ---------------------------------------------------------------------------
const COMEX_BLOB_PATH = "data/contas_externas_comex.json";

export type CategoriaPonto = { categoria: string; valor_us_bi: number };
export type NcmPonto = { ncm: string; nome: string; valor_us_bi: number };
export type PaisPonto = { pais: string; valor_us_bi: number };
export type SecaoSeriePonto = Record<string, number | string>;

export type ContasExternasComexData = {
  gerado_em: string;
  fonte_principal: string;
  periodo_12m: { from: string; to: string };
  top_ncm_export_12m: NcmPonto[];
  top_ncm_import_12m: NcmPonto[];
  categorias_export_12m: CategoriaPonto[];
  categorias_import_12m: CategoriaPonto[];
  top_destinos_12m: PaisPonto[];
  top_origens_12m: PaisPonto[];
  secao_export_24m: SecaoSeriePonto[];
  secao_import_24m: SecaoSeriePonto[];
  secao_export_top6: string[];
  secao_import_top6: string[];
  metadata: { fonte: string; endpoint: string; nota: string };
};

// ---------------------------------------------------------------------------
// Câmbio econômico (sub-área de Contas Externas) — câmbio real e paridade de
// juros. 1 JSON no Blob: data/cambio_macro.json — build_cambio_macro.py
// (step próprio do contas-externas-pipeline.yml, continue-on-error).
// ---------------------------------------------------------------------------
const CAMBIO_MACRO_BLOB_PATH = "data/cambio_macro.json";

export type CambioNominalPonto = {
  mes: string;
  ptax_media: number;
  ptax_fim: NumOrNull;
};

export type CambioRealPonto = { mes: string; indice: number };

/** Bloco de índice de câmbio real (bilateral construído ou REER 11752). */
export type CambioRealBloco = {
  serie: CambioRealPonto[];
  media_hist: number;
  dp_hist: number;
  /** Janela usada na média/dp (ex.: "2000-01+"). */
  janela_regua: string;
  ultimo: { mes: string; indice: number };
};

export type DiferencialJurosPonto = {
  mes: string;
  selic_meta: number;
  fed_funds: number;
  diferencial_pp: number;
};

export type UipPonto = {
  mes: string;
  diferencial_t12_pp: number;
  var_cambial_12m_pct: number;
};

export type IndiceMensalBloco = {
  sgs?: number;
  fonte?: string;
  base?: string;
  serie: CambioRealPonto[];
  ultimo: { mes: string; indice: number };
  var_12m_pct: NumOrNull;
};

export type PpcPonto = {
  ano: string;
  ppc: number;
  ptax_media: NumOrNull;
  nivel_precos_relativo: NumOrNull;
  desvio_ptax_vs_ppc_pct: NumOrNull;
  parcial: boolean;
};

/** v2 do cambio_macro — cada bloco pode vir null (fonte opcional). */
export type CambioExtras = {
  reer_ipa?: IndiceMensalBloco | null;
  efetivo_nominal?: IndiceMensalBloco | null;
  real_usd_oficial?: IndiceMensalBloco | null;
  icbr_reais?: IndiceMensalBloco | null;
  icbr_usd?: IndiceMensalBloco | null;
  termos_troca?: IndiceMensalBloco | null;
  ppc?: { fonte: string; serie: PpcPonto[]; _nota?: string } | null;
  juro_real?: {
    metodologia: string;
    serie: { mes: string; real_br: number; real_eua: number; diferencial_real_pp: number }[];
  } | null;
};

export type CambioMacroData = {
  schema_version: number;
  generated_at: string;
  ultima_referencia_mensal: string;
  nominal: {
    serie: CambioNominalPonto[];
    ptax_ultimo: { data: string; valor: number };
  };
  cambio_real: {
    /** CONVENÇÃO (não inverta): alta do índice = DEPRECIAÇÃO real do BRL. */
    convencao: string;
    bilateral: CambioRealBloco & {
      base_100: string;
      metodologia: string;
      desvio_vs_media_pct: number;
    };
    reer: CambioRealBloco & {
      sgs: number;
      definicao: string;
      var_12m_pct: NumOrNull;
    };
  };
  juros: {
    diferencial: { metodologia: string; serie: DiferencialJurosPonto[] };
    uip: {
      metodologia: string;
      pontos: UipPonto[];
      stats: {
        n: number;
        correlacao: NumOrNull;
        erro_medio_pp: NumOrNull;
        erro_dp_pp: NumOrNull;
        pct_depreciou_com_dif_positivo: NumOrNull;
      };
    };
  };
  hero: {
    ptax: { data: string; valor: number } | null;
    bilateral_vs_media_pct: NumOrNull;
    reer_var_12m_pct: NumOrNull;
    diferencial_pp: NumOrNull;
  };
  /** v2 */
  extras?: CambioExtras;
  /** Estrutura reservada p/ os modelos de previsão do dono (vazia por ora). */
  previsao: { modelos: unknown[]; nota: string };
  metadata: {
    fonte: string;
    series_sgs: Record<string, number>;
    series_fred: Record<string, string>;
    fed_funds_rota: string;
    nota: string;
  };
};

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------
export async function loadContasExternas(): Promise<ContasExternasData | null> {
  try {
    // TTL curto + cache tag `blob:<path>` (purgada pelo POST /api/revalidate)
    const res = await fetchPainelBlob(BLOB_PATH, CONTAS_EXTERNAS_REVALIDATE_SECONDS);
    if (!res?.ok) {
      console.error(`[contas-externas] fetch ${BLOB_PATH}: ${res?.status ?? "sem base de Blob"}`);
      return null;
    }
    return (await res.json()) as ContasExternasData;
  } catch (e) {
    console.error(`[contas-externas] fetch ${BLOB_PATH}:`, e);
    return null;
  }
}

export async function loadContasExternasComex(): Promise<ContasExternasComexData | null> {
  try {
    const res = await fetchPainelBlob(COMEX_BLOB_PATH, CONTAS_EXTERNAS_REVALIDATE_SECONDS);
    if (!res?.ok) {
      console.error(`[contas-externas-comex] fetch ${COMEX_BLOB_PATH}: ${res?.status ?? "sem base de Blob"}`);
      return null;
    }
    const data = (await res.json()) as ContasExternasComexData;
    // Guarda de shape: se o builder mudar o contrato, o bloco Comex some
    // graciosamente em vez de derrubar a página com 500 no SSR.
    if (!data?.periodo_12m?.from || !Array.isArray(data.top_ncm_export_12m)) {
      console.error("[contas-externas-comex] payload em shape inesperado — bloco Comex desativado");
      return null;
    }
    return data;
  } catch (e) {
    console.error(`[contas-externas-comex] fetch ${COMEX_BLOB_PATH}:`, e);
    return null;
  }
}

export async function loadCambioMacro(): Promise<CambioMacroData | null> {
  try {
    const res = await fetchPainelBlob(CAMBIO_MACRO_BLOB_PATH, CONTAS_EXTERNAS_REVALIDATE_SECONDS);
    if (!res?.ok) {
      console.error(`[cambio-macro] fetch ${CAMBIO_MACRO_BLOB_PATH}: ${res?.status ?? "sem base de Blob"}`);
      return null;
    }
    const data = (await res.json()) as CambioMacroData;
    // Guarda de shape: se o builder mudar o contrato, a página degrada com o
    // card de erro em vez de derrubar o SSR com TypeError.
    if (
      !Array.isArray(data?.nominal?.serie) ||
      !Array.isArray(data?.cambio_real?.bilateral?.serie) ||
      !Array.isArray(data?.cambio_real?.reer?.serie) ||
      !Array.isArray(data?.juros?.diferencial?.serie)
    ) {
      console.error("[cambio-macro] payload em shape inesperado — página desativada");
      return null;
    }
    return data;
  } catch (e) {
    console.error(`[cambio-macro] fetch ${CAMBIO_MACRO_BLOB_PATH}:`, e);
    return null;
  }
}
