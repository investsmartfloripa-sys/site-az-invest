"use client";

export type FloatingMenuItem = {
  id?: string;
  href: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  items: FloatingMenuItem[];
  title?: string;
  activeId?: string;
};

export function FloatingSectionsMenu({ items, title = "Areas do painel", activeId }: Props) {
  if (!items.length) return null;

  return (
    <>
      <nav className="fixed left-6 top-28 z-40 hidden w-64 rounded-2xl border border-[#132960]/15 bg-white/95 p-4 shadow-xl backdrop-blur md:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#027DFC]">{title}</p>
        <ul className="space-y-2">
          {items.map((item, idx) => {
            const key = item.id ?? `${item.href}-${idx}`;
            const isActive = Boolean(activeId && item.id && item.id === activeId);
            const base =
              "block rounded-xl px-3 py-2 text-sm transition";
            const active = "bg-[#027DFC] text-white shadow-sm";
            const normal = "text-zinc-700 hover:bg-[#027DFC]/10 hover:text-[#132960]";
            const disabled = "cursor-not-allowed bg-zinc-50 text-zinc-400";
            return (
              <li key={key}>
                {item.disabled ? (
                  <span className={`${base} ${disabled}`}>{item.label}</span>
                ) : (
                  <a href={item.href} className={`${base} ${isActive ? active : normal}`}>
                    {item.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-[#132960]/20 bg-white/95 p-2 shadow-xl backdrop-blur md:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {items.map((item, idx) => (
            item.disabled ? (
              <span
                key={item.id ?? `${item.href}-${idx}`}
                className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-400"
              >
                {item.label}
              </span>
            ) : (
              <a
                key={item.id ?? `${item.href}-${idx}`}
                href={item.href}
                className="shrink-0 rounded-full border border-[#132960]/15 px-3 py-1 text-xs font-medium text-zinc-700"
              >
                {item.label}
              </a>
            )
          ))}
        </div>
      </nav>
    </>
  );
}

