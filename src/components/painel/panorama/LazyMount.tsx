"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Altura reservada antes de montar (evita layout shift). */
  minHeight?: number;
  /** Distancia de pre-carregamento. */
  rootMargin?: string;
};

/**
 * Monta children apenas quando o bloco se aproxima do viewport.
 * Usado para os graficos Recharts abaixo da dobra: a versao anterior do
 * Panorama montava ~10 charts de uma vez e congelava o renderer.
 */
export function LazyMount({ children, minHeight = 420, rootMargin = "300px" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className="min-w-0" style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
