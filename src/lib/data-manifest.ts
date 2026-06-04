/**
 * Manifest central de dados do Painel Econômico.
 *
 * Fonte única de verdade que mapeia: painel (página pública) → JSONs/SVGs no
 * Vercel Blob → workflow do GitHub Actions → cadência esperada de giro.
 *
 * Consumido por:
 *  - src/lib/data-health.ts (dashboard "Saúde dos dados" na área logada)
 *  - futuras checagens automáticas de pipeline
 *
 * Ao criar um pipeline novo (script em data-pipeline/python + workflow),
 * ADICIONE a fonte aqui — senão ela fica invisível pro monitoramento.
 */

export type Cadence =
  | "15min" // cron */15 contínuo (panorama)
  | "intraday-util" // cron de minutos restrito a pregão/dias úteis (FII live)
  | "diario" // cron diário 7 dias por semana
  | "diario-util" // cron diário em dias úteis (yfinance/ANBIMA)
  | "semanal"
  | "mensal" // cron mensal ou janela de divulgação mensal
  | "trimestral";

export type PainelDef = {
  key: string;
  label: string;
  /** Rota pública principal do painel. */
  pagePath: string;
};

export type DataSourceDef = {
  /** Identificador único (vira chave do snapshot no banco). */
  key: string;
  label: string;
  /** Caminho no Vercel Blob (data/*.json ou charts/static/*.svg). */
  blobPath: string;
  /** "json" lê metadados internos; "svg" usa HEAD + last-modified. */
  kind?: "json" | "svg";
  /** Arquivo .yml em .github/workflows que gera essa fonte. */
  workflowName: string;
  /** Cadência esperada do giro (alimenta o cálculo de SLA). */
  cadence: Cadence;
  /** Painel/página a que a fonte pertence (agrupamento no dashboard). */
  painel: string;
  /** Rota pública específica, quando diferente da página do painel. */
  pagePath?: string;
  /** Dot-path do campo com a data do último dado (ex.: "periodo_3m.to"). */
  dataDateField?: string;
  /** JSON grande demais pra baixar no health-check → só HEAD. */
  heavy?: boolean;
};

export const PAINEIS: PainelDef[] = [
  { key: "panorama", label: "Panorama", pagePath: "/painel-economico/panorama" },
  { key: "renda-variavel", label: "Mercado · Renda variável", pagePath: "/painel-economico/mercado/brasil/renda-variavel" },
  { key: "renda-fixa", label: "Mercado · Renda fixa", pagePath: "/painel-economico/mercado/brasil/renda-fixa" },
  { key: "fii", label: "Mercado · Fundos Imobiliários", pagePath: "/painel-economico/mercado/brasil/fundos-imobiliarios" },
  { key: "mercado-ativos", label: "Mercado · Histórico e fundamentos", pagePath: "/painel-economico/mercado/historico" },
  { key: "termometro-ciclo", label: "Economia · Termômetro de Ciclo", pagePath: "/painel-economico/economia/brasil/termometro-ciclo" },
  { key: "atividade", label: "Economia · Atividade", pagePath: "/painel-economico/economia/brasil/atividade" },
  { key: "inflacao", label: "Economia · Inflação", pagePath: "/painel-economico/economia/brasil/inflacao" },
  { key: "emprego", label: "Economia · Emprego", pagePath: "/painel-economico/economia/brasil/emprego" },
  { key: "fiscal", label: "Economia · Fiscal", pagePath: "/painel-economico/economia/brasil/fiscal" },
  { key: "contas-externas", label: "Economia · Contas externas", pagePath: "/painel-economico/economia/brasil/contas-externas" },
  { key: "familias", label: "Economia · Famílias", pagePath: "/painel-economico/economia/brasil/familias" },
];

export const DATA_SOURCES: DataSourceDef[] = [
  // ── Panorama (data-pipeline.yml, cron */15) ────────────────────────────────
  { key: "asset_returns_panorama", label: "Retornos de ativos", blobPath: "data/asset_returns_panorama.json", workflowName: "data-pipeline.yml", cadence: "15min", painel: "panorama" },
  { key: "world_indices_returns_panorama", label: "Índices globais", blobPath: "data/world_indices_returns_panorama.json", workflowName: "data-pipeline.yml", cadence: "15min", painel: "panorama" },
  { key: "commodities_returns_panorama", label: "Commodities", blobPath: "data/commodities_returns_panorama.json", workflowName: "data-pipeline.yml", cadence: "15min", painel: "panorama" },
  { key: "sector_baskets_panorama", label: "Setores globais", blobPath: "data/sector_baskets_panorama.json", workflowName: "data-pipeline.yml", cadence: "15min", painel: "panorama" },
  { key: "br_sector_baskets_panorama", label: "Setores Brasil", blobPath: "data/br_sector_baskets_panorama.json", workflowName: "data-pipeline.yml", cadence: "15min", painel: "panorama" },
  { key: "fx_top_movers", label: "Câmbio (top movers)", blobPath: "data/fx_top_movers.json", workflowName: "data-pipeline.yml", cadence: "15min", painel: "panorama" },
  { key: "svg_selic_implicita", label: "SVG Selic implícita (R)", blobPath: "charts/static/selic_implicita.svg", kind: "svg", workflowName: "data-pipeline.yml", cadence: "15min", painel: "panorama" },
  { key: "svg_juros_treasury_us", label: "SVG Treasury EUA (R)", blobPath: "charts/static/juros_treasury_us.svg", kind: "svg", workflowName: "data-pipeline.yml", cadence: "15min", painel: "panorama" },

  // ── Renda variável (acoes-pipeline.yml, dias úteis 22:45/00:45 UTC) ────────
  { key: "acoes_ibov", label: "Ibovespa (hero)", blobPath: "data/acoes_ibov.json", workflowName: "acoes-pipeline.yml", cadence: "diario-util", painel: "renda-variavel" },
  { key: "acoes_valuation", label: "Valuation (P/L + prêmio)", blobPath: "data/acoes_valuation.json", workflowName: "acoes-pipeline.yml", cadence: "diario-util", painel: "renda-variavel" },
  { key: "acoes_screener", label: "Screener IBOV", blobPath: "data/acoes_screener.json", workflowName: "acoes-pipeline.yml", cadence: "diario-util", painel: "renda-variavel" },

  // ── Renda fixa (market-data.yml, dias úteis 22:30/00:30 UTC) ───────────────
  { key: "treasury_history", label: "Curvas de juros (ANBIMA TPF)", blobPath: "data/treasury_history.json", workflowName: "market-data.yml", cadence: "diario-util", painel: "renda-fixa", dataDateField: "last_data_date" },
  { key: "credit_spreads_history", label: "Spreads de crédito (debêntures)", blobPath: "data/credit_spreads_history.json", workflowName: "market-data.yml", cadence: "diario-util", painel: "renda-fixa", dataDateField: "last_data_date" },

  // ── FIIs (fii-pipeline-live.yml */15 em pregão; fii-pipeline.yml pesado) ───
  { key: "fii_ifix", label: "IFIX (hero)", blobPath: "data/fii_ifix.json", workflowName: "fii-pipeline-live.yml", cadence: "intraday-util", painel: "fii" },
  { key: "fii_screener", label: "Screener FIIs", blobPath: "data/fii_screener.json", workflowName: "fii-pipeline-live.yml", cadence: "intraday-util", painel: "fii" },
  { key: "fii_details", label: "Detalhe por ticker (107 FIIs)", blobPath: "data/fii_details.json", workflowName: "fii-pipeline.yml", cadence: "diario-util", painel: "fii", pagePath: "/painel-economico/mercado/brasil/fundos-imobiliarios", heavy: true },
  { key: "fii_macro_charts", label: "Macro charts (P/VP + prêmio)", blobPath: "data/fii_macro_charts.json", workflowName: "fii-pipeline.yml", cadence: "diario-util", painel: "fii" },

  // ── Mercado: histórico e fundamentos (market-data.yml) ─────────────────────
  { key: "market_catalog", label: "Catálogo de ativos", blobPath: "data/market_catalog.json", workflowName: "market-data.yml", cadence: "diario-util", painel: "mercado-ativos" },
  { key: "market_history_latest", label: "Histórico (recorte)", blobPath: "data/market_history_latest.json", workflowName: "market-data.yml", cadence: "diario-util", painel: "mercado-ativos" },
  { key: "market_history_full", label: "Histórico completo (5a)", blobPath: "data/market_history_full.json", workflowName: "market-data.yml", cadence: "diario-util", painel: "mercado-ativos", heavy: true },
  { key: "market_fundamentals", label: "Fundamentos (yfinance)", blobPath: "data/market_fundamentals.json", workflowName: "market-data.yml", cadence: "diario-util", painel: "mercado-ativos", pagePath: "/painel-economico/mercado/fundamentos" },

  // ── Termômetro de Ciclo (visao-geral-pipeline.yml, diário 22:00 UTC) ───────
  { key: "visao_geral_oecd_cli", label: "OCDE CLI Brasil", blobPath: "data/visao_geral_oecd_cli.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_credito", label: "Crédito e agregados (BCB)", blobPath: "data/visao_geral_credito.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_antecedentes_fin", label: "Antecedentes financeiros", blobPath: "data/visao_geral_antecedentes_fin.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_pnad_renda", label: "PNAD renda", blobPath: "data/visao_geral_pnad_renda.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_probit_az", label: "Probit AZ híbrido", blobPath: "data/visao_geral_probit_az.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_anp", label: "ANP combustíveis", blobPath: "data/visao_geral_anp.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_anfavea", label: "ANFAVEA veículos", blobPath: "data/visao_geral_anfavea.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_epe", label: "EPE energia", blobPath: "data/visao_geral_epe.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_codace", label: "CODACE cronologia", blobPath: "data/visao_geral_codace.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_ipeadata", label: "IPEADATA (papelão, aço, FENABRAVE)", blobPath: "data/visao_geral_ipeadata.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_fgv_antecedentes", label: "FGV antecedentes", blobPath: "data/visao_geral_fgv_antecedentes.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_fgv_confianca", label: "FGV confianças", blobPath: "data/visao_geral_fgv_confianca.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_cni", label: "CNI indústria", blobPath: "data/visao_geral_cni.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_pmi", label: "PMI Brasil", blobPath: "data/visao_geral_pmi.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_fecomercio", label: "Fecomércio SP", blobPath: "data/visao_geral_fecomercio.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_icf", label: "ICF (intenção de consumo)", blobPath: "data/visao_geral_icf.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_hiato", label: "Hiato do produto", blobPath: "data/visao_geral_hiato.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_hard_data", label: "Hard data (coincidentes)", blobPath: "data/visao_geral_hard_data.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },
  { key: "visao_geral_recessao", label: "Probabilidade de recessão (consolidado)", blobPath: "data/visao_geral_recessao.json", workflowName: "visao-geral-pipeline.yml", cadence: "diario", painel: "termometro-ciclo" },

  // ── Atividade (atividade-pipeline.yml, janelas mensais/trimestrais) ────────
  { key: "atividade_pib", label: "PIB trimestral", blobPath: "data/atividade_pib.json", workflowName: "atividade-pipeline.yml", cadence: "trimestral", painel: "atividade", pagePath: "/painel-economico/economia/brasil/atividade/pib", dataDateField: "trim_recente" },
  { key: "atividade_ibcbr", label: "IBC-Br", blobPath: "data/atividade_ibcbr.json", workflowName: "atividade-pipeline.yml", cadence: "mensal", painel: "atividade", dataDateField: "mes_recente" },
  { key: "atividade_pim", label: "PIM (indústria)", blobPath: "data/atividade_pim.json", workflowName: "atividade-pipeline.yml", cadence: "mensal", painel: "atividade", pagePath: "/painel-economico/economia/brasil/atividade/pim", dataDateField: "mes_recente" },
  { key: "atividade_pmc", label: "PMC (comércio)", blobPath: "data/atividade_pmc.json", workflowName: "atividade-pipeline.yml", cadence: "mensal", painel: "atividade", pagePath: "/painel-economico/economia/brasil/atividade/pmc", dataDateField: "mes_recente" },
  { key: "atividade_pms", label: "PMS (serviços)", blobPath: "data/atividade_pms.json", workflowName: "atividade-pipeline.yml", cadence: "mensal", painel: "atividade", pagePath: "/painel-economico/economia/brasil/atividade/pms", dataDateField: "mes_recente" },

  // ── Inflação (ipca-pipeline.yml, diário 12:00 UTC) ─────────────────────────
  { key: "ipca", label: "IPCA", blobPath: "data/ipca.json", workflowName: "ipca-pipeline.yml", cadence: "diario", painel: "inflacao", pagePath: "/painel-economico/economia/brasil/inflacao/ipca", dataDateField: "mes_recente" },
  { key: "igpm", label: "IGP-M", blobPath: "data/igpm.json", workflowName: "ipca-pipeline.yml", cadence: "diario", painel: "inflacao", pagePath: "/painel-economico/economia/brasil/inflacao/igp-m", dataDateField: "mes_recente" },

  // ── Emprego (emprego-pipeline.yml, janelas mensais dias 16 e 25-30) ────────
  { key: "emprego_pnad", label: "PNAD Contínua", blobPath: "data/emprego_pnad.json", workflowName: "emprego-pipeline.yml", cadence: "mensal", painel: "emprego", pagePath: "/painel-economico/economia/brasil/emprego/pnad" },
  { key: "emprego_caged_total", label: "CAGED saldo total", blobPath: "data/emprego_caged_total.json", workflowName: "emprego-pipeline.yml", cadence: "mensal", painel: "emprego", pagePath: "/painel-economico/economia/brasil/emprego/caged" },
  { key: "emprego_caged_quebras", label: "CAGED quebras (microdados)", blobPath: "data/emprego_caged_quebras.json", workflowName: "emprego-pipeline.yml", cadence: "mensal", painel: "emprego", pagePath: "/painel-economico/economia/brasil/emprego/caged" },

  // ── Fiscal (fiscal-pipeline.yml, diário 12:00 UTC) ─────────────────────────
  { key: "fiscal_classicos", label: "Fiscal clássicos (dívida, primário, Focus)", blobPath: "data/fiscal-classicos.json", workflowName: "fiscal-pipeline.yml", cadence: "diario", painel: "fiscal", pagePath: "/painel-economico/economia/brasil/fiscal/divida" },
  { key: "fiscal_termometro", label: "Termômetro fiscal", blobPath: "data/fiscal-termometro.json", workflowName: "fiscal-pipeline.yml", cadence: "diario", painel: "fiscal", pagePath: "/painel-economico/economia/brasil/fiscal/termometro-fiscal" },

  // ── Contas externas (contas-externas-pipeline.yml, diário 23:30 UTC) ───────
  { key: "contas_externas", label: "Balanço de pagamentos (BPM6)", blobPath: "data/contas_externas.json", workflowName: "contas-externas-pipeline.yml", cadence: "diario", painel: "contas-externas" },
  { key: "contas_externas_comex", label: "Comex Stat (SECEX)", blobPath: "data/contas_externas_comex.json", workflowName: "contas-externas-pipeline.yml", cadence: "diario", painel: "contas-externas", dataDateField: "periodo_3m.to" },

  // ── Famílias (familias-pipeline.yml, diário 23:30 UTC) ─────────────────────
  { key: "familias_renda", label: "Renda das famílias", blobPath: "data/familias_renda.json", workflowName: "familias-pipeline.yml", cadence: "diario", painel: "familias" },
  { key: "familias_endividamento", label: "Endividamento", blobPath: "data/familias_endividamento.json", workflowName: "familias-pipeline.yml", cadence: "diario", painel: "familias" },
  { key: "familias_poder_compra", label: "Poder de compra", blobPath: "data/familias_poder_compra.json", workflowName: "familias-pipeline.yml", cadence: "diario", painel: "familias" },
  { key: "familias_estrutura_social", label: "Estrutura social", blobPath: "data/familias_estrutura_social.json", workflowName: "familias-pipeline.yml", cadence: "diario", painel: "familias" },
];

/** SLA em minutos "efetivos" por cadência (fins de semana descontados quando business=true). */
export function cadenceSla(cadence: Cadence): { maxAgeMinutes: number; business: boolean } {
  switch (cadence) {
    case "15min":
      return { maxAgeMinutes: 90, business: false };
    case "intraday-util":
      return { maxAgeMinutes: 18 * 60, business: true };
    case "diario":
      return { maxAgeMinutes: 30 * 60, business: false };
    case "diario-util":
      return { maxAgeMinutes: 30 * 60, business: true };
    case "semanal":
      return { maxAgeMinutes: 8 * 1440, business: false };
    case "mensal":
      return { maxAgeMinutes: 35 * 1440, business: false };
    case "trimestral":
      return { maxAgeMinutes: 100 * 1440, business: false };
  }
}

export const CADENCE_LABEL: Record<Cadence, string> = {
  "15min": "15 min",
  "intraday-util": "intradiário (pregão)",
  diario: "diário",
  "diario-util": "diário (dias úteis)",
  semanal: "semanal",
  mensal: "mensal",
  trimestral: "trimestral",
};

export function getPainel(key: string): PainelDef | null {
  return PAINEIS.find((p) => p.key === key) ?? null;
}

export function getSource(key: string): DataSourceDef | null {
  return DATA_SOURCES.find((s) => s.key === key) ?? null;
}

/** Minutos de fim de semana (sáb/dom UTC) dentro do intervalo [from, to]. */
export function weekendMinutesBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let total = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (cursor < to) {
    const dayStart = Math.max(cursor.getTime(), from.getTime());
    const nextDay = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    const dayEnd = Math.min(nextDay.getTime(), to.getTime());
    const dow = cursor.getUTCDay();
    if (dow === 0 || dow === 6) total += Math.max(0, (dayEnd - dayStart) / 60000);
    cursor.setTime(nextDay.getTime());
  }
  return Math.round(total);
}

/** Idade "efetiva" em minutos (desconta fins de semana quando business=true). */
export function effectiveAgeMinutes(generatedAt: Date, now: Date, business: boolean): number {
  const raw = (now.getTime() - generatedAt.getTime()) / 60000;
  if (!business) return Math.round(raw);
  return Math.round(raw - weekendMinutesBetween(generatedAt, now));
}
