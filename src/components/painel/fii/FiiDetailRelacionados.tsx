/**
 * Placeholders pros blocos "Vídeos relacionados" e "FIIs relacionados"
 * no rodapé da página individual. Decisão editorial:
 *
 *   - Vídeos relacionados: dependem de integração com canal AZ Invest no
 *     YouTube (filtro por menção do ticker no título/descrição). Definição
 *     da fonte automática fica pra Onda 2 — por enquanto, esconde.
 *
 *   - FIIs relacionados: peers do mesmo segmento do screener. Quando
 *     decidirmos critério (top N do segmento por liquidez? por DY?), liga
 *     direto no JSON do screener.
 *
 * Enquanto os critérios não estão decididos, o componente não mostra nada
 * (revisão de 12/11/2026: aviso "em construção" na página passava impressão de
 * site inacabado). Quando estiverem, este arquivo é o ponto de extensão natural.
 */
export function FiiDetailRelacionados() {
  return null;
}
