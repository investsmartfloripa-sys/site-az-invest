/**
 * Helpers do Painel IGP-M v2 (sem JSX): cores fixas dos componentes,
 * thresholds EDITORIAIS documentados (manchete/títulos afirmativos gerados
 * por regra — nunca ad-hoc) e leituras em prosa.
 *
 * Conversões genéricas (mesIso, num, toPoints, baixarCsv) são REUTILIZADAS
 * de ../v2/shared — não duplicar.
 */

import { AZ_BRAND, AZ_CHART, AZ_SERIES } from "@/lib/az-chart-theme";

export { baixarCsv, mesIso, num, toPoints } from "../v2/shared";

// ---------------------------------------------------------------------------
// Cores fixas dos componentes do IGP-M (mesma série = mesma cor em todo card)
// ---------------------------------------------------------------------------
export const CORES_COMPONENTE: Record<string, string> = {
  "IPA-M": AZ_BRAND.azure, // atacado — o motor do índice (peso efetivo ~69%)
  "IPC-M": AZ_BRAND.navy, // varejo FGV
  "INCC-M": AZ_SERIES[5], // construção (ocre)
};

/** Resíduo estrutural da decomposição — slate neutro (não é componente). */
export const COR_RESIDUO = AZ_CHART.ticks;

// ---------------------------------------------------------------------------
// Thresholds editoriais (documentados aqui e na ficha técnica)
// ---------------------------------------------------------------------------

/**
 * Banda de indiferença do spread IGP-M − IPCA em 12m: dentro de ±0,3 p.p.
 * a manchete diz "em linha com o IPCA" (diferença menor que isso é ruído
 * de arredondamento decendial, não mensagem).
 */
export const SPREAD_NEUTRO_PP = 0.3;

/**
 * Correlação cruzada considerada "forte" o bastante p/ título afirmativo
 * de antecedência ("o atacado tende a anteceder o IPCA"). Abaixo disso o
 * título vira a pergunta honesta ("relação fraca — por que descolam?").
 */
export const CORR_FORTE = 0.6;

/** Aluguel ilustrativo dos exemplos em R$ (KPI "IGP-M na vida real"). */
export const ALUGUEL_ILUSTRATIVO = 2000;

/** Posição do IGP-M 12m vs IPCA 12m, em prosa (regra única do painel). */
export function leituraSpread(igpm12m: number, ipca12m: number): string {
  const spread = igpm12m - ipca12m;
  if (spread > SPREAD_NEUTRO_PP) return "acima do IPCA — contratos indexados ao IGP-M sobem mais que a inflação ao consumidor";
  if (spread < -SPREAD_NEUTRO_PP) return "abaixo do IPCA — contratos indexados ao IGP-M sobem menos que a inflação ao consumidor";
  return "em linha com o IPCA";
}

/** Versão curta p/ títulos. */
export function leituraSpreadCurta(igpm12m: number, ipca12m: number): string {
  const spread = igpm12m - ipca12m;
  if (spread > SPREAD_NEUTRO_PP) return "acima do IPCA";
  if (spread < -SPREAD_NEUTRO_PP) return "abaixo do IPCA";
  return "em linha com o IPCA";
}

/**
 * Leitura do reajuste de aluguel pela regra contratual de mercado: a maioria
 * dos contratos tem cláusula de não-redução — IGP-M 12m negativo congela o
 * aluguel, não reduz (nuance que diferencia assessoria de terminal de dados).
 */
export function leituraAluguel(igpm12m: number): string {
  if (igpm12m < 0)
    return "aluguel fica estável: o IGP-M acumulado é negativo e a cláusula de não-redução segura o reajuste em zero";
  if (igpm12m === 0) return "aluguel fica estável";
  return `aluguel sobe ${igpm12m.toFixed(2).replace(".", ",")}% no reajuste anual`;
}

/** Nome curto do componente p/ legendas ("IPA-M" → "IPA"). */
export function nomeCurto(c: string): string {
  return c.replace(/-M$/, "");
}
