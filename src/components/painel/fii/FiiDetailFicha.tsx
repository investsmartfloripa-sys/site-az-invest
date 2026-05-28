import type { FiiDetailFicha as Ficha } from "@/lib/painel-fii";

function formatCnpj(c: string | null): string {
  if (!c) return "—";
  // CVM publica já formatado tipo "29.641.226/0001-53"; se vier sem, formata mínimo
  const digits = c.replace(/\D/g, "");
  if (digits.length !== 14) return c;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function FiiDetailFicha({ ticker, ficha }: { ticker: string; ficha: Ficha }) {
  return (
    <section
      aria-label={`${ticker} — Ficha cadastral`}
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-md border-2 border-[#132960] px-3 py-1.5 text-base font-bold tracking-wider text-[#132960]">
          {ticker}
        </span>
        <h3 className="text-base font-semibold text-[#132960]">{ficha.full_name || "—"}</h3>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-y-2 text-xs md:grid-cols-[160px,1fr]">
        <dt className="font-semibold uppercase tracking-wide text-zinc-500">CNPJ</dt>
        <dd className="text-[#132960] tabular-nums">{formatCnpj(ficha.cnpj)}</dd>

        <dt className="font-semibold uppercase tracking-wide text-zinc-500">Administrador</dt>
        <dd className="text-[#132960]">
          {ficha.admin_name || "—"}
          {ficha.admin_cnpj ? (
            <span className="ml-2 text-zinc-500">({formatCnpj(ficha.admin_cnpj)})</span>
          ) : null}
        </dd>

        <dt className="font-semibold uppercase tracking-wide text-zinc-500">Segmento</dt>
        <dd className="text-[#132960]">{ficha.segment || "—"}</dd>
      </dl>
    </section>
  );
}
