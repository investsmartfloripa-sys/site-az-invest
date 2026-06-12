/**
 * Paleta compartilhada dos simuladores — identidade AZ Invest.
 *
 * Substitui os objetos `C` locais que cada page duplicava com cores
 * off-brand (#1e3a8a/#2563eb/#e2e8f0). A cor de CATEGORIA (accent) continua
 * vindo de CATEGORIAS em src/data/simuladores.ts e aparece só em doses
 * pequenas (chip do header, filete superior, série primária do gráfico);
 * CTA é SEMPRE rust.
 */

export const SIM = {
  /** Texto principal (números, títulos de card). */
  dark: "#0F172A",
  /** Navy institucional — títulos, séries secundárias. */
  navy: "#132960",
  /** Navy profundo p/ hovers/fundos escuros. */
  navyDeep: "#0D1D45",
  /** Azure da marca — links, foco de input, destaques. */
  blue: "#027DFC",
  /** Fundo azure suave (chips, cards informativos). */
  blueBg: "#D9EBFE",
  blueBgSoft: "#F0F7FF",
  /** Rust — número-resposta e CTA (cor única de conversão do site). */
  orange: "#FF5713",
  orangeDark: "#E04A0F",
  orangeBg: "#FFF7ED",
  orangeBgSoft: "#FFF3ED",
  /** Bordas no padrão navy/10 do site (em vez de slate #e2e8f0). */
  border: "rgba(19,41,96,0.12)",
  borderSoft: "rgba(19,41,96,0.07)",
  /** Texto de apoio. */
  textDim: "#64748B",
  textMore: "#94A3B8",
  /** Fundo de campo/área de gráfico. */
  fieldBg: "#F8FAFC",
} as const;

/** Cores de série p/ gráficos dos simuladores (recharts). */
export const SIM_CHART = {
  /** Série primária: herda a cor da categoria (passe CATEGORIAS[cat].cor). */
  grid: "rgba(19,41,96,0.08)",
  axis: "#94A3B8",
  positivo: "#1E8A5C",
  negativo: "#BE3B33",
} as const;
