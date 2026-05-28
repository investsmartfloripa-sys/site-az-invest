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

export type RecessaoPonto = {
  mes: string;
  msdfm: NumOrNull;
  probit_financeiro: NumOrNull;
  gap_threshold: NumOrNull;
  diffusion: NumOrNull;
  bry_boschan: NumOrNull;
  mediana: NumOrNull;
  mediana_parcial?: NumOrNull;
  media?: NumOrNull;
  min_val?: NumOrNull;
  max_val?: NumOrNull;
  n_modelos: number;
  n_acima_50: number;
  sensiveis_presentes?: number;
  // Flag: true quando probit_financeiro do mes mais recente eh carry-forward
  // (replicado da ultima observacao real porque pipeline nao gerou valor novo)
  probit_carry?: boolean;
  carry_forward_modelos?: string[];
  sinalizacao: "verde" | "amarelo" | "vermelho" | "indeterminado";
};

export type RecessaoData = {
  gerado_em: string;
  freshness_status: Freshness;
  mes_recente: string | null;
  serie: RecessaoPonto[];
  inputs: ContaInputs;
  min_start_date: string;
  metadata: MetaCommon & { modelos: Record<string, string>; consolidacao?: string };
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

export type PmiPonto = {
  mes: string;
  manufatura?: NumOrNull;
  servicos?: NumOrNull;
  composto?: NumOrNull;
};

export type PmiData = {
  gerado_em: string;
  freshness_status: Freshness;
  serie: PmiPonto[];
  inputs?: ContaInputs;
  min_start_date?: string;
  metadata: MetaCommon;
};

export type FecomercioData = {
  gerado_em: string;
  freshness_status: Freshness;
  icec: SeriePonto[];
  icf: SeriePonto[];
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
  recessao: RecessaoData | null;
  fgvAntecedentes: FgvAntecedentesData | null;
  fgvConfianca: FgvConfiancaData | null;
  cni: CniData | null;
  pmi: PmiData | null;
  fecomercio: FecomercioData | null;
  hardData: HardDataData | null;
  ipeadata: IpeadataData | null;
  atividadePim: AtividadePimData | null;
  focusPib: FocusData | null;
  atividadePmc: AtividadePmcData | null;
  empregoPnad: EmpregoPnadData | null;
  atividadePms: AtividadePmsData | null;
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
    recessao,
    fgvAntecedentes,
    fgvConfianca,
    cni,
    pmi,
    fecomercio,
    hardData,
    ipeadata,
    atividadePim,
    focusPib,
    atividadePmc,
    empregoPnad,
    atividadePms,
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
    fetchJson<RecessaoData>("data/visao_geral_recessao.json"),
    fetchJson<FgvAntecedentesData>("data/visao_geral_fgv_antecedentes.json"),
    fetchJson<FgvConfiancaData>("data/visao_geral_fgv_confianca.json"),
    fetchJson<CniData>("data/visao_geral_cni.json"),
    fetchJson<PmiData>("data/visao_geral_pmi.json"),
    fetchJson<FecomercioData>("data/visao_geral_fecomercio.json"),
    fetchJson<HardDataData>("data/visao_geral_hard_data.json"),
    fetchJson<IpeadataData>("data/visao_geral_ipeadata.json"),
    fetchJson<AtividadePimData>("data/atividade_pim.json"),
    fetchJson<FocusData>("data/fiscal-classicos.json"),
    fetchJson<AtividadePmcData>("data/atividade_pmc.json"),
    fetchJson<EmpregoPnadData>("data/emprego_pnad.json"),
    fetchJson<AtividadePmsData>("data/atividade_pms.json"),
  ]);
  return { ibcbr, oecdCli, credito, anp, anfavea, epe, codace, hiato, icf, recessao, fgvAntecedentes, fgvConfianca, cni, pmi, fecomercio, hardData, ipeadata, atividadePim, focusPib, atividadePmc, empregoPnad, atividadePms };
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

export function sinalizacaoCor(s: RecessaoPonto["sinalizacao"]): { bg: string; text: string; label: string } {
  if (s === "vermelho") return { bg: "bg-red-100", text: "text-red-700", label: "Alerta de recessão" };
  if (s === "amarelo") return { bg: "bg-amber-100", text: "text-amber-700", label: "Sinal de risco" };
  if (s === "indeterminado") return { bg: "bg-zinc-100", text: "text-zinc-600", label: "Sinal incompleto (precisa 4+ modelos)" };
  return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Normal" };
}

export function ultimaObs<T extends { mes: string }>(serie: T[] | undefined): T | null {
  if (!serie || serie.length === 0) return null;
  return serie[serie.length - 1];
}

export function fraseManchete(payload: VisaoGeralPayload): string {
  const partes: string[] = [];
  const ibc = ultimaObs(payload.ibcbr?.serie);
  if (ibc?.mes && ibc.var_mom !== null && ibc.var_mom !== undefined) {
    const verbo = Math.abs(ibc.var_mom) < 0.05 ? "ficou estável" : ibc.var_mom > 0 ? "cresceu" : "caiu";
    partes.push("Em " + formatMes(ibc.mes) + " a atividade " + verbo + " " + formatPct(ibc.var_mom) + " (IBC-Br dessazonalizado).");
  }
  const rec = ultimaObs(payload.recessao?.serie);
  if (rec) {
    const sensiveis = rec.sensiveis_presentes ?? 0;
    if (sensiveis === 0 && rec.n_modelos > 0) {
      // Mostrar mediana parcial com asterisco quando faltam sensíveis
      const mp = rec.mediana_parcial;
      if (mp !== null && mp !== undefined) {
        partes.push("Modelos de recessão mostram mediana parcial de ~" + mp.toFixed(0) + "% (" + rec.n_modelos + " de 4 modelos rodaram — Probit e Diffusion aguardando próxima rodada).");
      } else {
        partes.push("Modelos de recessão com cobertura parcial (" + rec.n_modelos + " de 4 rodaram).");
      }
    } else if (rec.mediana !== null && rec.mediana !== undefined) {
      partes.push("Nossos modelos estimam mediana de " + rec.mediana.toFixed(0) + "% de probabilidade de recessão (" + rec.n_acima_50 + " de " + rec.n_modelos + " acima de 50%).");
    } else if (rec.mediana_parcial !== null && rec.mediana_parcial !== undefined) {
      partes.push("Modelos rodaram parcialmente: mediana ~" + rec.mediana_parcial.toFixed(0) + "% (" + rec.n_modelos + " de 4).");
    }
  }
  const oe = ultimaObs(payload.oecdCli?.serie);
  if (oe?.var_6m_anualizada !== null && oe?.var_6m_anualizada !== undefined) {
    const verbo = oe.var_6m_anualizada > 0.5 ? "acelera" : oe.var_6m_anualizada < -0.5 ? "desacelera" : "está estável";
    partes.push("O indicador antecedente OECD " + verbo + " em " + formatPct(oe.var_6m_anualizada) + " (variação 6m anualizada).");
  }
  const icf = ultimaObs(payload.icf?.serie);
  if (icf) {
    const regimeLabel = icf.regime === "estimulativo" ? "estimulativas" : icf.regime === "restritivo" ? "restritivas" : "neutras";
    partes.push("As condições financeiras estão " + regimeLabel + " (z-score " + icf.icf_zscore.toFixed(2) + ").");
  }
  const ice = ultimaObs(payload.fgvConfianca?.ice);
  if (ice && ice.valor !== null && ice.valor !== undefined) {
    const cnf = ice.valor > 100 ? "em terreno otimista" : ice.valor < 90 ? "em terreno pessimista" : "em zona neutra";
    partes.push("Confiança empresarial " + cnf + " (ICE FGV " + ice.valor.toFixed(1) + ").");
  }
  // PIM-PF oficial IBGE como ground truth final
  const pim = (payload.atividadePim?.geral?.serie ?? []).slice(-1)[0];
  if (pim && pim.var_yoy !== null && pim.var_yoy !== undefined) {
    partes.push("Produção industrial (PIM-PF IBGE) " + (pim.var_yoy >= 0 ? "expande" : "contrai") + " " + formatPct(pim.var_yoy) + " a/a em " + formatMes(pim.mes) + ".");
  }
  if (partes.length === 0) {
    return "Dados em atualização — aguardando próxima rodada do pipeline.";
  }
  return partes.join(" ");
}
