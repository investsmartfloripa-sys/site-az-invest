"use client";

type SectionLink = {
  href: string;
  label: string;
};

type Props = {
  items: SectionLink[];
};

export function FloatingSectionsMenu({ items }: Props) {
  if (!items.length) return null;

  return (
    <>
      <nav className="fixed bottom-6 right-6 z-40 hidden w-56 rounded-2xl border border-[#132960]/20 bg-white/95 p-3 shadow-xl backdrop-blur md:block">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#027DFC]">Navegacao</p>
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="block rounded-lg px-2 py-1.5 text-sm text-zinc-700 transition hover:bg-[#027DFC]/10 hover:text-[#132960]"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <nav className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-[#132960]/20 bg-white/95 p-2 shadow-xl backdrop-blur md:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-[#132960]/15 px-3 py-1 text-xs font-medium text-zinc-700"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}

