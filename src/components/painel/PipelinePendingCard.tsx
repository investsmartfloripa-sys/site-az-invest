/**
 * Aviso honesto de dado ausente: o pipeline ainda não publicou (ou o fetch ao
 * Blob falhou). Server-safe — use no lugar do card/da página quando o JSON
 * vier null, em vez de renderizar gráfico vazio.
 */
export function PipelinePendingCard({
  blobPaths,
  workflow,
  className = "",
}: {
  /** Caminhos esperados no Vercel Blob (ex.: "data/fx_top_movers.json"). */
  blobPaths: string[];
  /** Workflow do GitHub Actions que gera a fonte (ex.: "data-pipeline.yml"). */
  workflow: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 ${className}`}>
      <p className="font-semibold">Dados ainda não publicados</p>
      <p className="mt-1">
        O pipeline ainda não publicou{" "}
        {blobPaths.map((p, i) => (
          <span key={p}>
            {i > 0 ? (i === blobPaths.length - 1 ? " e " : ", ") : ""}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">{p}</code>
          </span>
        ))}{" "}
        no Vercel Blob — ou o fetch falhou agora. Rode o workflow{" "}
        <code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">{workflow}</code> no GitHub
        Actions ou aguarde o próximo giro; a seção monta sozinha quando o dado aparecer.
      </p>
    </div>
  );
}
