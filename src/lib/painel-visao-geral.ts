import { painelBlobUrl } from "@/lib/painel-blob";

export const VISAO_GERAL_REVALIDATE_SECONDS = 3600;

type NumOrNull = number | null;
export type Freshness = "fresh" | "stale" | "missing";
export type ContaInputs = Record<string, string>;
export type MetaCommon = { fonte?: string; nota?: string };

export type OecdCliPonto = {
  mes: string;
  nivel: number;
  var_6m_anualizada: NumOrNull;
  var_yoy: NumOrNull;
  quadrante: "expansao" | "desaceleracao" | "recessao" | "recuperacao" | null;
};

export type OecdCliData = {
  gerado_em: string;
  freshness_status: Freshness;
  mes_recente: string | null;
  serie: OecdCliPonto[];
  inputs: ContaInputs;
  min_start_date: string;
  destaques: {
    nivel_recente: NumOrNull;
    var_6m_anualizada_recente: NumOrNull;
    quadrante_recente: OecdCliPonto["quadrante"];
  };
  metadata: MetaCommon;
};

export type SerieMensal = { mes: string; valor: NumOrNull };

export type CreditoData = {
  gerado_em: string;
  freshness_status: Freshness;
  concessoes: {
    pf_total_nominal: SerieMensal[];
    pj_total_nominal: SerieMensal[];
    pf_total_real_12m_var_pct: SerieMensal[];
    pj_total_real_12m_var_pct: SerieMensal[];
    pf_veiculos_nominal: SerieMensal[];
    pf_naoconsignado_nominal: SerieMensal[];
    pf_imobiliario_nominal: SerieMensal[];
  };
  credito_pib: Array<{
    mes: string;
    credito_total_pct_pib: NumOrNull;
    credito_familias_pct_pib: NumOrNull;
    credito_empresas_pct_pib: NumOrNull;
  }>;
  agregados_monetarios: {
    m1: SerieMensal[];
    m2: SerieMensal[];
    m3: SerieMensal[];
    m4: SerieMensal[];
    m2_real_var_12m_pct: SerieMensal[];
  };
  inputs: ContaInputs;
  min_start_date: string;
  metadata: MetaCommon;
};

export type AnpPonto = {
  mes: string;
  gasolina_c_m3: NumOrNull;
  etanol_hidratado_m3: NumOrNull;
  diesel_m3: NumOrNull;
  qav_m3: NumOrNull;
  ciclo_otto_m3: NumOrNull;
  total_liquidos_m3: NumOrNull;
  gasolina_c_var_yoy_pct?: NumOrNull;
  etanol_hidratado_var_yoy_pct?: NumOrNull;
  diesel_var_yoy_pct?: NumOrNull;
  qav_var_yoy_pct?: NumOrNull;
  ciclo_otto_var_yoy_pct?: NumOrNull;
  total_liquidos_var_yoy_pct?: NumOrNull;
  gasolina_c_indice_2019?: NumOrNull;
  diesel_indice_2019?: NumOrNull;
  ciclo_otto_indice_2019?: NumOrNull;
  total_liquidos_indice_2019?: NumOrNull;
};

export type AnpData = {
  gerado_em: string;
  freshness_status: Freshness;
  mes_recente: string | null;
  serie: AnpPonto[];
  inputs: ContaInputs;
  min_start_date: string;
  metadata: MetaCommon;
};

export type AnfaveaPonto = {
  mes: string;
  producao_unidades: NumOrNull;
  vendas_unidades: NumOrNull;
  exportacao_unidades: NumOrNull;
  producao_var_yoy_pct: NumOrNull;
  vendas_var_yoy_pct: NumOrNull;
  exportacao_var_yoy_pct: NumOrNull;
  producao_indice_2019: NumOrNull;
  vendas_indice_2019: NumOrNull;
  exportacao_indice_2019: NumOrNull;
  producao_sobre_vendas: NumOrNull;
};

export type AnfaveaData = {
  gerado_em: string;
  freshness_status: Freshness;
  mes_recente: string | null;
  serie: AnfaveaPonto[];
  inputs: ContaInputs;
  min_start_date: string;
  metadata: MetaCommon;
};

export type EpePonto = {
  mes: string;
  residencial_gwh: NumOrNull;
  industrial_gwh: NumOrNull;
  comercial_gwh: NumOrNull;
  outros_gwh: NumOrNull;
  total_gwh: NumOrNull;
  residencial_var_yoy_pct: NumOrNull;
  industrial_var_yoy_pct: NumOrNull;
  comercial_var_yoy_pct: NumOrNull;
  total_var_yoy_pct: NumOrNull;
  industrial_indice_2019: NumOrNull;
  comercial_indice_2019: NumOrNull;
  total_indice_2019: NumOrNull;
};

export type EpeData = {
  gerado_em: string;
  freshness_status: Freshness;
  mes_recente: string | null;
  serie: EpePonto[];
  inputs: ContaInputs;
  min_start_date: string;
  metadata: MetaCommon;
};

export type CodaceFaixa = { pico: string; vale: string; tipo: "recessao" };

export type CodaceData = {
  gerado_em: string;
  freshness_status: Freshness;
  page_fingerprint: string | null;
  trimestral: CodaceFaixa[];
  mensal: CodaceFaixa[];
  inputs: ContaInputs;
  min_start_date: string;
  metadata: MetaCommon & { url_oficial?: string };
};

export type HiatoPonto = {
  mes: string;
  indice_sa: NumOrNull;
  gap_hp_pct: NumOrNull;
  gap_hamilton_pct: NumOrNull;
  // v2 do pipeline: terceiro método (tendência quadrática). Opcional — degrade gracioso.
  gap_quadratico_pct?: NumOrNull;
  gap_min_pct: NumOrNull;
  gap_max_pct: NumOrNull;
  gap_mediana_pct: NumOrNull;
};

export type HiatoData = {
  gerado_em: string;
  freshness_status: Freshness;
  mes_recente: string | null;
  serie: HiatoPonto[];
  inputs: ContaInputs;
  min_start_date: string;
  metadata: MetaCommon & { metodos?: Record<string, string> };
};

export type IcfPonto = {
  mes: string;
  icf_zscore: number;
  regime: "estimulativo" | "restritivo" | "neutro";
  n_componentes: number;
  z_selic_real_invertido: NumOrNull;
  z_ibov_6m: NumOrNull;
  z_reer: NumOrNull;
  selic_real_ex_ante_pct: NumOrNull;
};

export type IcfData = {
  gerado_em: string;
  freshness_status: Freshness;
  mes_recente: string | null;
  serie: IcfPonto[];
  inputs: ContaInputs;
  min_start_date: string;
  metadata: MetaCommon;
};

export type IbcBrPonto = {
  mes: string;
  indice_sa: NumOrNull;
  indice_ns: NumOrNull;
  var_mom: NumOrNull;
  var_yoy: NumOrNull;
  var_3m: NumOrNull;
  indice_sa_mm3: NumOrNull;
  var_yoy_mm3: NumOrNull;
  // v2 do pipeline: ritmo trimestral mm3/mm3 t-3, NÃO anualizado (convenção BCB RI). Opcional.
  var_ritmo_trimestral?: NumOrNull;
  // mm3/mm3 t-3 anualizado (SAAR). Opcional.
  var_3m3m_saar?: NumOrNull;
};

export type IbcBrData = {
  gerado_em: string;
  mes_recente: string;
  serie: IbcBrPonto[];
  metadata?: MetaCommon;
};

export type SeriePonto = { mes: string; valor: NumOrNull };

export type FgvAntecedentesBloco = { serie: SeriePonto[]; var_yoy?: SeriePonto[] };

export type FgvAntecedentesData = {
  gerado_em: string;
  freshness_status: Freshness;
  iace: FgvAntecedentesBloco;
  icce: FgvAntecedentesBloco;
  iaemp: FgvAntecedentesBloco;
  iie_br: FgvAntecedentesBloco;
  inputs?: ContaInputs;
  min_start_date?: string;
  metadata: MetaCommon;
};

export type FgvConfiancaData = {
  gerado_em: string;
  freshness_status: Freshness;
  ice: SeriePonto[];
  ici: SeriePonto[];
  icom: SeriePonto[];
  ics: SeriePonto[];
  icst: SeriePonto[];
  ica: SeriePonto[];
  icc: SeriePonto[];
  inputs?: ContaInputs;
  min_start_date?: string;
  metadata: MetaCommon;
};

export type CniData = {
  gerado_em: string;
  freshness_status: Freshness;
  icei: SeriePonto[];
  icei_atual?: SeriePonto[];
  icei_expectativas?: SeriePonto[];
  inec: SeriePonto[];
  inputs?: ContaInputs;
  min_start_date?: string;
  metadata: MetaCommon;
};

export type HardDataSerie = { mes: string; valor: NumOrNull; var_yoy_pct: NumOrNull };

export type HardDataBloco = { serie: HardDataSerie[]; freshness_status: Freshness };

export type HardDataData = {
  gerado_em: string;
  freshness_status: Freshness;
  abcr: HardDataBloco;
  abpo: HardDataBloco;
  snic: HardDataBloco;
  aco: HardDataBloco;
  fenabrave: HardDataBloco;
  inputs?: ContaInputs;
  min_start_date?: string;
  metadata: MetaCommon & { fontes?: Record<string, string> };
};

export type IpeadataBloco = {
  serie: { mes: string; valor: number | null; var_yoy_pct?: number | null }[];
  label: string;
  ipeacode: string;
};

export type IpeadataData = {
  gerado_em: string;
  freshness_status: Freshness;
  papelao_abpo: IpeadataBloco;
  aco_bruto: IpeadataBloco;
  fenabrave_emplac: IpeadataBloco;
  cnc_icec: IpeadataBloco;
  fecomercio_icc: IpeadataBloco;
  fgv_constr_exp?: IpeadataBloco;
  fgv_constr_atual?: IpeadataBloco;
  pim_pf_geral?: IpeadataBloco;
  metadata: MetaCommon;
};


// Focus PIB do BCB (consumido de data/fiscal-classicos.json)
// Apenas a mediana mais recente do ano corrente
export type FocusPibPonto = {
  data: string;
  mediana: number;
  media?: number;
  dp?: number;
  min?: number;
  max?: number;
};
export type FocusData = {
  expectativas_focus?: {
    pib_anuais?: Record<string, FocusPibPonto[]>;
  };
};

// PMC volume varejo oficial via SIDRA IBGE (sales leg do quartet TCB)
export type AtividadePmcPonto = {
  mes: string;
  restrito_volume_var_yoy?: NumOrNull;
  ampliado_volume_var_yoy?: NumOrNull;
  restrito_volume_indice_sa?: NumOrNull;
  ampliado_volume_indice_sa?: NumOrNull;
};
export type AtividadePmcData = {
  gerado_em: string;
  mes_recente: string | null;
  serie: AtividadePmcPonto[];
};

// PNAD Contínua trimestral - taxa de desocupacao (employment leg do quartet TCB)
export type EmpregoPnadPonto = {
  trim: string;
  "Taxa de desocupação"?: NumOrNull;
  "Taxa de participação na força de trabalho"?: NumOrNull;
  "Taxa de informalidade"?: NumOrNull;
  "Taxa composta de subutilização"?: NumOrNull;
  // Taxa de desocupação dessazonalizada (série desde 2012). Opcional — degrade gracioso.
  desocupacao_sa?: NumOrNull;
};
export type EmpregoPnadData = {
  gerado_em: string;
  trim_recente: string | null;
  taxas?: { serie: EmpregoPnadPonto[] };
};

// PIM-PF oficial via SIDRA IBGE (consumido de data/atividade_pim.json)
// usado como BENCHMARK OFICIAL no Bloco 4
export type AtividadePimPonto = {
  mes: string;
  var_mom_sa: NumOrNull;
  var_yoy: NumOrNull;
  var_acum_ano?: NumOrNull;
  var_acum_12m?: NumOrNull;
  indice?: NumOrNull;
  indice_sa?: NumOrNull;
};
// PIM categorias econômicas (bens consumo duráveis, capital, intermediários etc — componentes do IACE)
export type AtividadePimCategoriaPonto = {
  mes: string;
  bens_capital_var_yoy?: NumOrNull;
  bens_capital_indice_sa?: NumOrNull;
  bens_intermediarios_var_yoy?: NumOrNull;
  bens_intermediarios_indice_sa?: NumOrNull;
  bens_consumo_var_yoy?: NumOrNull;
  bens_consumo_indice_sa?: NumOrNull;
  bens_consumo_duraveis_var_yoy?: NumOrNull;
  bens_consumo_duraveis_indice_sa?: NumOrNull;
};
// PIM seções (transformação, extrativa)
export type AtividadePimSecaoPonto = {
  mes: string;
  industria_geral_var_yoy?: NumOrNull;
  transformacao_var_yoy?: NumOrNull;
  extrativa_var_yoy?: NumOrNull;
};
export type AtividadePimData = {
  gerado_em: string;
  mes_recente: string | null;
  geral?: { serie: AtividadePimPonto[] };
  categorias_economicas?: { serie: AtividadePimCategoriaPonto[] };
  secoes?: { serie: AtividadePimSecaoPonto[] };
};

// PMS — Pesquisa Mensal de Serviços (IBGE)
export type AtividadePmsPonto = {
  mes: string;
  volume_var_yoy?: NumOrNull;
  volume_indice_sa?: NumOrNull;
};
export type AtividadePmsData = {
  gerado_em: string;
  mes_recente: string | null;
  serie?: AtividadePmsPonto[];
};

// Antecedentes financeiros: slope DI + Ibov real + EMBI+ (Loop 25)
export type SlopeDiPonto = { mes: string; slope_di_pp: NumOrNull; pre_di_360d_pct?: NumOrNull; selic_meta_pct?: NumOrNull };
export type IbovRealPonto = { mes: string; ibov_real_indice?: NumOrNull; retorno_real_6m_pct: NumOrNull };
export type EmbiPonto = { mes: string; embi_bps: NumOrNull };
export type PnadRendaPonto = { trim: string; rendimento_real_brl: NumOrNull; var_yoy_pct?: NumOrNull };
export type ProbitAzPonto = { mes: string; diffusion?: NumOrNull; gap_hp?: NumOrNull; probit_fin?: NumOrNull; probit_az?: NumOrNull; mediana?: NumOrNull };
export type ProbitAzContribuicao = { feature: string; beta: number; x_std: number; contrib_z: number };
// v2 do pipeline: rótulo pt-BR + grupo econômico por código de feature. Opcional — degrade gracioso.
export type ProbitAzLabelPt = { rotulo: string; grupo: string };
export type ProbitAzMetadata = {
  // null = backtest formal ainda em construção (não exibir credencial)
  auc_backtest_OOS?: number | null;
  auc_nota?: string;
  modelos_base?: string[];
  obs_treino?: number;
  n_series_panel?: number;
  [k: string]: unknown;
};
export type ProbitAzData = {
  gerado_em: string;
  mes_recente: string | null;
  probabilidades?: { mes?: string; diffusion?: NumOrNull; gap_hp?: NumOrNull; probit_fin?: NumOrNull; probit_az?: NumOrNull; mediana?: NumOrNull };
  sinal_principal?: NumOrNull;
  serie?: ProbitAzPonto[];
  contribuicoes_top15?: ProbitAzContribuicao[];
  labels_pt?: Record<string, ProbitAzLabelPt>;
  metadata?: ProbitAzMetadata;
};

// ---------------------------------------------------------------------------
// FONTE ÚNICA de probabilidade de recessão (consome probabilidades.mediana /
// sinal_principal do JSON — não recalcula mediana no front).
// Fallback explícito: mediana null (n<3 modelos) -> probit_az isolado com aviso.
// ---------------------------------------------------------------------------
export type ProbitResumo = {
  // valor a exibir, escala 0-1 (mediana do JSON ou fallback probit_az isolado)
  valor: NumOrNull;
  // mediana do JSON (null quando pipeline não conseguiu calcular, n<3)
  mediana: NumOrNull;
  // true quando exibindo o probit_az isolado por falta de mediana
  usaFallback: boolean;
  // quantos dos 4 modelos têm valor no mês corrente
  nModelos: number;
  nAcima50: number;
  mes: string | null;
};

export function resumoProbabilidade(data: ProbitAzData | null): ProbitResumo {
  const probs = data?.probabilidades;
  const valores = probs
    ? [probs.diffusion, probs.gap_hp, probs.probit_fin, probs.probit_az].filter((v): v is number => typeof v === "number")
    : [];
  const nModelos = valores.length;
  const nAcima50 = valores.filter((v) => v >= 0.5).length;
  const mes = probs?.mes ?? data?.mes_recente ?? null;
  const mediana = typeof probs?.mediana === "number" ? probs.mediana : null;
  if (mediana !== null) {
    return { valor: mediana, mediana, usaFallback: false, nModelos, nAcima50, mes };
  }
  const fallback =
    typeof probs?.probit_az === "number"
      ? probs.probit_az
      : typeof data?.sinal_principal === "number"
        ? data.sinal_principal
        : null;
  return { valor: fallback, mediana: null, usaFallback: fallback !== null, nModelos, nAcima50, mes };
}

export type PnadRendaData = {
  gerado_em: string;
  trim_recente: string | null;
  serie?: PnadRendaPonto[];
};

export type AntecedentesFinData = {
  gerado_em: string;
  slope_di?: SlopeDiPonto[];
  ibov_real?: IbovRealPonto[];
  embi?: EmbiPonto[];
};

export type VisaoGeralPayload = {
  ibcbr: IbcBrData | null;
  oecdCli: OecdCliData | null;
  credito: CreditoData | null;
  anp: AnpData | null;
  anfavea: AnfaveaData | null;
  epe: EpeData | null;
  codace: CodaceData | null;
  hiato: HiatoData | null;
  icf: IcfData | null;
  fgvAntecedentes: FgvAntecedentesData | null;
  fgvConfianca: FgvConfiancaData | null;
  cni: CniData | null;
  hardData: HardDataData | null;
  ipeadata: IpeadataData | null;
  atividadePim: AtividadePimData | null;
  focusPib: FocusData | null;
  atividadePmc: AtividadePmcData | null;
  empregoPnad: EmpregoPnadData | null;
  atividadePms: AtividadePmsData | null;
  antecedentesFin: AntecedentesFinData | null;
  pnadRenda: PnadRendaData | null;
  probitAz: ProbitAzData | null;
};

async function fetchJson<T>(blobPath: string): Promise<T | null> {
  const url = painelBlobUrl(blobPath);
  if (!url) return null;
  try {
    const r = await fetch(url, { next: { revalidate: VISAO_GERAL_REVALIDATE_SECONDS } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function loadVisaoGeralPayload(): Promise<VisaoGeralPayload> {
  const [
    ibcbr,
    oecdCli,
    credito,
    anp,
    anfavea,
    epe,
    codace,
    hiato,
    icf,
    fgvAntecedentes,
    fgvConfianca,
    cni,
    hardData,
    ipeadata,
    atividadePim,
    focusPib,
    atividadePmc,
    empregoPnad,
    atividadePms,
    antecedentesFin,
    pnadRenda,
    probitAz,
  ] = await Promise.all([
    fetchJson<IbcBrData>("data/atividade_ibcbr.json"),
    fetchJson<OecdCliData>("data/visao_geral_oecd_cli.json"),
    fetchJson<CreditoData>("data/visao_geral_credito.json"),
    fetchJson<AnpData>("data/visao_geral_anp.json"),
    fetchJson<AnfaveaData>("data/visao_geral_anfavea.json"),
    fetchJson<EpeData>("data/visao_geral_epe.json"),
    fetchJson<CodaceData>("data/visao_geral_codace.json"),
    fetchJson<HiatoData>("data/visao_geral_hiato.json"),
    fetchJson<IcfData>("data/visao_geral_icf.json"),
    fetchJson<FgvAntecedentesData>("data/visao_geral_fgv_antecedentes.json"),
    fetchJson<FgvConfiancaData>("data/visao_geral_fgv_confianca.json"),
    fetchJson<CniData>("data/visao_geral_cni.json"),
    fetchJson<HardDataData>("data/visao_geral_hard_data.json"),
    fetchJson<IpeadataData>("data/visao_geral_ipeadata.json"),
    fetchJson<AtividadePimData>("data/atividade_pim.json"),
    fetchJson<FocusData>("data/fiscal-classicos.json"),
    fetchJson<AtividadePmcData>("data/atividade_pmc.json"),
    fetchJson<EmpregoPnadData>("data/emprego_pnad.json"),
    fetchJson<AtividadePmsData>("data/atividade_pms.json"),
    fetchJson<AntecedentesFinData>("data/visao_geral_antecedentes_fin.json"),
    fetchJson<PnadRendaData>("data/visao_geral_pnad_renda.json"),
    fetchJson<ProbitAzData>("data/visao_geral_probit_az.json"),
  ]);
  return { ibcbr, oecdCli, credito, anp, anfavea, epe, codace, hiato, icf, fgvAntecedentes, fgvConfianca, cni, hardData, ipeadata, atividadePim, focusPib, atividadePmc, empregoPnad, atividadePms, antecedentesFin, pnadRenda, probitAz };
}

// Extrai a mediana mais recente do Focus PIB para o ano corrente
export function focusPibAnoCorrente(focus: FocusData | null): { ano: number; mediana: number; data: string } | null {
  if (!focus?.expectativas_focus?.pib_anuais) return null;
  const anos = focus.expectativas_focus.pib_anuais;
  const anoAtual = new Date().getFullYear();
  const pontos = anos[String(anoAtual)] || anos[String(anoAtual + 1)];
  if (!pontos || pontos.length === 0) return null;
  const ult = pontos[pontos.length - 1];
  return { ano: anoAtual, mediana: ult.mediana, data: ult.data };
}

export function formatPct(v: NumOrNull, casas = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sinal = v >= 0 ? "+" : "";
  return sinal + v.toFixed(casas) + "%";
}

export function formatNumber(v: NumOrNull, casas = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });
}

export function formatMes(mes: string | null | undefined): string {
  if (!mes) return "—";
  const [ano, m] = mes.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return (meses[Number.parseInt(m, 10) - 1] ?? m) + "/" + ano;
}

export function ultimaObs<T extends { mes: string }>(serie: T[] | undefined): T | null {
  if (!serie || serie.length === 0) return null;
  return serie[serie.length - 1];
}

export function fraseManchete(payload: VisaoGeralPayload): string {
  const ibc = ultimaObs(payload.ibcbr?.serie);
  const icf = ultimaObs(payload.icf?.serie);
  const ice = ultimaObs(payload.fgvConfianca?.ice);
  const pim = (payload.atividadePim?.geral?.serie ?? []).slice(-1)[0];

  // FONTE ÚNICA: probabilidades.mediana / sinal_principal do JSON (resumoProbabilidade)
  const prob = resumoProbabilidade(payload.probitAz);
  const probPct = prob.valor !== null && prob.valor !== undefined ? prob.valor * 100 : null;

  // Coleta sinais — ritmo trimestral (3m/3m dessaz) é a leitura primária de atividade;
  // banda neutra centrada no potencial (+0,5% t/t ±0,5pp), não em zero.
  const ritmo = ibc?.var_ritmo_trimestral ?? null;
  const atividadeCai = ritmo !== null && ritmo !== undefined ? ritmo < 0 : ibc?.var_mom !== null && ibc?.var_mom !== undefined && ibc.var_mom < -0.1;
  const atividadeSobe = ritmo !== null && ritmo !== undefined ? ritmo > 1 : ibc?.var_mom !== null && ibc?.var_mom !== undefined && ibc.var_mom > 0.2;
  const selicAlta = icf?.selic_real_ex_ante_pct !== null && icf?.selic_real_ex_ante_pct !== undefined && icf.selic_real_ex_ante_pct > 6;
  const sondAlta = ice?.valor !== null && ice?.valor !== undefined && ice.valor > 100;
  const sondBaixa = ice?.valor !== null && ice?.valor !== undefined && ice.valor < 90;
  const alerta = probPct !== null && probPct >= 65;
  const cautela = probPct !== null && probPct >= 35 && probPct < 65;

  // Veredito honesto reconciliando conflitos
  let veredito: string;
  if (probPct === null) {
    veredito = "Sinal indisponível — modelos de probabilidade de recessão aguardando pipeline.";
  } else if (alerta) {
    veredito = "Alerta: os modelos sinalizam risco elevado de recessão.";
  } else if (atividadeCai && selicAlta && sondAlta) {
    veredito = "Cenário ambíguo: política monetária restritiva e atividade hesitante, mas expectativas FGV ainda otimistas.";
  } else if (atividadeCai && sondBaixa) {
    veredito = "Atenção: atividade negativa e confiança em deterioração.";
  } else if (cautela) {
    veredito = "Cautela: probabilidade de recessão em zona intermediária (35-65%).";
  } else if (atividadeSobe && sondAlta) {
    veredito = "Expansão sustentada: atividade acima do potencial e confiança em terreno otimista.";
  } else if (atividadeCai) {
    veredito = "Atividade desacelerando, mas modelos sem alerta de recessão.";
  } else {
    veredito = "Ciclo estável — sem disparos de alerta nos modelos.";
  }

  // Detalhamento (descreve sinais individuais, sem afirmar narrativa)
  const detalhes: string[] = [];
  if (ibc?.mes && ritmo !== null && ritmo !== undefined) {
    const verbo = ritmo > 1 ? "acima do potencial" : ritmo < 0 ? "em contração" : "próximo do potencial";
    detalhes.push("Em " + formatMes(ibc.mes) + " o ritmo trimestral da atividade foi de " + formatPct(ritmo) + " (3m/3m dessaz., IBC-Br) — " + verbo + ".");
  } else if (ibc?.mes && ibc.var_mom !== null && ibc.var_mom !== undefined) {
    const verbo = Math.abs(ibc.var_mom) < 0.05 ? "ficou estável" : ibc.var_mom > 0 ? "cresceu" : "caiu";
    detalhes.push("Em " + formatMes(ibc.mes) + " a atividade " + verbo + " " + formatPct(ibc.var_mom) + " (IBC-Br dessaz.).");
  }
  if (probPct !== null) {
    if (prob.usaFallback) {
      detalhes.push("Probabilidade de recessão em " + probPct.toFixed(0) + "% pelo Probit AZ — " + prob.nModelos + " de 4 modelos disponíveis; mediana indisponível. Backtest formal em construção.");
    } else {
      detalhes.push("Mediana de " + prob.nModelos + " de 4 modelos: " + probPct.toFixed(0) + "% de probabilidade de recessão (" + prob.nAcima50 + "/" + prob.nModelos + " acima de 50%). Backtest formal em construção.");
    }
  }
  if (icf?.selic_real_ex_ante_pct !== null && icf?.selic_real_ex_ante_pct !== undefined) {
    detalhes.push("Juro real ex-ante em " + icf.selic_real_ex_ante_pct.toFixed(1) + "% — " + (icf.selic_real_ex_ante_pct > 6 ? "fortemente restritivo" : icf.selic_real_ex_ante_pct > 3 ? "restritivo" : "neutro") + ".");
  }
  if (ice?.valor !== null && ice?.valor !== undefined) {
    detalhes.push("Confiança empresarial ICE FGV em " + ice.valor.toFixed(1) + " (" + (ice.valor > 100 ? "otimismo" : ice.valor < 90 ? "pessimismo" : "neutra") + ").");
  }
  if (pim?.var_yoy !== null && pim?.var_yoy !== undefined) {
    detalhes.push("Produção industrial (PIM-PF) " + (pim.var_yoy >= 0 ? "expande" : "contrai") + " " + formatPct(pim.var_yoy) + " a/a.");
  }

  if (detalhes.length === 0) {
    return veredito;
  }
  return veredito + " " + detalhes.join(" ");
}
