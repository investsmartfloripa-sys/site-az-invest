/**
 * Loaders dos JSONs do Painel Famílias — Brasil.
 *
 * Ondas 1+2 — 4 JSONs no Blob:
 * - data/familias_endividamento.json (B)
 * - data/familias_renda.json (A)
 * - data/familias_poder_compra.json (C)
 * - data/familias_estrutura_social.json (D)
 *
 * Workflow GitHub Actions: familias-pipeline.yml (cron diário 23h30 UTC).
 */

import { painelBlobUrl } from "@/lib/painel-blob";

export const FAMILIAS_REVALIDATE_SECONDS = 3600; // 1h
const BLOB_PATH_ENDIVIDAMENTO = "data/familias_endividamento.json";
const BLOB_PATH_RENDA = "data/familias_renda.json";
const BLOB_PATH_PODER_COMPRA = "data/familias_poder_compra.json";
const BLOB_PATH_ESTRUTURA_SOCIAL = "data/familias_estrutura_social.json";

// ---------------------------------------------------------------------------
// Tipos compartilhados
// ---------------------------------------------------------------------------
type NumOrNull = number | null;

export type FamiliasKpi = {
  data: string | null;
  valor: NumOrNull;
  unidade: string;
};

export type SeriePonto = {
  mes: string;            // YYYY-MM-DD (dia 01)
  valor: number;
  revised_at?: string;
};

export type ComposicaoPctPonto = {
  mes: string;
  total_pf: number;
  habitacional_pct: number;
  consignado_pct: number;
  cartao_pct: number;
  veiculos_pct: number;
  credito_pessoal_pct: number;
  // Presentes a partir da correção dos códigos SGS de saldo (20573/20609)
  cheque_especial_pct?: number;
  rural_pct?: number;
  outras_pct: number;
};

// ---------------------------------------------------------------------------
// Tipos — Endividamento (B)
// ---------------------------------------------------------------------------
export type FamiliasEndividamentoData = {
  gerado_em: string;
  fonte_principal: string;
  ultima_referencia_mensal: string | null;
  hero: {
    endividamento_total_pct_renda: FamiliasKpi;
    endividamento_sem_habit_pct_renda: FamiliasKpi;
    comprometimento_mensal_pct: FamiliasKpi;
    inad_cartao_rotativo_pct: FamiliasKpi;
  };
  bloco_endividamento: {
    series_pontos: Record<string, SeriePonto[]>;
    codigos_sgs: Record<string, number>;
  };
  bloco_comprometimento: {
    series_pontos: Record<string, SeriePonto[]>;
    codigos_sgs: Record<string, number>;
  };
  bloco_inadimplencia: {
    series_pontos: Record<string, SeriePonto[]>;
    codigos_sgs: Record<string, number>;
  };
  bloco_estoque: {
    series_pontos: Record<string, SeriePonto[]>;
    composicao_pct: ComposicaoPctPonto[];
    codigos_sgs: Record<string, number>;
  };
  metadata: {
    fonte: string;
    nota: string;
    campo_revised_at: string;
    defasagem_publicacao: string;
  };
};

// ---------------------------------------------------------------------------
// Tipos — Renda (A)
// ---------------------------------------------------------------------------
export type RendaTotalPonto = {
  trim: string;
  rendimento_medio_real?: NumOrNull;
  rendimento_medio_nominal?: NumOrNull;
  var_pct_aa_real?: NumOrNull;
  var_pct_aa_nominal?: NumOrNull;
};

export type RendaPosicaoPonto = {
  trim: string;
  total?: NumOrNull;
  empregado_privado_com_carteira?: NumOrNull;
  empregado_privado_sem_carteira?: NumOrNull;
  trabalhador_domestico?: NumOrNull;
  empregado_publico?: NumOrNull;
  empregador?: NumOrNull;
  conta_propria?: NumOrNull;
};

export type SerieDataPonto = { data: string; valor: number };

export type FamiliasRendaData = {
  gerado_em: string;
  trim_recente: string | null;
  fonte_principal: string;
  hero: {
    renda_real: {
      trim: string | null;
      valor: NumOrNull;
      var_pct_aa_real: NumOrNull;
      unidade: string;
    };
    salario_minimo_nominal: FamiliasKpi;
    salario_minimo_real: FamiliasKpi;
  };
  bloco_renda_total: {
    serie: RendaTotalPonto[];
    vars: Record<string, string>;
    sidra_tabela: number;
  };
  bloco_renda_posicao: {
    serie: RendaPosicaoPonto[];
    vars: Record<string, string>;
    sidra_tabela: number;
  };
  bloco_salario_minimo: {
    nominal_serie: SerieDataPonto[];
    real_serie: SerieDataPonto[];
    fontes: { nominal: string; real: string };
  };
  metadata: {
    fonte: string;
    nota: string;
    defasagem_publicacao: string;
  };
};

// ---------------------------------------------------------------------------
// Tipos — Poder de Compra (C)
// ---------------------------------------------------------------------------
export type CestaPonto = {
  data: string;
  cesta_brl: number;
  sm_brl: number;
  horas_sm: number;
  pct_sm: number;
};

export type CambioPonto = {
  data: string;
  sm_brl: number;
  ptax: number;
  sm_usd_ptax: number;
};

export type PpcPonto = {
  data: string;
  sm_usd_ppc?: number;
  ppc_taxa?: number;
};

export type RendaUsdPonto = {
  data: string;
  renda_brl: number;
  ptax: number;
  renda_usd_ptax: number;
};

export type FipezapPonto = {
  data: string;
  indice: number;
  var_pct_aa: number | null;
};

export type FamiliasPoderCompraData = {
  gerado_em: string;
  mes_recente: string | null;
  fonte_principal: string;
  hero: {
    cesta_horas_sm: {
      data: string | null;
      valor: NumOrNull;
      pct_sm: NumOrNull;
      unidade: string;
    };
    sm_usd_ptax: FamiliasKpi;
    sm_usd_ppc: FamiliasKpi;
    renda_media_usd_ptax: FamiliasKpi;
    fipezap: {
      data: string | null;
      indice: NumOrNull;
      var_pct_aa: NumOrNull;
      unidade: string;
    };
  };
  bloco_cesta_basica: {
    serie: CestaPonto[];
    horas_mes_referencia: number;
    fonte: string;
  };
  bloco_cambio_ptax: {
    serie: CambioPonto[];
    fonte: string;
  };
  bloco_ppc: {
    serie: PpcPonto[];
    fonte: string;
  };
  bloco_renda_media_usd: {
    serie: RendaUsdPonto[];
    fonte: string;
  };
  bloco_fipezap: {
    serie: FipezapPonto[];
    fonte: string;
  };
  metadata: {
    fonte: string;
    defasagem_publicacao: string;
    nota?: string;
  };
};

// ---------------------------------------------------------------------------
// Tipos — Estrutura Social (D)
// ---------------------------------------------------------------------------
export type ConcentracaoPonto = {
  ano: string;
  bottom40: number;
  middle50: number;
  top10: number;
};

export type PobrezaPonto = {
  ano: string;
  pct_300?: number;
  pct_420?: number;
  pct_830?: number;
  abs_215?: number;
  abs_365?: number;
};

export type TransferenciaPonto = {
  data: string;
  pbf_valor_milhoes?: number;
  bpc_valor_milhoes?: number;
  bpc_pessoas?: number;
};

export type GiniPonto = { ano: string; valor: number };

export type IpcaFaixaPonto = {
  data: string;
  muito_baixa?: number;
  baixa?: number;
  media_baixa?: number;
  media?: number;
  media_alta?: number;
  alta?: number;
};

export type FamiliasEstruturaSocialData = {
  gerado_em: string;
  ano_recente: string | null;
  mes_recente_mensal: string | null;
  fonte_principal: string;
  hero: {
    concentracao_top10: {
      ano: string | null;
      valor: NumOrNull;
      bottom40: NumOrNull;
      unidade: string;
    };
    pobreza_pct_830: {
      ano: string | null;
      valor: NumOrNull;
      unidade: string;
    };
    gini: {
      ano: string | null;
      valor: NumOrNull;
      unidade: string;
    };
    bolsa_familia: {
      data: string | null;
      valor_milhoes_brl: NumOrNull;
      unidade: string;
    };
  };
  bloco_concentracao_renda: {
    serie: ConcentracaoPonto[];
    fonte: string;
  };
  bloco_pobreza: {
    serie: PobrezaPonto[];
    fonte: string;
  };
  bloco_transferencias_sociais: {
    serie: TransferenciaPonto[];
    fonte: string;
  };
  bloco_gini: {
    serie: GiniPonto[];
    fonte: string;
  };
  bloco_ipca_faixa_renda: {
    /** Variação mensal crua (% a.m. — unidade original Ipeadata DIMAC_INF*). */
    serie: IpcaFaixaPonto[];
    /** Acumulado em índice, base 100 = primeiro mês (jul/2006). Ausente em JSONs antigos. */
    serie_indice?: IpcaFaixaPonto[];
    faixas: Record<string, string>;
    fonte: string;
    nota?: string;
  };
  metadata: {
    fonte: string;
    defasagem_publicacao: string;
    nota?: string;
  };
};

// ---------------------------------------------------------------------------
// Tipo agregado
// ---------------------------------------------------------------------------
export type FamiliasData = {
  endividamento: FamiliasEndividamentoData | null;
  renda: FamiliasRendaData | null;
  poder_compra: FamiliasPoderCompraData | null;
  estrutura_social: FamiliasEstruturaSocialData | null;
};

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------
async function fetchJson<T>(blobPath: string, label: string): Promise<T | null> {
  const url = painelBlobUrl(blobPath);
  if (!url) {
    console.error(`[familias] sem BLOB_BASE_URL para ${label}`);
    return null;
  }
  try {
    const res = await fetch(url, {
      next: { revalidate: FAMILIAS_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`[familias-${label}] fetch ${url}: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`[familias-${label}] fetch ${url}:`, e);
    return null;
  }
}

export async function loadFamiliasEndividamento(): Promise<FamiliasEndividamentoData | null> {
  return fetchJson<FamiliasEndividamentoData>(BLOB_PATH_ENDIVIDAMENTO, "endividamento");
}

export async function loadFamiliasRenda(): Promise<FamiliasRendaData | null> {
  return fetchJson<FamiliasRendaData>(BLOB_PATH_RENDA, "renda");
}

export async function loadFamiliasPoderCompra(): Promise<FamiliasPoderCompraData | null> {
  return fetchJson<FamiliasPoderCompraData>(BLOB_PATH_PODER_COMPRA, "poder_compra");
}

export async function loadFamiliasEstruturaSocial(): Promise<FamiliasEstruturaSocialData | null> {
  return fetchJson<FamiliasEstruturaSocialData>(BLOB_PATH_ESTRUTURA_SOCIAL, "estrutura_social");
}

export async function loadFamilias(): Promise<FamiliasData> {
  const [endividamento, renda, poder_compra, estrutura_social] = await Promise.all([
    loadFamiliasEndividamento(),
    loadFamiliasRenda(),
    loadFamiliasPoderCompra(),
    loadFamiliasEstruturaSocial(),
  ]);
  return { endividamento, renda, poder_compra, estrutura_social };
}
