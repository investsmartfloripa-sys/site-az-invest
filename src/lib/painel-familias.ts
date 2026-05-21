/**
 * Loaders dos JSONs do Painel Famílias — Brasil.
 *
 * Onda 1 — 2 JSONs no Blob:
 * - data/familias_endividamento.json — gerado por build_familias_endividamento.py
 * - data/familias_renda.json — gerado por build_familias_renda.py
 *
 * Workflow GitHub Actions: familias-pipeline.yml (cron diário 23h30 UTC).
 */

import { painelBlobUrl } from "@/lib/painel-blob";

export const FAMILIAS_REVALIDATE_SECONDS = 3600; // 1h
const BLOB_PATH_ENDIVIDAMENTO = "data/familias_endividamento.json";
const BLOB_PATH_RENDA = "data/familias_renda.json";

// ---------------------------------------------------------------------------
// Tipos — Endividamento
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
  revised_at?: string;    // YYYY-MM-DD do último update de valor
};

export type ComposicaoPctPonto = {
  mes: string;
  total_pf: number;
  habitacional_pct: number;
  consignado_pct: number;
  cartao_pct: number;
  veiculos_pct: number;
  credito_pessoal_pct: number;
  outras_pct: number;
};

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
// Tipos — Renda
// ---------------------------------------------------------------------------
export type RendaTotalPonto = {
  trim: string;                          // 'YYYY-MM' (último mês do trim móvel)
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
// Tipo agregado
// ---------------------------------------------------------------------------
export type FamiliasData = {
  endividamento: FamiliasEndividamentoData | null;
  renda: FamiliasRendaData | null;
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

export async function loadFamilias(): Promise<FamiliasData> {
  const [endividamento, renda] = await Promise.all([
    loadFamiliasEndividamento(),
    loadFamiliasRenda(),
  ]);
  return { endividamento, renda };
}
