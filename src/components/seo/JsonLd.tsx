/**
 * Componente para dados estruturados (schema.org) via JSON-LD.
 *
 * Uso: <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", ... }} />
 * Aceita um objeto (ou array de objetos) e serializa com escape de `<`
 * para evitar fechamento prematuro da tag <script> (XSS via </script>).
 */

type JsonLdData = Record<string, unknown> | Record<string, unknown>[];

export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify + escape de "<" torna o conteúdo seguro para inline.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
