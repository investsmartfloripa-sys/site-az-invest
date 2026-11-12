import { fmtSignedPct } from "@/lib/format-br";

/**
 * Domínio "redondo" para o eixo X das barras divergentes (DivergingReturnBars), que desenha
 * 5 marcas (tickCount fixo) a partir do mínimo do domínio. Com um domínio qualquer
 * (ex.: [−31, +7], dados + folga) as marcas saíam "−31% −21% −11% −0,6% +7%": sem o zero e
 * diferentes no celular (revisão de 12/11/2026, itens 130, 151 e 171).
 *
 * Aqui o domínio tem exatamente 4 passos redondos e começa num múltiplo do passo, então as
 * 5 marcas caem em valores redondos e o zero é uma delas. A conta não depende da largura da
 * tela. (Passo 2,5 fica de fora: o Recharts o arredonda para 3 e desalinha as marcas.)
 */
const PASSOS_BASE = [1, 2, 5, 10, 20, 25, 50];

export function dominioBarras(lo: number, hi: number, intervalos = 4): [number, number] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [-1, 1];
  let min = Math.min(lo, hi, 0);
  let max = Math.max(lo, hi, 0);
  if (min === max) {
    min = -1;
    max = 1;
  }
  const ordem = 10 ** Math.floor(Math.log10((max - min) / intervalos));
  for (const escala of [ordem / 10, ordem, ordem * 10]) {
    for (const base of PASSOS_BASE) {
      const passo = +(base * escala).toPrecision(6);
      if (passo === 2.5) continue;
      let a = Math.floor(min / passo + 1e-9) * passo;
      let b = Math.ceil(max / passo - 1e-9) * passo;
      const n = Math.round((b - a) / passo);
      if (n > intervalos) continue;
      // Completa os passos que faltam do lado com menos folga (sem inventar lado negativo
      // quando tudo é positivo, nem positivo quando tudo é negativo).
      for (let k = n; k < intervalos; k++) {
        if (min >= 0) b += passo;
        else if (max <= 0) a -= passo;
        else if (b - max <= min - a) b += passo;
        else a -= passo;
      }
      return [+a.toFixed(10), +b.toFixed(10)];
    }
  }
  return [min, max];
}

/**
 * Formato das marcas do eixo com as casas que o passo pede ("−1,5%" num passo de 0,5): o
 * padrão das barras (0 casa acima de 1%) transformava −1,5 em "−2%" e repetia marcas.
 */
export function fmtEixoBarras(dominio: [number, number], intervalos = 4): (v: number) => string {
  const passo = Math.abs(dominio[1] - dominio[0]) / intervalos;
  const dec = passo >= 1 ? 0 : passo >= 0.1 ? 1 : 2;
  return (v: number) => fmtSignedPct(v, dec);
}
