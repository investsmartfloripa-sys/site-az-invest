import { articleCategories } from "@/data/home";

/** Fixed blog post categories for the admin panel and filters (aligned with nav shortcuts). */
export const blogPostCategoryLabels: string[] = [
  "Geral",
  ...articleCategories
    .filter((c) => c.href !== "/blog")
    .map((c) => c.label),
];
