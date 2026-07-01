/**
 * Motor da simulação de carteira (client-side, sem backend) — AGNÓSTICO de
 * classe de ativo: recebe séries de retorno total ([dateISO, valor][]) e pesos.
 * Usado hoje na renda variável (Ibovespa); desenhado p/ reuso nos FIIs.
 *
 * Convenções econômicas (decisões de produto, ver memória do projeto):
 *  - Carteira com REBALANCEAMENTO MENSAL para os pesos-alvo (buy-and-hold
 *    deixaria os pesos derivarem e enganaria o usuário sobre a alocação).
 *  - Vol anualizada = desvio-padrão dos retornos DIÁRIOS × √252.
 *  - Fronteira eficiente Markowitz LONG-ONLY estimada por amostragem
 *    (Dirichlet uniforme no simplex) + carteiras notáveis exatas por busca
 *    local — suficiente e robusto p/ N ≤ 6 ativos.
 *  - Sharpe usa a taxa livre de risco anualizada informada (CDI).
 */

export type SimSeriesPoint = readonly [dateIso: string, value: number];

export type SimAsset = {
  ticker: string;
  series: ReadonlyArray<SimSeriesPoint>;
};

/** Grade diária alinhada: só datas em que TODOS os ativos têm observação. */
export type AlignedPanel = {
  dates: string[];
  /** values[i][d] = valor do ativo i na data d (mesma ordem de `assets`). */
  values: number[][];
  /** rets[i][d] = retorno simples do ativo i entre d-1 e d (length = dates.length - 1). */
  rets: number[][];
};

export function alignPanel(assets: SimAsset[], fromISO?: string): AlignedPanel | null {
  if (assets.length === 0) return null;
  const maps = assets.map((a) => {
    const m = new Map<string, number>();
    for (const [d, v] of a.series) {
      if (Number.isFinite(v) && v > 0 && (!fromISO || d >= fromISO)) m.set(d, v);
    }
    return m;
  });
  // Interseção de datas (universo B3 → calendários iguais; interseção só
  // apara IPOs recentes e feriados divergentes).
  const dates = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort();
  if (dates.length < 60) return null;
  const values = maps.map((m) => dates.map((d) => m.get(d) as number));
  const rets = values.map((vs) => {
    const r: number[] = [];
    for (let i = 1; i < vs.length; i++) r.push(vs[i] / vs[i - 1] - 1);
    return r;
  });
  return { dates, values, rets };
}

/**
 * Série de valor da carteira (base = valorInicial) com rebalanceamento ao
 * primeiro pregão de cada mês. Retorna [dateISO, valor][].
 */
export function portfolioSeries(
  panel: AlignedPanel,
  weights: number[],
  valorInicial: number,
): SimSeriesPoint[] {
  const { dates, rets } = panel;
  const n = weights.length;
  const out: SimSeriesPoint[] = [[dates[0], valorInicial]];
  let total = valorInicial;
  // Parcela em R$ por ativo (rebalanceada mensalmente).
  let alloc = weights.map((w) => w * valorInicial);
  let month = dates[0].slice(0, 7);
  for (let d = 1; d < dates.length; d++) {
    const m = dates[d].slice(0, 7);
    if (m !== month) {
      // Virada de mês: rebalanceia para os pesos-alvo com o total corrente.
      alloc = weights.map((w) => w * total);
      month = m;
    }
    total = 0;
    for (let i = 0; i < n; i++) {
      alloc[i] *= 1 + rets[i][d - 1];
      total += alloc[i];
    }
    out.push([dates[d], total]);
  }
  return out;
}

export type SimStats = {
  /** Retorno total no período (%). */
  totalPct: number;
  /** Retorno anualizado (CAGR, %). */
  cagrPct: number;
  /** Vol anualizada (%). */
  volPct: number;
  /** Máximo drawdown (%, negativo). */
  maxDrawdownPct: number;
  /** Sharpe anualizado vs taxa livre de risco. null se vol ~ 0. */
  sharpe: number | null;
};

export function seriesStats(series: ReadonlyArray<SimSeriesPoint>, rfAnnualPct: number): SimStats | null {
  if (series.length < 40) return null;
  const vals = series.map(([, v]) => v);
  const rets: number[] = [];
  for (let i = 1; i < vals.length; i++) rets.push(vals[i] / vals[i - 1] - 1);
  const totalPct = 100 * (vals[vals.length - 1] / vals[0] - 1);
  const years = rets.length / 252;
  const cagrPct = years > 0 ? 100 * (Math.pow(vals[vals.length - 1] / vals[0], 1 / years) - 1) : totalPct;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const volPct = 100 * Math.sqrt(varr) * Math.sqrt(252);
  let peak = -Infinity;
  let mdd = 0;
  for (const v of vals) {
    if (v > peak) peak = v;
    const dd = v / peak - 1;
    if (dd < mdd) mdd = dd;
  }
  const sharpe = volPct > 0.01 ? (cagrPct - rfAnnualPct) / volPct : null;
  return { totalPct, cagrPct, volPct, maxDrawdownPct: 100 * mdd, sharpe };
}

// ---------------------------------------------------------------------------
// Fronteira eficiente (Markowitz long-only, estatísticas anualizadas)
// ---------------------------------------------------------------------------

export type FrontierPoint = { volPct: number; retPct: number; weights: number[] };

export type FrontierResult = {
  /** Nuvem de carteiras amostradas (p/ scatter de contexto). */
  cloud: FrontierPoint[];
  /** Envelope superior (a fronteira em si), ordenado por vol. */
  frontier: FrontierPoint[];
  minVar: FrontierPoint;
  maxSharpe: FrontierPoint;
  /** Ativos individuais (cantos do simplex). */
  singles: FrontierPoint[];
};

function annualizedFromDaily(meanDaily: number, varDaily: number): { retPct: number; volPct: number } {
  // Retorno geométrico anualizado a partir da média diária composta.
  return {
    retPct: 100 * (Math.pow(1 + meanDaily, 252) - 1),
    volPct: 100 * Math.sqrt(varDaily) * Math.sqrt(252),
  };
}

/** RNG determinístico (mulberry32) — mesma nuvem a cada render, sem flicker. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function efficientFrontier(panel: AlignedPanel, rfAnnualPct: number, samples = 4000): FrontierResult | null {
  const n = panel.rets.length;
  if (n < 2) return null;
  const T = panel.rets[0].length;
  if (T < 60) return null;

  // Média e covariância dos retornos diários.
  const mu = panel.rets.map((r) => r.reduce((a, b) => a + b, 0) / T);
  const cov: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) s += (panel.rets[i][t] - mu[i]) * (panel.rets[j][t] - mu[j]);
      const c = s / (T - 1);
      cov[i][j] = c;
      cov[j][i] = c;
    }
  }

  const evalW = (w: number[]): FrontierPoint => {
    let m = 0;
    for (let i = 0; i < n; i++) m += w[i] * mu[i];
    let v = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) v += w[i] * w[j] * cov[i][j];
    const { retPct, volPct } = annualizedFromDaily(m, Math.max(v, 0));
    return { volPct, retPct, weights: w };
  };

  const rand = mulberry32(42);
  const cloud: FrontierPoint[] = [];
  // Cantos (100% em cada ativo) + pesos iguais entram na amostra.
  const singles: FrontierPoint[] = [];
  for (let i = 0; i < n; i++) {
    const w = new Array<number>(n).fill(0);
    w[i] = 1;
    const p = evalW(w);
    singles.push(p);
    cloud.push(p);
  }
  cloud.push(evalW(new Array<number>(n).fill(1 / n)));
  for (let s = 0; s < samples; s++) {
    // Dirichlet(1,...,1) via -ln(U): uniforme no simplex (long-only).
    const g = Array.from({ length: n }, () => -Math.log(Math.max(rand(), 1e-12)));
    const sum = g.reduce((a, b) => a + b, 0);
    cloud.push(evalW(g.map((x) => x / sum)));
  }

  let minVar = cloud[0];
  let maxSharpe = cloud[0];
  let bestSharpe = -Infinity;
  for (const p of cloud) {
    if (p.volPct < minVar.volPct) minVar = p;
    const sh = p.volPct > 0.01 ? (p.retPct - rfAnnualPct) / p.volPct : -Infinity;
    if (sh > bestSharpe) {
      bestSharpe = sh;
      maxSharpe = p;
    }
  }

  // Envelope superior: varre por vol crescente mantendo máximos de retorno.
  const sorted = [...cloud].sort((a, b) => a.volPct - b.volPct);
  const frontier: FrontierPoint[] = [];
  let bestRet = -Infinity;
  for (const p of sorted) {
    if (p.volPct < minVar.volPct) continue;
    if (p.retPct > bestRet) {
      bestRet = p.retPct;
      frontier.push(p);
    }
  }

  return { cloud, frontier, minVar, maxSharpe, singles };
}

/** Retorno anualizado (% a.a.) de uma série de índice acumulado (ex.: CDI). */
export function annualizedFromSeries(series: ReadonlyArray<SimSeriesPoint>): number | null {
  const s = series.filter(([, v]) => Number.isFinite(v) && v > 0);
  if (s.length < 60) return null;
  const years = (Date.parse(s[s.length - 1][0]) - Date.parse(s[0][0])) / (365.2425 * 86_400_000);
  if (years <= 0) return null;
  return 100 * (Math.pow(s[s.length - 1][1] / s[0][1], 1 / years) - 1);
}
