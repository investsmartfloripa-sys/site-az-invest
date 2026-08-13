import { permanentRedirect } from "next/navigation";

/**
 * O Termômetro Fiscal virou "Indicadores de Risco Fiscal" (reforma ago/2026).
 * Redirect permanente preserva links antigos e SEO.
 */
export default function TermometroFiscalRedirect() {
  permanentRedirect("/painel-economico/economia/brasil/fiscal/indicadores-de-risco-fiscal");
}
