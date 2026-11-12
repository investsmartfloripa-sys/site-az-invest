import { useSyncExternalStore } from "react";

/**
 * Tela de celular (< 640 px) para os gráficos do Painel IPCA que mudam de forma no celular
 * (revisão de 12/11/2026: rótulos do eixo X se sobrepunham em 390 px). No servidor devolve
 * false, ou seja, a versão de computador; o celular troca na hidratação.
 */
const QUERY_ESTREITA = "(max-width: 639px)";

function assinar(cb: () => void) {
  const mq = window.matchMedia(QUERY_ESTREITA);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useTelaEstreita(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(QUERY_ESTREITA).matches,
    () => false,
  );
}
