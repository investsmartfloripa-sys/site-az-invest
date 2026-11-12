/**
 * Aviso honesto de dado ausente: o pipeline ainda não publicou (ou o fetch ao
 * Blob falhou). Server-safe — use no lugar do card/da página quando o JSON
 * vier null, em vez de renderizar gráfico vazio.
 *
 * O texto é para o LEITOR (revisão de 12/11/2026: nada de "pipeline", "Blob" ou nome de
 * workflow na tela). Os caminhos e o workflow vão só em atributos data-* para diagnóstico.
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
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 ${className}`}
      data-fonte={blobPaths.join(" ")}
      data-workflow={workflow}
    >
      <p className="font-semibold">Dados indisponíveis no momento</p>
      <p className="mt-1">
        Não conseguimos carregar os dados desta seção agora. Ela volta sozinha assim que a próxima
        atualização chegar.
      </p>
    </div>
  );
}
