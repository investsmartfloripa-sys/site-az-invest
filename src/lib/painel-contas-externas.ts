/**
 * Loader do JSON do Painel Contas Externas — Brasil, BPM6.
 *
 * 1 JSON no Blob: data/contas_externas.json — gerado por build_contas_externas.py
 * (workflow contas-externas-pipeline.yml, cron diário 23h30 UTC).
 */

import { painelBlobUrl } from "@/lib/painel-blob";

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

export type ContasExternasData = {
  gerado_em: string;
  fonte_principal: string;
  ultima_referencia_mensal: string | null;
  ultima_referencia_diaria: string | null;
  hero: ContasExternasHero;
  bloco_a: {
    saldo_anual: SaldoAnualPonto[];
    decomposicao_mensal_36m: BpDecomposicaoPonto[];
    balanca_comercial_36m: BalancaComercialPonto[];
  };
  bloco_b: {
    idp_vs_tc_pct_pib: IdpVsTcPonto[];
    idp_decomposicao_36m: IdpDecomposicaoPonto[];
  };
  bloco_c: {
    reservas_diaria: ReservasPonto[];
    meses_importacao_recente: NumOrNull;
  };
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
// Loaders
// ---------------------------------------------------------------------------
export async function loadContasExternas(): Promise<ContasExternasData | null> {
  const url = painelBlobUrl(BLOB_PATH);
  try {
    const res = await fetch(url, {
      next: { revalidate: CONTAS_EXTERNAS_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`[contas-externas] fetch ${url}: ${res.status}`);
      return null;
    }
    return (await res.json()) as ContasExternasData;
  } catch (e) {
    console.error(`[contas-externas] fetch ${url}:`, e);
    return null;
  }
}

export async function loadContasExternasComex(): Promise<ContasExternasComexData | null> {
  const url = painelBlobUrl(COMEX_BLOB_PATH);
  try {
    const res = await fetch(url, {
      next: { revalidate: CONTAS_EXTERNAS_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`[contas-externas-comex] fetch ${url}: ${res.status}`);
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
    console.error(`[contas-externas-comex] fetch ${url}:`, e);
    return null;
  }
}
