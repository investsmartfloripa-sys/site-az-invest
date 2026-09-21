import { BOLETIM_BASE_PATH, isBoletimCategory } from "@/data/blog-categories";

/**
 * URL pública de um post. Boletins (divulgações do Publisher) vivem em
 * `/boletins/<slug>`; artigos em `/blog/<slug>`. Toda construção de link para
 * post passa por aqui — nunca monte `/blog/${slug}` na mão.
 */
export function postPath(post: { slug: string; category: string }): string {
  return isBoletimCategory(post.category)
    ? `${BOLETIM_BASE_PATH}/${post.slug}`
    : `/blog/${post.slug}`;
}
