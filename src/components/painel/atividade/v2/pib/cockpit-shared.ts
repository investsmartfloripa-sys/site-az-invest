/**
 * COCKPIT do PIB (21/09/2026) — recortes, lentes e derivadas leves compartilhadas
 * pelos cards da página PIB. Convenção da área: derivadas pesadas vêm do
 * BUILDER; aqui só há leitura de série, rebase, mediana/percentis e o nowcast
 * do IBC-Br (todos rotulados CALCULADO na ficha técnica).
 *
 * Base única de rebase da página PIB: MÉDIA DE 2019 = 100 (serve às duas
 * frequências no overlay IBC-Br × PIB). Substitui as 3 cópias de rebaseMedia2019.
 */

import type { AzSeriesPoint, AzUnit } from "@/components/painel/charts/AzTimeSeriesChart";
import type { AtividadeIbcBrData, AtividadePibData } from "@/lib/painel-atividade";
import { LABELS_PIB_FALLBACK } from "@/lib/painel-atividade";
import { num, trimIsoCentral } from "../shared";

/** Rebase para MÉDIA DO ANO = 100 (default 2019). Mensal ou trimestral. [] se o ano não existe na série. */
export function rebaseMedia(points: ReadonlyArray<AzSeriesPoint>, ano = 2019): AzSeriesPoint[] {
  const ini = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  const doAno = points.filter(([d]) => d >= ini && d <= fim).map(([, v]) => v);
  if (doAno.length === 0) return [];
  const base = doAno.reduce((a, b) => a + b, 0) / doAno.length;
  if (!(base > 0)) return [];
  return points.map(([d, v]) => [d, +((100 * v) / base).toFixed(3)] as const);
}

/** "2026-T02" → ISO do PRIMEIRO mês do trimestre ("2026-04-01") — p/ stepAfter alinhado ao calendário. */
export function trimIsoInicio(trim: string): string {
  const m = trim.match(/^(\d{4})-T(\d{1,2})$/);
  if (!m) return trim;
  const mes = (parseInt(m[2], 10) - 1) * 3 + 1;
  return `${m[1]}-${String(mes).padStart(2, "0")}-01`;
}

export type Banda = { mediana: number; p25: number; p75: number; min: number; max: number; n: number };

/** Mediana, p25/p75, mín e máx de um vetor — vazio → null. */
export function estatisticasBanda(valores: ReadonlyArray<number>): Banda | null {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const q = (p: number) => {
    const pos = (v.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo);
  };
  return {
    mediana: +q(0.5).toFixed(2),
    p25: +q(0.25).toFixed(2),
    p75: +q(0.75).toFixed(2),
    min: v[0],
    max: v[v.length - 1],
    n: v.length,
  };
}

// --- Recortes da SCN (ordem fixa) -------------------------------------------

export type RecortePib = { key: string; grupo: "oferta" | "demanda"; agregado?: boolean; folha?: boolean };

/** 17 recortes da oferta (ordem da SCN). `agregado` = subtotal; `folha` = entra nos tiles/difusão. */
export const RECORTES_OFERTA: readonly RecortePib[] = [
  { key: "agro", grupo: "oferta", folha: true },
  { key: "industria", grupo: "oferta", agregado: true },
  { key: "industria_extrativa", grupo: "oferta", folha: true },
  { key: "industria_transformacao", grupo: "oferta", folha: true },
  { key: "eletricidade_gas", grupo: "oferta", folha: true },
  { key: "construcao", grupo: "oferta", folha: true },
  { key: "servicos", grupo: "oferta", agregado: true },
  { key: "comercio", grupo: "oferta", folha: true },
  { key: "transporte", grupo: "oferta", folha: true },
  { key: "informacao", grupo: "oferta", folha: true },
  { key: "financeiras", grupo: "oferta", folha: true },
  { key: "imobiliarias", grupo: "oferta", folha: true },
  { key: "outros_servicos", grupo: "oferta", folha: true },
  { key: "admin_publica", grupo: "oferta", folha: true },
  { key: "valor_adicionado", grupo: "oferta", agregado: true },
  { key: "impostos", grupo: "oferta", agregado: true },
  { key: "pib", grupo: "oferta", agregado: true },
];

/** 6 componentes da demanda (ordem da SCN). Estoque só existe em % do PIB nominal (1846). */
export const RECORTES_DEMANDA: readonly RecortePib[] = [
  { key: "consumo_familias", grupo: "demanda", folha: true },
  { key: "consumo_governo", grupo: "demanda", folha: true },
  { key: "fbcf", grupo: "demanda", folha: true },
  { key: "variacao_estoque", grupo: "demanda" },
  { key: "exportacoes", grupo: "demanda", folha: true },
  { key: "importacoes", grupo: "demanda", folha: true },
];

/** Rótulo canônico do recorte (labels do JSON → fallback → key). */
export function rotuloRecorte(pib: Pick<AtividadePibData, "labels">, key: string): string {
  return pib.labels?.[key] ?? LABELS_PIB_FALLBACK[key] ?? key;
}

/** Rótulo curto p/ tiles e cabeçalhos de tabela (≤ ~16 chars). */
export const ROTULO_CURTO: Record<string, string> = {
  agro: "Agropecuária",
  industria: "Indústria",
  industria_extrativa: "Extrativa",
  industria_transformacao: "Transformação",
  eletricidade_gas: "Eletr., gás, água",
  construcao: "Construção",
  servicos: "Serviços",
  comercio: "Comércio",
  transporte: "Transporte",
  informacao: "Informação",
  financeiras: "Financeiras",
  imobiliarias: "Imobiliárias",
  outros_servicos: "Outros serviços",
  admin_publica: "Adm. pública",
  valor_adicionado: "Valor adicionado",
  impostos: "Impostos s/ prod.",
  pib: "PIB",
  consumo_familias: "Consumo famílias",
  consumo_governo: "Consumo governo",
  fbcf: "FBCF",
  variacao_estoque: "Var. estoques",
  exportacoes: "Exportações",
  importacoes: "Importações",
};

// --- Lentes (transformações) --------------------------------------------------

export type LentePibId = "qoq_sa" | "yoy" | "acum_4t" | "acum_ano" | "idx_sa" | "idx_ns" | "reais_sa" | "reais_ns" | "pct_pib";
export type LentePibGrupo = "nivel" | "variacao" | "peso";

export type LentePib = {
  id: LentePibId;
  label: string;
  grupo: LentePibGrupo;
  bloco: "indice_volume" | "valores_reais_sa" | "valores_reais_ns" | "variacao" | "estrutura_nominal";
  chave: (recorte: string) => string;
  /** Unidade p/ AzTimeSeriesChart. R$ é entregue em R$ BILHÕES (÷1000) com unit "none" + yAxisLabel. */
  unit: AzUnit;
  yAxisLabel?: string;
  /** Divide o valor bruto do JSON por este fator antes de plotar (R$ mi → R$ bi). */
  escala?: number;
  fonte: string;
};

/**
 * As 9 lentes que cobrem 100% das tabelas da CNT por recorte:
 * 5932 (4 variações) · 1621 (índice SA) · 1620 (índice NS) · 6613 (R$ SA) · 6612 (R$ NS) · 1846 (% PIB nominal).
 */
export const LENTES_PIB: readonly LentePib[] = [
  {
    id: "qoq_sa",
    label: "QoQ SA",
    grupo: "variacao",
    bloco: "variacao",
    chave: (k) => `qoq_sa_${k}`,
    unit: "%",
    fonte: "variação real vs trimestre anterior, com ajuste sazonal (SIDRA 5932 v6564)",
  },
  {
    id: "yoy",
    label: "YoY",
    grupo: "variacao",
    bloco: "variacao",
    chave: (k) => `yoy_${k}`,
    unit: "%",
    fonte: "variação real vs mesmo trimestre do ano anterior (SIDRA 5932 v6561)",
  },
  {
    id: "acum_4t",
    label: "Acum. 4T",
    grupo: "variacao",
    bloco: "variacao",
    chave: (k) => `acum_4t_${k}`,
    unit: "%",
    fonte: "variação real acumulada em 4 trimestres (SIDRA 5932 v6562)",
  },
  {
    id: "acum_ano",
    label: "Acum. ano",
    grupo: "variacao",
    bloco: "variacao",
    chave: (k) => `acum_ano_${k}`,
    unit: "%",
    fonte: "variação real acumulada no ano (SIDRA 5932 v6563)",
  },
  {
    id: "idx_sa",
    label: "Índice SA",
    grupo: "nivel",
    bloco: "indice_volume",
    chave: (k) => `sa_${k}`,
    unit: "index",
    yAxisLabel: "índice (1995 = 100)",
    fonte: "índice de volume com ajuste sazonal, média 1995 = 100 (SIDRA 1621)",
  },
  {
    id: "idx_ns",
    label: "Índice NS",
    grupo: "nivel",
    bloco: "indice_volume",
    chave: (k) => `ns_${k}`,
    unit: "index",
    yAxisLabel: "índice (1995 = 100)",
    fonte: "índice de volume sem ajuste sazonal, média 1995 = 100 (SIDRA 1620)",
  },
  {
    id: "reais_sa",
    label: "R$ SA",
    grupo: "nivel",
    bloco: "valores_reais_sa",
    chave: (k) => k,
    unit: "none",
    yAxisLabel: "R$ bi a preços de 1995",
    escala: 1000,
    fonte: "valores encadeados a preços de 1995, com ajuste sazonal, em R$ bilhões (SIDRA 6613)",
  },
  {
    id: "reais_ns",
    label: "R$ NS",
    grupo: "nivel",
    bloco: "valores_reais_ns",
    chave: (k) => k,
    unit: "none",
    yAxisLabel: "R$ bi a preços de 1995",
    escala: 1000,
    fonte: "valores encadeados a preços de 1995, sem ajuste sazonal, em R$ bilhões (SIDRA 6612)",
  },
  {
    id: "pct_pib",
    label: "% PIB",
    grupo: "peso",
    bloco: "estrutura_nominal",
    chave: (k) => `${k}_pct_pib`,
    unit: "%",
    fonte: "participação no PIB nominal a preços correntes (SIDRA 1846)",
  },
];

export function lentePib(id: LentePibId): LentePib {
  return LENTES_PIB.find((l) => l.id === id) ?? LENTES_PIB[0];
}

export type LinhaTrim = Record<string, unknown> & { trim: string };

export function blocoDoPib(pib: AtividadePibData, bloco: LentePib["bloco"]): ReadonlyArray<LinhaTrim> {
  switch (bloco) {
    case "indice_volume":
      return pib.indice_volume.serie as ReadonlyArray<LinhaTrim>;
    case "variacao":
      return pib.variacao.serie as ReadonlyArray<LinhaTrim>;
    case "valores_reais_sa":
      return (pib.valores_reais_sa?.serie ?? []) as ReadonlyArray<LinhaTrim>;
    case "valores_reais_ns":
      return (pib.valores_reais_ns?.serie ?? []) as ReadonlyArray<LinhaTrim>;
    case "estrutura_nominal":
      // O tipo do bloco não declara `trim`, mas o builder grava (ver painel-atividade.ts).
      return (pib.estrutura_nominal?.serie ?? []) as unknown as ReadonlyArray<LinhaTrim>;
  }
}

/** Série temporal de UM recorte numa lente → [iso (mês central), valor] já na escala de exibição. */
export function seriePib(pib: AtividadePibData, lente: LentePib, recorte: string): AzSeriesPoint[] {
  const rows = blocoDoPib(pib, lente.bloco);
  const campo = lente.chave(recorte);
  const out: AzSeriesPoint[] = [];
  for (const r of rows) {
    const v = num(r, campo);
    if (v != null) out.push([trimIsoCentral(String(r.trim)), lente.escala ? +(v / lente.escala).toFixed(3) : v]);
  }
  return out;
}

/** Último valor não-nulo de UM recorte numa lente (na escala de exibição). */
export function ultimoPib(pib: AtividadePibData, lente: LentePib, recorte: string): { trim: string; valor: number } | null {
  const rows = blocoDoPib(pib, lente.bloco);
  const campo = lente.chave(recorte);
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = num(rows[i], campo);
    if (v != null) return { trim: String(rows[i].trim), valor: lente.escala ? +(v / lente.escala).toFixed(3) : v };
  }
  return null;
}

/** Lentes com pelo menos um ponto para o recorte (evita combinações mortas, ex.: estoques × índice). */
export function lentesDisponiveis(pib: AtividadePibData, recorte: string): LentePib[] {
  return LENTES_PIB.filter((l) => {
    const rows = blocoDoPib(pib, l.bloco);
    const campo = l.chave(recorte);
    for (let i = rows.length - 1; i >= 0; i--) if (num(rows[i], campo) != null) return true;
    return false;
  });
}

/** Valor de uma chave num trimestre específico (ou null). */
export function valorNoTrim(rows: ReadonlyArray<LinhaTrim>, trim: string, campo: string): number | null {
  const r = rows.find((x) => x.trim === trim);
  return r ? num(r, campo) : null;
}

/** Banda de "estável" da área para taxas com 1 casa decimal (±0,05 p.p.). */
export const BANDA_ESTAVEL_PP = 0.05;

/** Difusão de um conjunto de valores: contagem sobe / estável (|v| ≤ banda) / cai. */
export function difusao(
  valores: ReadonlyArray<number | null | undefined>,
  banda = BANDA_ESTAVEL_PP,
): { sobe: number; estavel: number; cai: number; n: number } {
  let sobe = 0;
  let estavel = 0;
  let cai = 0;
  for (const v of valores) {
    if (v == null || !Number.isFinite(v)) continue;
    if (v > banda) sobe++;
    else if (v < -banda) cai++;
    else estavel++;
  }
  return { sobe, estavel, cai, n: sobe + estavel + cai };
}

// --- Nowcast do IBC-Br (CALCULADO no cliente até o builder gravar) ---------------

/**
 * Prévia do trimestre corrente alinhada ao calendário (QTD): média do índice SA
 * dos meses já divulgados do trimestre corrente ÷ média SA do trimestre
 * anterior − 1. Diferente de `var_ritmo_trimestral` do builder, que é a média
 * móvel ROLANTE (mai–jul vs fev–abr), não o trimestre-calendário. null quando o
 * trimestre anterior está incompleto.
 */
export function nowcastQtd(ibcbr: AtividadeIbcBrData): {
  trimCorrente: string;
  mesesDivulgados: number;
  valor: number;
  ultimoMes: string;
} | null {
  const serie = ibcbr.serie.filter((r) => r.indice_sa != null);
  if (serie.length < 4) return null;
  const ult = serie[serie.length - 1];
  const [anoStr, mesStr] = ult.mes.split("-");
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const tri = Math.floor((mes - 1) / 3) + 1;
  const meses = (a: number, t: number) => [1, 2, 3].map((i) => `${a}-${String((t - 1) * 3 + i).padStart(2, "0")}`);
  const doTri = serie.filter((r) => meses(ano, tri).includes(r.mes));
  const triAnt = tri === 1 ? { a: ano - 1, t: 4 } : { a: ano, t: tri - 1 };
  const doAnt = serie.filter((r) => meses(triAnt.a, triAnt.t).includes(r.mes));
  if (doTri.length === 0 || doAnt.length < 3) return null;
  const media = (xs: typeof serie) => xs.reduce((s, r) => s + (r.indice_sa as number), 0) / xs.length;
  const valor = +((media(doTri) / media(doAnt) - 1) * 100).toFixed(2);
  return { trimCorrente: `${ano}-T0${tri}`, mesesDivulgados: doTri.length, valor, ultimoMes: ult.mes };
}

/** Texto padrão do botão "Baixar CSV" da toolbar dos cards. */
export const BTN_CSV_CLASS =
  "rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] transition-colors hover:bg-zinc-50";
