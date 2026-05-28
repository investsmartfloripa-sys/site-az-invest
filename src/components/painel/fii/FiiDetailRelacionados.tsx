/**
 * Placeholders pros blocos "Vídeos relacionados" e "FIIs relacionados"
 * no rodapé da página individual. Decisão editorial:
 *
 *   - Vídeos relacionados: dependem de integração com canal AZ Invest no
 *     YouTube (filtro por menção do ticker no título/descrição). Definição
 *     da fonte automática fica pra Onda 2 — por enquanto, esconde.
 *
 *   - FIIs relacionados: peers do mesmo segmento do screener. Quando
 *     decidirmos critério (top N do segmento por liquidez? por DY?), liga
 *     direto no JSON do screener.
 *
 * Como o user pediu pra "vir depois", o componente exibe um aviso discreto
 * indicando que esses blocos ainda virão. Quando os critérios estiverem
 * decididos, este arquivo vira o ponto de extensão natural.
 */
export function FiiDetailRelacionados() {
  return (
    <section
      aria-label="Vídeos e FIIs relacionados"
      className="grid gap-3 md:grid-cols-2"
    >
      <Card title="Vídeos relacionados" />
      <Card title="FIIs relacionados" />
    </section>
  );
}

function Card({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#132960]/20 bg-zinc-50/40 p-6">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h4>
      <p className="mt-2 text-xs italic text-zinc-400">Em construção — Onda 2.</p>
    </div>
  );
}
