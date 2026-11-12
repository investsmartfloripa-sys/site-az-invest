import { useSyncExternalStore } from "react";

/**
 * Utilitários dos gráficos do Termômetro do ciclo (revisão de 12/11/2026):
 * eixo X anual para séries mensais "AAAA-MM" e detecção de tela estreita.
 */

const QUERY_ESTREITA = "(max-width: 639px)";

function assinar(cb: () => void) {
  const mq = window.matchMedia(QUERY_ESTREITA);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** true em telas de celular (< 640 px). No servidor devolve false (versão completa). */
export function useTelaEstreita(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(QUERY_ESTREITA).matches,
    () => false,
  );
}

/**
 * Marcas do eixo X para séries mensais longas: só os meses de janeiro, a cada N anos
 * redondos (1, 2, 5 ou 10), com ~`alvo` marcas. Antes o eixo mostrava "2003-01 2005-01…"
 * empilhados no celular. Devolve undefined quando a série tem menos de 3 anos (o
 * Recharts escolhe as marcas sozinho).
 */
export function ticksAnuais(meses: string[], alvo: number): string[] | undefined {
  if (meses.length === 0) return undefined;
  const ini = Number.parseInt(meses[0].slice(0, 4), 10);
  const fim = Number.parseInt(meses[meses.length - 1].slice(0, 4), 10);
  const anos = fim - ini;
  if (!Number.isFinite(anos) || anos < 3) return undefined;
  const bruto = anos / Math.max(1, alvo);
  const passo = [1, 2, 5, 10].find((p) => p >= bruto) ?? 10;
  // Chave "AAAA-MM" -> valor original (aceita "AAAA-MM" e "AAAA-MM-DD").
  const porMes = new Map(meses.map((m) => [m.slice(0, 7), m]));
  const ticks: string[] = [];
  for (let a = Math.ceil(ini / passo) * passo; a <= fim; a += passo) {
    const m = porMes.get(`${a}-01`);
    if (m) ticks.push(m);
  }
  return ticks.length >= 2 ? ticks : undefined;
}

/** Rótulo da marca anual: "2003". */
export function rotuloAno(mes: unknown): string {
  return String(mes ?? "").slice(0, 4);
}
