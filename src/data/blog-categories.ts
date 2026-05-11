import { articleCategories } from "@/data/home";

/** Opções do select no painel: rótulo com acentuação, valor igual ao banco. */
export const blogPostCategoryOptions: { label: string; value: string }[] = [
  { label: "Geral", value: "Geral" },
  ...articleCategories
    .filter((c) => c.kind === "filter")
    .map((c) => ({ label: c.label, value: c.value })),
];

/** Valores permitidos ao criar post (validação server-side). */
export const blogPostCategoryLabels: string[] = blogPostCategoryOptions.map((o) => o.value);

/** Exibição amigável para valores legados armazenados em Post.category. */
const postCategoryDisplayLabel: Record<string, string> = {
  "Educacao Financeira": "Educação Financeira",
  Politica: "Política",
};

export function formatPostCategoryLabel(stored: string): string {
  return postCategoryDisplayLabel[stored] ?? stored;
}

type CategoryVisual = {
  /** Badge sobre foto (fundo forte, texto branco). */
  solid: string;
  /** Badge em fundo claro (cartões, listas). */
  soft: string;
  /** Chip do filtro do blog — estado inativo. */
  chipInactive: string;
};

/** Cores dos pills / chips alinhadas à identidade em `globals.css` (:root). */
const postCategoryVisual: Record<string, CategoryVisual> = {
  Economia: {
    solid: "bg-[#132960] text-white",
    soft: "bg-[#132960]/10 text-[#132960]",
    chipInactive: "border-[#132960]/35 text-[#132960] hover:bg-[#132960]/5",
  },
  Investimento: {
    solid: "bg-[#027DFC] text-white",
    soft: "bg-[#ebf4ff] text-[#027DFC]",
    chipInactive: "border-[#027DFC]/40 text-[#027DFC] hover:bg-[#ebf4ff]",
  },
  "Educacao Financeira": {
    solid: "bg-[#a85b2f] text-white",
    soft: "bg-[#a85b2f]/14 text-[#132960]",
    chipInactive: "border-[#a85b2f]/45 text-[#a85b2f] hover:bg-[#a85b2f]/10",
  },
  Politica: {
    solid: "bg-[#FF5713] text-white",
    soft: "bg-[#FF5713]/12 text-[#132960]",
    chipInactive: "border-[#FF5713]/40 text-[#FF5713] hover:bg-[#FF5713]/10",
  },
  Geral: {
    solid: "bg-[#333333] text-white",
    soft: "bg-[#333333]/10 text-[#333333]",
    chipInactive: "border-[#333333]/30 text-[#333333] hover:bg-[#333333]/5",
  },
};

/** Fallback só com tons da marca (rotação estável por nome). */
const postCategoryVisualFallback: CategoryVisual[] = [
  {
    solid: "bg-[#027DFC] text-white",
    soft: "bg-[#ebf4ff] text-[#027DFC]",
    chipInactive: "border-[#027DFC]/40 text-[#027DFC] hover:bg-[#ebf4ff]",
  },
  {
    solid: "bg-[#132960] text-white",
    soft: "bg-[#132960]/10 text-[#132960]",
    chipInactive: "border-[#132960]/35 text-[#132960] hover:bg-[#132960]/5",
  },
  {
    solid: "bg-[#FF5713] text-white",
    soft: "bg-[#FF5713]/12 text-[#132960]",
    chipInactive: "border-[#FF5713]/40 text-[#FF5713] hover:bg-[#FF5713]/10",
  },
  {
    solid: "bg-[#a85b2f] text-white",
    soft: "bg-[#a85b2f]/14 text-[#132960]",
    chipInactive: "border-[#a85b2f]/45 text-[#a85b2f] hover:bg-[#a85b2f]/10",
  },
];

function categoryVisualKey(stored: string): string {
  return stored.trim();
}

function hashCategory(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 33 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function resolveCategoryVisual(stored: string): CategoryVisual {
  const key = categoryVisualKey(stored);
  return postCategoryVisual[key] ?? postCategoryVisualFallback[hashCategory(key) % postCategoryVisualFallback.length];
}

/** Pill sobre imagem (hero, capa do card). */
export function getPostCategorySolidPillClasses(stored: string): string {
  return resolveCategoryVisual(stored).solid;
}

/** Pill em superfície clara. */
export function getPostCategorySoftPillClasses(stored: string): string {
  return resolveCategoryVisual(stored).soft;
}

/** Classes do chip de categoria na página do blog (`border` + cores). Estado selecionado usa `solid`. */
export function getPostCategoryFilterChipClasses(stored: string, selected: boolean): string {
  const v = resolveCategoryVisual(stored);
  if (selected) {
    return `border-transparent ${v.solid}`;
  }
  return `border ${v.chipInactive}`;
}
