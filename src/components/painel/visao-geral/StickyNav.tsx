"use client";

import { useEffect, useState } from "react";

const ITEMS = [
  { id: "bloco1", label: "1. Ciclo" },
  { id: "bloco2", label: "2. Antecedentes" },
  { id: "bloco3", label: "3. Confiança" },
  { id: "bloco4", label: "4. Hard data" },
  { id: "bloco5", label: "5. Crédito" },
];

export function StickyNav() {
  const [activeId, setActiveId] = useState<string>("bloco1");

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const els = ITEMS.map((it) => document.getElementById(it.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visiveis = entries.filter((e) => e.isIntersecting);
        if (visiveis.length === 0) return;
        visiveis.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = (visiveis[0].target as HTMLElement).id;
        if (id) setActiveId(id);
      },
      { rootMargin: "-80px 0px -50% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActiveId(id);
  };

  return (
    <nav className="sticky top-0 z-20 -mx-2 mt-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white/95 px-2 py-2 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur sm:overflow-x-visible">
      <div className="flex snap-x snap-mandatory items-center gap-1 sm:flex-wrap sm:snap-none">
        <span className="mr-2 hidden shrink-0 text-zinc-500 sm:inline">Navegar →</span>
        {ITEMS.map((it) => {
          const active = activeId === it.id;
          return (
            <a
              key={it.id}
              href={`#${it.id}`}
              onClick={(e) => handleClick(e, it.id)}
              className={`shrink-0 snap-start rounded-md px-3 py-1.5 transition-colors ${
                active ? "bg-[#132960] text-white shadow-sm" : "text-zinc-700 hover:bg-zinc-100"
              }`}
              aria-current={active ? "true" : undefined}
            >
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
