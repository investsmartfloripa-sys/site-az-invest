import { permanentRedirect } from "next/navigation";

/**
 * A página de câmbio foi absorvida pela área Moedas (Mercado → Global):
 * o bloco BRL (hero USD/BRL, cruzes e ranking emergente) vive lá, junto com
 * as moedas do mundo todo. Redirect 308 preserva links antigos e SEO.
 */
export default function CambioRedirectPage() {
  permanentRedirect("/painel-economico/mercado/global/moedas");
}
