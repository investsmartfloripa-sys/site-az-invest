"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Ícone (?) que esconde fonte/metodologia atrás de um popover — o texto NÃO
 * ocupa espaço no card (decisão de design: notas metodológicas poluem; ficam a
 * um clique). Use no lugar de parágrafos de rodapé com "Fonte: ..." /
 * "Metodologia ...".
 *
 * Acessível: botão com aria-expanded, fecha com Esc e clique fora.
 */
export type MethodInfoProps = {
  /** Conteúdo do popover (texto/JSX da nota metodológica). */
  children: ReactNode;
  /** Rótulo acessível do botão. */
  label?: string;
  /** Alinhamento do painel em relação ao ícone. */
  align?: "left" | "right";
  className?: string;
};

export function MethodInfo({
  children,
  label = "Fonte e metodologia",
  align = "left",
  className = "",
}: MethodInfoProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none transition ${
          open
            ? "border-[#132960] bg-[#132960] text-white"
            : "border-[#132960]/25 bg-white text-[#132960]/60 hover:border-[#027DFC] hover:text-[#027DFC]"
        }`}
      >
        ?
      </button>
      {open ? (
        <span
          role="tooltip"
          className={`absolute top-[24px] z-50 block w-[290px] max-w-[80vw] rounded-xl border border-[#132960]/15 bg-white p-3 text-left text-[11.5px] font-normal leading-relaxed text-zinc-600 shadow-lg md:w-[340px] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {label}
          </span>
          {children}
        </span>
      ) : null}
    </span>
  );
}
