import type { CambioMacroData } from "@/lib/painel-contas-externas";

/**
 * Bloco 04 — placeholder HONESTO dos modelos de previsão de câmbio.
 *
 * Nenhum número inventado: enquanto `previsao.modelos` vier vazio do builder,
 * o card explica o que está em construção. A estrutura (JSON `previsao` +
 * este slot) está pronta p/ o dono plugar os modelos sem mexer no resto da
 * página: cada modelo publicado pelo builder vira um item aqui.
 */
export function ModelosPrevisaoCard({ data }: { data: CambioMacroData }) {
  const temModelos = Array.isArray(data.previsao?.modelos) && data.previsao.modelos.length > 0;

  return (
    <section className="rounded-2xl border border-dashed border-[#132960]/25 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-[#132960]">Modelos de previsão de câmbio</h3>
        <span className="rounded-full bg-[#027DFC]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#027DFC]">
          em construção
        </span>
      </div>

      {temModelos ? (
        <p className="mt-2 text-sm text-zinc-600">
          {data.previsao.modelos.length} modelo(s) publicado(s) pelo pipeline — renderização dedicada a caminho.
        </p>
      ) : (
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-600">
          <p>
            Este espaço vai receber os modelos proprietários de valor de referência do câmbio — nenhum número é
            exibido antes de o modelo estar publicado e documentado. O plano:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong className="text-zinc-700">Combinação de paridades</strong> — PPC (câmbio real vs âncoras de
              longo prazo, já medido no bloco 01) e paridade de juros (bloco 02), com a honestidade que o bloco 03
              impõe: paridade é bússola de longo prazo, não previsão de curto prazo.
            </li>
            <li>
              <strong className="text-zinc-700">Fundamentos</strong> — termos de troca, diferencial de
              produtividade, prêmio de risco-país e fluxos do balanço de pagamentos (integração com o painel de
              Contas Externas).
            </li>
          </ul>
          <p className="text-xs text-zinc-500">
            A estrutura de dados (campo <code className="rounded bg-zinc-100 px-1">previsao.modelos</code> no JSON
            do pipeline) já está reservada — publicar um modelo no builder acende este bloco automaticamente.
          </p>
        </div>
      )}
    </section>
  );
}
