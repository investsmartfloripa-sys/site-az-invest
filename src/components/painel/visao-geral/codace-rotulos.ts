/**
 * Rótulo curto para as faixas de recessão CODACE exibidas nos gráficos
 * do Termômetro de Ciclo ('2008', '2014-16', 'COVID', ...).
 */
export function rotuloFaixaCodace(pico: string): string {
  const ano = pico.slice(0, 4);
  if (ano === "2014" || ano === "2015" || ano === "2016") return "2014-16";
  if (ano === "2019" || ano === "2020") return "COVID";
  return ano;
}
