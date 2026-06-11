"use client";

import { useEffect } from "react";

/**
 * Mede a altura real do <header> global e publica em --az-header-h no :root.
 * Elementos sticky abaixo do header (ex.: topbar do painel econômico) usam
 * `top: var(--az-header-h)` para grudar logo abaixo dele em vez de serem
 * cobertos ao rolar. ResizeObserver cobre breakpoints e menu mobile aberto.
 */
export function HeaderMeasure() {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const apply = () => {
      document.documentElement.style.setProperty("--az-header-h", `${header.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return null;
}
