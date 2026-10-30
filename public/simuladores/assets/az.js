/* AZ Invest · Simuladores · biblioteca comum (formatação, matemática financeira, formulário, gráficos, tabelas) */
(function (g) {
  'use strict';
  var AZ = g.AZ = g.AZ || {};
  AZ.specs = AZ.specs || [];
  AZ.dados = AZ.dados || {};
  AZ.cfg = Object.assign({
    selic: 13.75, cdi: 13.65, ipca: 4.58, igpm: 3.35, tr: 0.16, poupanca: 0.66, dolar: 5.08,
    referencia: 'outubro de 2026', cta: { titulo: '', texto: '', botao: '', url: '' }
  }, AZ.cfg || {});

  /* ───────────── formatação ───────────── */
  /* um formatador por combinação de opções: criar Intl.NumberFormat a cada número pesava nos simuladores que rodam muitas contas */
  var nfCache = {}, nf = function (o) { var k = JSON.stringify(o || {}); return nfCache[k] || (nfCache[k] = new Intl.NumberFormat('pt-BR', o)); };
  var F = AZ.f = {
    brl: function (v) { if (Math.abs(v) < 0.005) v = 0; return isFinite(v) ? nf({ style: 'currency', currency: 'BRL' }).format(v) : '-'; },
    num: function (v, c) { c = c == null ? 2 : c; if (Math.abs(v) < 0.5 * Math.pow(10, -c)) v = 0; return isFinite(v) ? nf({ minimumFractionDigits: c, maximumFractionDigits: c }).format(v) : '-'; },
    int: function (v) { if (Math.abs(v) < 0.5) v = 0; return isFinite(v) ? nf({ maximumFractionDigits: 0 }).format(v) : '-'; },
    /* v em pontos percentuais: 12.5 -> "12,50%" */
    pct: function (v, c) { return isFinite(v) ? F.num(v, c == null ? 2 : c) + '%' : '-'; },
    data: function (d) { return d instanceof Date && !isNaN(d) ? d.toLocaleDateString('pt-BR') : '-'; },
    mesAno: function (ym) { var p = String(ym).split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+p[1] - 1] + '/' + p[0]; },
    /* 40 -> "3 anos e 4 meses" */
    pl: function (n, sing, plur) { return F.int(n) + ' ' + (n === 1 ? sing : plur); },
    /* diferença entre taxas por extenso (nunca "p.p."): singular abaixo de 2 */
    pontos: function (x, c) { c = c == null ? 2 : c; return F.num(x, c) + (Math.abs(+x.toFixed(c)) < 2 ? ' ponto percentual' : ' pontos percentuais'); },
    prazo: function (meses) {
      if (!isFinite(meses)) return '-';
      meses = Math.round(meses); var a = Math.floor(meses / 12), m = meses % 12, p = [];
      if (a) p.push(a.toLocaleString('pt-BR') + (a === 1 ? ' ano' : ' anos')); if (m || !a) p.push(m + (m === 1 ? ' mês' : ' meses')); /* espaço sem quebra: "5 anos" não se parte na tabela do celular */
      return p.join(' e ');
    },
    compacto: function (v, moeda) {
      var a = Math.abs(v), s = v < 0 ? '-' : '', p = moeda ? 'R$ ' : '', t;
      var c2 = function (x) { return nf({ maximumFractionDigits: x >= 100 ? 0 : x >= 10 ? 1 : 2 }).format(x); };
      if (a >= 1e9) t = c2(a / 1e9) + ' bi';
      else if (a >= 1e6) t = c2(a / 1e6) + ' mi';
      else if (a >= 1e4) t = nf({ maximumFractionDigits: a < 1e5 ? 1 : 0 }).format(a / 1e3) + ' mil';
      else if (a >= 1e3) t = nf({ maximumFractionDigits: 2 }).format(a / 1e3) + ' mil';
      else t = F.num(a, a < 10 && a % 1 ? 2 : 0);
      return s + p + t;
    }
  };
  AZ.formatar = function (v, f) {
    if (typeof f === 'function') return f(v);
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (v instanceof Date) return F.data(v);
    switch (f) {
      case 'brl': return F.brl(v);
      case 'pct': return F.pct(v, 2);
      case 'pct1': return F.pct(v, 1);
      case 'pct4': return F.pct(v, 4);
      case 'pct6': return F.pct(v, 6);
      case 'int': return F.int(v);
      case 'num': return F.num(v, 2);
      case 'num4': return F.num(v, 4);
      case 'prazo': return F.prazo(v);
      default: return typeof v === 'number' ? F.num(v, 2) : String(v);
    }
  };
  AZ.lerNumero = function (s) {
    if (typeof s === 'number') return s;
    s = String(s == null ? '' : s).replace(/[R$\s%]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s); return isFinite(n) ? n : NaN;
  };

  /* lê uma lista de textos numéricos colados (cotações) decidindo o formato pela série inteira:
     com vírgula e ponto no mesmo número, o último separador é o decimal; só com ponto, o ponto é decimal
     salvo quando todos os números com ponto têm exatamente três dígitos depois dele e algum passa de mil. Devolve números (NaN quando não lê). */
  AZ.lerSerie = function (itens) {
    var t = itens.map(function (x) { return String(x).replace(/[R$\s%]/g, ''); }), temVirg = t.some(function (x) { return x.indexOf(',') >= 0; }), comPonto = t.filter(function (x) { return x.indexOf('.') >= 0; });
    var us = t.some(function (x) { return x.indexOf(',') >= 0 && x.indexOf('.') > x.lastIndexOf(','); });
    var pontoDecimal = us || (!temVirg && comPonto.length > 0 && !(comPonto.every(function (x) { return /^-?\d{1,3}(\.\d{3})+$/.test(x); }) && comPonto.some(function (x) { return (x.match(/\./g) || []).length > 1; })));
    return t.map(function (x) { if (!x) return NaN; var y = pontoDecimal ? x.replace(/,/g, '') : x.replace(/\./g, '').replace(',', '.'); return /^-?\d*\.?\d+$/.test(y) ? parseFloat(y) : NaN; });
  };

  /* ───────────── matemática financeira ─────────────
     Todas as taxas aqui são FRAÇÕES (0.12 = 12%). Campos do formulário devolvem pontos percentuais. */
  var MESES = { dia: 1 / 30, du: 1 / 21, semana: 7 / 30, mes: 1, bimestre: 2, trimestre: 3, quadrimestre: 4, semestre: 6, ano: 12 };
  var fin = AZ.fin = {
    /* taxa equivalente em juros compostos entre períodos: 'dia' (ano de 360), 'du' (ano de 252), 'mes', 'bimestre', 'trimestre', 'semestre', 'ano' */
    equivalente: function (i, de, para) { return Math.pow(1 + i, MESES[para] / MESES[de]) - 1; },
    aaParaAm: function (i) { return Math.pow(1 + i, 1 / 12) - 1; },
    amParaAa: function (i) { return Math.pow(1 + i, 12) - 1; },
    aaParaDu: function (i) { return Math.pow(1 + i, 1 / 252) - 1; },
    real: function (nominal, inflacao) { return (1 + nominal) / (1 + inflacao) - 1; },
    /* valor futuro de um valor presente pv com aportes pmt por n períodos. inicio=true: aporte no início do período */
    vf: function (pv, i, n, pmt, inicio) {
      pmt = pmt || 0; if (Math.abs(i) < 1e-12) return pv + pmt * n;
      var f = Math.pow(1 + i, n); return pv * f + pmt * (f - 1) / i * (inicio ? 1 + i : 1);
    },
    /* valor presente de um valor futuro fv e/ou de uma série de pagamentos pmt */
    vp: function (fv, i, n, pmt, inicio) {
      pmt = pmt || 0; if (Math.abs(i) < 1e-12) return fv + pmt * n;
      var f = Math.pow(1 + i, n); return fv / f + pmt * (1 - 1 / f) / i * (inicio ? 1 + i : 1);
    },
    /* parcela que amortiza pv (financiamento, tabela Price) */
    pmtVp: function (pv, i, n, inicio) {
      if (Math.abs(i) < 1e-12) return pv / n;
      return pv * i / (1 - Math.pow(1 + i, -n)) / (inicio ? 1 + i : 1);
    },
    /* aporte periódico para acumular fv partindo de pv */
    pmtVf: function (fv, i, n, pv, inicio) {
      pv = pv || 0; if (Math.abs(i) < 1e-12) return (fv - pv) / n;
      var f = Math.pow(1 + i, n); return (fv - pv * f) * i / (f - 1) / (inicio ? 1 + i : 1);
    },
    /* número de períodos para pv com aportes pmt chegar a fv (pode ser fracionário; Infinity se não chega) */
    nper: function (pv, fv, i, pmt, inicio) {
      pmt = (pmt || 0) * (inicio ? 1 + i : 1);
      if (fv <= pv) return 0;
      if (Math.abs(i) < 1e-12) return pmt > 0 ? (fv - pv) / pmt : Infinity;
      var a = fv * i + pmt, b = pv * i + pmt;
      if (b <= 0 || a <= 0) return Infinity;
      return Math.log(a / b) / Math.log(1 + i);
    },
    /* número de parcelas pmt para quitar pv */
    nperVp: function (pv, i, pmt) {
      if (Math.abs(i) < 1e-12) return pv / pmt;
      if (pmt <= pv * i) return Infinity;
      return -Math.log(1 - pv * i / pmt) / Math.log(1 + i);
    },
    /* resolve f(x)=0 por bisseção em [a,b] */
    raiz: function (f, a, b, tol) {
      var fa = f(a), fb = f(b), k, m, fm;
      if (!isFinite(fa) || !isFinite(fb) || fa * fb > 0) return NaN;
      for (k = 0; k < 200; k++) { m = (a + b) / 2; fm = f(m); if (Math.abs(fm) < (tol || 1e-10) || (b - a) < 1e-14) return m; if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; } }
      return (a + b) / 2;
    },
    /* taxa por período dada uma série: pv (positivo), pmt, fv, n. Ex.: taxaSerie({pv:1000,pmt:0,fv:2000,n:12}) */
    taxaSerie: function (o) {
      var pv = o.pv || 0, pmt = o.pmt || 0, fv = o.fv || 0, n = o.n, ini = !!o.inicio, modo = o.modo || 'acumular';
      var f = modo === 'financiar'
        ? function (i) { return fin.vp(fv, i, n, pmt, ini) - pv; }        /* pv financiado = VP das parcelas (+fv residual) */
        : function (i) { return fin.vf(pv, i, n, pmt, ini) - fv; };       /* pv e aportes acumulam fv */
      /* aproxima os limites de zero até a função ser finita (prazos longos estouram (1+i)^n nos extremos) */
      var a = -0.9999, b = 10, k;
      for (k = 0; k < 60 && !isFinite(f(a)); k++) a = a / 2;
      for (k = 0; k < 60 && !isFinite(f(b)); k++) b = b / 2;
      return fin.raiz(f, a, b, 1e-9);
    },
    /* alíquota regressiva do IR da renda fixa pelo prazo em dias corridos */
    irRegressivo: function (dias) { return dias <= 180 ? 0.225 : dias <= 360 ? 0.20 : dias <= 720 ? 0.175 : 0.15; },
    /* fração do rendimento cobrada de IOF em resgates antes de 30 dias */
    iof: function (dias) { var t = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0]; return dias < 1 ? 1 : dias >= 30 ? 0 : t[Math.floor(dias) - 1] / 100; },
    /* rendimento mensal da poupança (fração) dada a Selic meta ao ano (fração) e a TR mensal (fração) */
    poupancaAm: function (selicAa, trAm) { return (1 + (selicAa > 0.085 ? 0.005 : Math.pow(1 + 0.7 * selicAa, 1 / 12) - 1)) * (1 + (trAm || 0)) - 1; },
    /* tabela Price: parcelas fixas. Devolve [{n, parcela, juros, amortizacao, saldo}] */
    price: function (pv, i, n) {
      var p = fin.pmtVp(pv, i, n), s = pv, l = [], k, j, a;
      for (k = 1; k <= n; k++) { j = s * i; a = p - j; s = Math.max(0, s - a); l.push({ n: k, parcela: p, juros: j, amortizacao: a, saldo: k === n ? 0 : s }); }
      return l;
    },
    /* tabela SAC: amortização constante */
    sac: function (pv, i, n) {
      var a = pv / n, s = pv, l = [], k, j;
      for (k = 1; k <= n; k++) { j = s * i; s = Math.max(0, s - a); l.push({ n: k, parcela: a + j, juros: j, amortizacao: a, saldo: k === n ? 0 : s }); }
      return l;
    },
    /* projeção mês a mês de um investimento com aportes.
       o = {inicial, aporte, taxaMes (fração), meses, reajusteAporteAa (fração, opcional), inicio (aporte no início do mês)}
       devolve [{mes, aporte, juros, investido, jurosAcum, saldo}] começando no mês 0 */
    projetar: function (o) {
      var s = o.inicial || 0, inv = s, ja = 0, ap = o.aporte || 0, l = [{ mes: 0, aporte: 0, juros: 0, investido: inv, jurosAcum: 0, saldo: s }], m, j;
      for (m = 1; m <= o.meses; m++) {
        if (o.reajusteAporteAa && m > 1 && (m - 1) % 12 === 0) ap *= 1 + o.reajusteAporteAa;
        if (o.inicio) { s += ap; j = s * o.taxaMes; s += j; } else { j = s * o.taxaMes; s += j + ap; }
        inv += ap; ja += j; l.push({ mes: m, aporte: ap, juros: j, investido: inv, jurosAcum: ja, saldo: s });
      }
      return l;
    }
  };

  /* ───────────── datas e dias úteis ───────────── */
  var DIA = 864e5;
  function utc(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  function pascoa(a) { var c = Math.floor(a / 100), n = a - 19 * Math.floor(a / 19), k = Math.floor((c - 17) / 25), i = c - Math.floor(c / 4) - Math.floor((c - k) / 3) + 19 * n + 15; i = i - 30 * Math.floor(i / 30); i = i - Math.floor(i / 28) * (1 - Math.floor(i / 28) * Math.floor(29 / (i + 1)) * Math.floor((21 - n) / 11)); var j = a + Math.floor(a / 4) + i + 2 - c + Math.floor(c / 4); j = j - 7 * Math.floor(j / 7); var l = i - j, m = 3 + Math.floor((l + 40) / 44), d = l + 28 - 31 * Math.floor(m / 4); return new Date(a, m - 1, d); }
  var cacheFer = {};
  var datas = AZ.datas = {
    hoje: function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
    somar: function (d, dias) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias); },
    somarMeses: function (d, m) { var r = new Date(d.getFullYear(), d.getMonth() + m, 1), u = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate(); r.setDate(Math.min(d.getDate(), u)); return r; },
    corridos: function (a, b) { return Math.round((utc(b) - utc(a)) / DIA); },
    iso: function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); },
    deIso: function (s) { var p = String(s).split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : new Date(NaN); },
    /* feriados nacionais (calendário bancário/ANBIMA) do ano: lista de {data, nome} */
    feriados: function (ano) {
      if (cacheFer[ano]) return cacheFer[ano];
      var p = pascoa(ano), l = [
        [new Date(ano, 0, 1), 'Confraternização Universal'], [datas.somar(p, -48), 'Carnaval (segunda-feira)'], [datas.somar(p, -47), 'Carnaval (terça-feira)'],
        [datas.somar(p, -2), 'Paixão de Cristo'], [new Date(ano, 3, 21), 'Tiradentes'], [new Date(ano, 4, 1), 'Dia do Trabalho'],
        [datas.somar(p, 60), 'Corpus Christi'], [new Date(ano, 8, 7), 'Independência do Brasil'], [new Date(ano, 9, 12), 'Nossa Senhora Aparecida'],
        [new Date(ano, 10, 2), 'Finados'], [new Date(ano, 10, 15), 'Proclamação da República']];
      if (ano >= 2024) l.push([new Date(ano, 10, 20), 'Dia da Consciência Negra']);
      l.push([new Date(ano, 11, 25), 'Natal']);
      l = l.map(function (x) { return { data: x[0], nome: x[1] }; }).sort(function (a, b) { return a.data - b.data; });
      return (cacheFer[ano] = l);
    },
    ehFeriado: function (d) { return datas.feriados(d.getFullYear()).some(function (f) { return utc(f.data) === utc(d); }); },
    ehUtil: function (d) { var w = d.getDay(); return w !== 0 && w !== 6 && !datas.ehFeriado(d); },
    /* dias úteis de a (inclusive) até b (exclusive): convenção da renda fixa (Banco Central, ANBIMA, Tesouro), em que cada dia útil do período rende uma taxa diária */
    uteis: function (a, b) { if (b < a) return -datas.uteis(b, a); var n = 0, d = a; while (d < b) { if (datas.ehUtil(d)) n++; d = datas.somar(d, 1); } return n; },
    somarUteis: function (d, n) { var s = n < 0 ? -1 : 1, k = Math.abs(n); while (k > 0) { d = datas.somar(d, s); if (datas.ehUtil(d)) k--; } return d; }
  };

  /* ───────────── séries históricas (quando a página carrega assets/dados-*.js) ───────────── */
  function ymIdx(ym) { var p = String(ym).split('-'); return +p[0] * 12 + (+p[1] - 1); }
  function idxYm(i) { return Math.floor(i / 12) + '-' + ('0' + (i % 12 + 1)).slice(-2); }
  AZ.serie = {
    ymIdx: ymIdx, idxYm: idxYm,
    /* {ini:'AAAA-MM', fim:'AAAA-MM', v:[% ao mês]} de uma série mensal: selic, cdi, ipca, igpm, igpdi, inpc, poupanca, tr, dolar, taxaLegal */
    mensal: function (nome) { var s = (AZ.dados.mensais || {})[nome]; if (!s) throw new Error('Série indisponível: ' + nome); return { ini: s.ini, fim: idxYm(ymIdx(s.ini) + s.v.length - 1), v: s.v }; },
    /* valor da série no mês (ou NaN) */
    valor: function (nome, ym) { var s = AZ.serie.mensal(nome), i = ymIdx(ym) - ymIdx(s.ini); return i >= 0 && i < s.v.length ? s.v[i] : NaN; },
    /* acumula os percentuais mensais de ymIni a ymFim, inclusive. Devolve {fator, meses:[{ym, taxa, fator}], ini, fim} limitado ao intervalo disponível */
    acumular: function (nome, ymIni, ymFim) {
      var s = AZ.serie.mensal(nome), b = ymIdx(s.ini), a = Math.max(ymIdx(ymIni), b), z = Math.min(ymIdx(ymFim), b + s.v.length - 1), f = 1, l = [], i;
      for (i = a; i <= z; i++) { f *= 1 + s.v[i - b] / 100; l.push({ ym: idxYm(i), taxa: s.v[i - b], fator: f }); }
      return { fator: f, meses: l, ini: idxYm(a), fim: idxYm(z) };
    },
    /* poupança por dia de aniversário (requer dados: ['poupanca']). Rendimento em % do período de um mês iniciado no dia `dia` (1 a 28) do mês ym.
       regra: 'nova' (depósitos a partir de 04/05/2012) ou 'antiga'. Devolve NaN quando não há dado. */
    poupancaDia: function (regra, ym, dia) {
      var P = (AZ.dados.poupancaDia || {})[regra]; if (!P) throw new Error('Série indisponível: poupança por aniversário');
      var i = (ymIdx(ym) - ymIdx(P.ini)) * 28 + (dia - 1), x = i >= 0 && i < P.v.length ? P.v[i] : null; return x == null ? NaN : x;
    },
    /* último período disponível da poupança por aniversário: {ym, dia} */
    poupancaDiaFim: function (regra) { var P = AZ.dados.poupancaDia[regra], n = P.v.length - 1; return { ym: idxYm(ymIdx(P.ini) + Math.floor(n / 28)), dia: n % 28 + 1 }; },
    /* séries diárias (selic, cdi): acumula as taxas diárias dos dias úteis em [dIni, dFim). Devolve {fator, dias, ini, fim, pontos:[{data, taxa, fator}]} */
    diaria: function (nome, dIni, dFim) {
      var D = AZ.dados.diarios; if (!D || !D[nome]) throw new Error('Série diária indisponível: ' + nome);
      var base = datas.deIso(D.base), a = datas.corridos(base, dIni), z = datas.corridos(base, dFim), f = 1, l = [], i, o;
      for (i = 0; i < D.d.length; i++) { o = D.d[i]; if (o < a) continue; if (o >= z) break; f *= 1 + D[nome][i] / 100; l.push({ data: datas.somar(base, o), taxa: D[nome][i], fator: f }); }
      return { fator: f, dias: l.length, pontos: l, ini: l.length ? l[0].data : null, fim: l.length ? l[l.length - 1].data : null, ultimo: datas.somar(base, D.d[D.d.length - 1]) };
    }
  };

  /* ───────────── estatística e sorteio ───────────── */
  AZ.est = {
    soma: function (a) { return a.reduce(function (s, x) { return s + x; }, 0); },
    media: function (a) { return a.length ? AZ.est.soma(a) / a.length : NaN; },
    desvio: function (a) { if (a.length < 2) return NaN; var m = AZ.est.media(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); },
    correlacao: function (a, b) { var n = Math.min(a.length, b.length), ma = AZ.est.media(a.slice(0, n)), mb = AZ.est.media(b.slice(0, n)), sa = 0, sb = 0, sab = 0, i; for (i = 0; i < n; i++) { sa += (a[i] - ma) * (a[i] - ma); sb += (b[i] - mb) * (b[i] - mb); sab += (a[i] - ma) * (b[i] - mb); } return sab / Math.sqrt(sa * sb); },
    /* gerador pseudoaleatório com semente (resultado estável até o usuário pedir novo sorteio) */
    rng: function (semente) { var s = (semente * 2654435761 + 1013904223) >>> 0; return function () { s += 0x6D2B79F5; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    normal: function (rnd) { var u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  };

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  AZ.esc = esc;

  AZ.registrar = function (spec) {
    AZ.specs.push(spec);
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { AZ.montar(spec); });
      else AZ.montar(spec);
    }
  };
  if (typeof document === 'undefined') return;

  /* ═════════════ interface ═════════════ */
  function h(tag, at, filhos) {
    var e = document.createElement(tag), k;
    for (k in (at || {})) { if (at[k] == null || at[k] === false) continue; if (k === 'html') e.innerHTML = at[k]; else if (k === 'text') e.textContent = at[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), at[k]); else e.setAttribute(k, at[k] === true ? '' : at[k]); }
    (filhos || []).forEach(function (f) { if (f != null) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return e;
  }
  var NUMERICOS = { moeda: 1, pct: 1, num: 1, int: 1 };
  function exibir(c, val) {
    if (!isFinite(val)) return '';
    if (c.tipo === 'moeda') return F.num(val, 2);
    if (c.tipo === 'int') return c.semMilhar ? String(Math.round(val)) : F.int(val);
    return nf({ maximumFractionDigits: c.casas == null ? 6 : c.casas, useGrouping: c.tipo !== 'pct' }).format(val);
  }
  function padraoData(p) {
    if (p instanceof Date) return p; var t = datas.hoje(), m;
    if (!p || p === 'hoje') return t;
    if ((m = /^hoje([+-]\d+)$/.exec(p))) return datas.somar(t, +m[1]);
    return datas.deIso(p);
  }
  function padraoDe(c) {
    var p = typeof c.padrao === 'function' ? c.padrao(AZ) : c.padrao;
    if (c.tipo === 'data') return padraoData(p);
    if (c.tipo === 'lista') return (p || []).map(function (l) { return Object.assign({}, l); });
    if (c.tipo === 'check') return !!p;
    if (p == null && (c.tipo === 'select' || c.tipo === 'segmento')) return c.opcoes[0].v;
    return p == null ? (NUMERICOS[c.tipo] ? NaN : '') : p;
  }

  AZ.montar = function (spec) {
    var raiz = document.getElementById('az-app'); if (!raiz) return;
    raiz.innerHTML = '';
    var v = {}, erros = {}, campos = spec.campos || [], refs = {}, timer;
    campos.forEach(function (c) { if (c.tipo === 'titulo') return; v[c.id] = padraoDe(c); if (c.unidades) v[c.id + 'Un'] = c.unidadePadrao || c.unidades[0].v; });
    v._n = 1;
    /* endereço antigo absorvido (redirecionado com ?veio=<slug>): abre no modo equivalente ao da página antiga; um link com # ainda prevalece */
    try {
      var veio = new URLSearchParams(location.search).get('veio'), at = veio && spec.atalhos && spec.atalhos[veio];
      if (at) Object.keys(at).forEach(function (k) { var c = campos.filter(function (x) { return x.id === k; })[0]; v[k] = c && c.tipo === 'data' ? padraoData(at[k]) : at[k]; });
      if (veio) { var q = new URLSearchParams(location.search); q.delete('veio'); var qs = q.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); }
    } catch (e) { }
    lerHash();

    var form = h('form', { class: 'az-cartao az-form', novalidate: true, onsubmit: function (e) { e.preventDefault(); } });
    form.appendChild(h('h2', { text: spec.tituloFormulario || 'Dados da simulação' }));
    var grade = h('div', { class: 'az-campos' }); form.appendChild(grade);
    /* campo com noGrafico (índice do gráfico) não entra no formulário: vira botões no cabeçalho desse gráfico (botoesNoGrafico) */
    campos.forEach(function (c) { var el = campo(c); refs[c.id || c.rotulo] = { c: c, el: el }; if (c.noGrafico == null) grade.appendChild(el); });
    var acoes = h('div', { class: 'az-acoes' });
    (spec.acoes || []).forEach(function (a) { acoes.appendChild(h('button', { type: 'button', class: 'az-botao az-peq', text: a.rotulo, onclick: function () { v._n++; v._acao = a.id; calcular(); } })); });
    var bLink = h('button', { type: 'button', class: 'az-botao az-sec az-peq', text: 'Copiar link da simulação', onclick: function () { gravarHash(); copiar(location.href, bLink, 'Copiar link da simulação'); } });
    acoes.appendChild(bLink);
    acoes.appendChild(h('button', { type: 'button', class: 'az-botao az-sec az-peq', text: 'Restaurar valores', onclick: function () { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } AZ.montar(spec); } }));
    form.appendChild(acoes);
    var nf = notaFonte(raiz.getAttribute('data-ref')); if (nf) form.appendChild(nf);
    raiz.classList.toggle('az-largo', !campos.length || !!spec.largo);
    var res = h('div', { class: 'az-res', 'aria-live': 'polite' });
    raiz.appendChild(form); raiz.appendChild(res);
    visibilidade(); calcular(true);

    function rotulo(c, para) { return h('label', { for: para, text: c.rotulo }); }
    function campo(c) {
      if (c.tipo === 'titulo') return h('div', { class: 'az-subt', text: c.rotulo });
      var id = 'az-c-' + c.id, box = h('div', { class: 'az-campo' + (c.largura === 'meia' && !c.unidades ? ' az-meia' : '') }), ent, inp;
      if (c.tipo === 'check') {
        inp = h('input', { type: 'checkbox', id: id, checked: v[c.id] ? true : null, onchange: function () { v[c.id] = inp.checked; mudou(); } });
        box.appendChild(h('label', { class: 'az-check', for: id }, [inp, h('span', { text: c.rotulo })]));
      } else if (c.tipo === 'segmento') {
        box.appendChild(h('div', { class: 'az-rot', id: id + '-r', text: c.rotulo }));
        ent = h('div', { class: 'az-seg' + (c.opcoes.reduce(function (a, o) { return a + String(o.t).length; }, 0) > 30 || c.opcoes.length > 3 ? ' az-seg-col' : ''), role: 'radiogroup', 'aria-labelledby': id + '-r' });
        c.opcoes.forEach(function (o) { var r = h('input', { type: 'radio', name: id, value: o.v, checked: String(v[c.id]) === String(o.v) ? true : null, onchange: function () { v[c.id] = o.v; mudou(); } }); ent.appendChild(h('label', {}, [r, o.t])); });
        box.appendChild(ent);
      } else if (c.tipo === 'lista') {
        box.appendChild(h('div', { class: 'az-rot', text: c.rotulo }));
        var lista = h('div', { class: 'az-lista' }); box.appendChild(lista);
        var add = h('button', { type: 'button', class: 'az-botao az-sec az-peq', text: c.rotuloAdicionar || 'Adicionar linha', style: 'margin-top:8px', onclick: function () { var n = {}; c.colunas.forEach(function (k) { n[k.id] = k.padrao == null ? (NUMERICOS[k.tipo] ? NaN : k.tipo === 'select' ? k.opcoes[0].v : '') : k.padrao; }); v[c.id].push(n); desenhar(); mudou(); } });
        box.appendChild(add);
        var desenhar = function () {
          lista.innerHTML = '';
          v[c.id].forEach(function (lin, i) {
            var cols = c.colunas.map(function (k) { return k.peso || (k.tipo === 'texto' ? 1.6 : 1); }).join('fr ') + 'fr auto';
            var row = h('div', { class: 'az-lista-linha', style: 'grid-template-columns:' + c.colunas.map(function (k) { return 'minmax(0,' + (k.peso || (k.tipo === 'texto' ? 1.6 : 1)) + 'fr)'; }).join(' ') + ' auto' });
            c.colunas.forEach(function (k) {
              var cid = id + '-' + i + '-' + k.id, e2 = h('div', { class: 'az-ent' }), i2;
              if (k.tipo === 'select') { i2 = h('select', { id: cid, onchange: function () { lin[k.id] = i2.value; mudou(); } }); k.opcoes.forEach(function (o) { i2.appendChild(h('option', { value: o.v, text: o.t, selected: String(lin[k.id]) === String(o.v) ? true : null })); }); }
              else if (k.tipo === 'texto') i2 = h('input', { id: cid, type: 'text', value: lin[k.id] || '', oninput: function () { lin[k.id] = i2.value; mudou(); } });
              else i2 = h('input', { id: cid, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: exibir(k, lin[k.id]), oninput: function () { lin[k.id] = AZ.lerNumero(i2.value); if (k.tipo === 'int' && isFinite(lin[k.id])) lin[k.id] = Math.round(lin[k.id]); mudou(); }, onblur: function () { if (isFinite(lin[k.id])) i2.value = exibir(k, lin[k.id]); } });
              e2.appendChild(i2);
              row.appendChild(h('div', {}, [h('label', { class: 'az-mini', for: cid, text: k.rotulo }), e2]));
            });
            row.appendChild(h('button', { type: 'button', class: 'az-x', 'aria-label': 'Remover linha', text: '×', disabled: v[c.id].length <= (c.minLinhas || 1) ? true : null, onclick: function () { v[c.id].splice(i, 1); desenhar(); mudou(); } }));
            lista.appendChild(row); void cols;
          });
          add.style.display = v[c.id].length >= (c.maxLinhas || 12) ? 'none' : '';
        };
        desenhar();
      } else {
        box.appendChild(rotulo(c, id));
        ent = h('div', { class: 'az-ent' });
        var pre = c.prefixo || (c.tipo === 'moeda' ? 'R$' : ''), suf = c.sufixo || (c.tipo === 'pct' && !c.unidades ? '%' : '');
        if (pre) ent.appendChild(h('span', { class: 'az-afx', text: pre }));
        if (c.tipo === 'select') {
          inp = h('select', { id: id, onchange: function () { v[c.id] = inp.value; mudou(); } });
          c.opcoes.forEach(function (o) { inp.appendChild(h('option', { value: o.v, text: o.t, selected: String(v[c.id]) === String(o.v) ? true : null })); });
        } else if (c.tipo === 'data') {
          inp = h('input', { id: id, type: 'date', value: isNaN(v[c.id]) ? '' : datas.iso(v[c.id]), oninput: function () { v[c.id] = datas.deIso(inp.value); mudou(); } });
        } else if (c.tipo === 'mes') {
          inp = h('input', { id: id, type: 'month', value: v[c.id] || '', min: c.min, max: c.max, oninput: function () { v[c.id] = inp.value; mudou(); } });
        } else if (c.tipo === 'texto') {
          inp = h(c.linhas ? 'textarea' : 'input', { id: id, placeholder: c.exemplo || null, oninput: function () { v[c.id] = inp.value; mudou(); } });
          if (c.linhas) { inp.rows = c.linhas; } else inp.type = 'text'; inp.value = v[c.id] || '';
        } else {
          inp = h('input', { id: id, type: 'text', inputmode: c.tipo === 'int' && !(c.min < 0) ? 'numeric' : 'decimal', autocomplete: 'off', value: exibir(c, v[c.id]),
            oninput: function () { v[c.id] = AZ.lerNumero(inp.value); if (c.tipo === 'int' && isFinite(v[c.id])) v[c.id] = Math.round(v[c.id]); mudou(); },
            onblur: function () { if (isFinite(v[c.id])) { if (c.tipo === 'int') v[c.id] = Math.round(v[c.id]); inp.value = exibir(c, v[c.id]); } } });
        }
        ent.appendChild(inp);
        if (c.unidades) {
          var un = h('select', { class: 'az-un', 'aria-label': 'Unidade de ' + c.rotulo, onchange: function () { v[c.id + 'Un'] = un.value; mudou(); } });
          c.unidades.forEach(function (o) { un.appendChild(h('option', { value: o.v, text: (c.tipo === 'pct' ? '% ' : '') + o.t, selected: v[c.id + 'Un'] === o.v ? true : null })); });
          ent.appendChild(un);
        } else if (suf) ent.appendChild(h('span', { class: 'az-afx', text: suf }));
        box.appendChild(ent);
      }
      /* a ajuda fica recolhida atrás de um "?" ao lado do rótulo: o formulário mostra só o essencial */
      if (c.ajuda) {
        var aj = h('div', { class: 'az-ajuda', html: c.ajuda, hidden: true }), lab = box.firstChild;
        var bi = h('button', { type: 'button', class: 'az-info', 'aria-label': 'Explicação: ' + c.rotulo, 'aria-expanded': 'false', text: '?', onclick: function (ev) { ev.preventDefault(); ev.stopPropagation(); aj.hidden = !aj.hidden; bi.setAttribute('aria-expanded', aj.hidden ? 'false' : 'true'); altura(); } });
        if (lab && c.tipo !== 'check') { var cab = h('div', { class: 'az-cab' }); box.insertBefore(cab, lab); cab.appendChild(lab); cab.appendChild(bi); } else box.appendChild(bi);
        box.appendChild(aj);
      }
      return box;
    }
    function visibilidade() { campos.forEach(function (c) { if (!c.mostrarSe) return; var r = refs[c.id || c.rotulo]; var on = false; try { on = !!c.mostrarSe(v); } catch (e) { } r.el.style.display = on ? '' : 'none'; r.oculto = !on; }); }
    function mudou() { visibilidade(); clearTimeout(timer); timer = setTimeout(function () { calcular(); gravarHash(); }, 90); }
    function validar() {
      var msg = null;
      campos.forEach(function (c) {
        if (c.tipo === 'titulo') return; var r = refs[c.id], ent = r.el.querySelector('.az-ent'), x = v[c.id], ruim = null;
        if (!r.oculto) {
          if (NUMERICOS[c.tipo]) {
            if (!isFinite(x)) { if (!c.opcional) ruim = 'Preencha o campo "' + c.rotulo + '".'; }
            else if (c.min != null && x < c.min) ruim = '"' + c.rotulo + '" deve ser no mínimo ' + exibir(c, c.min) + '.';
            else if (c.max != null && x > c.max) ruim = '"' + c.rotulo + '" deve ser no máximo ' + exibir(c, c.max) + '.';
          } else if (c.tipo === 'data' && isNaN(x) && !c.opcional) ruim = 'Informe uma data válida em "' + c.rotulo + '".';
          else if (c.tipo === 'mes' && !/^\d{4}-\d{2}$/.test(x || '') && !c.opcional) ruim = 'Informe o mês em "' + c.rotulo + '".';
        }
        if (ent) ent.classList.toggle('az-erro', !!ruim);
        if (ruim && !msg) msg = ruim;
      });
      return msg;
    }
    function calcular() {
      var msg = validar(), r;
      /* mantém a altura durante o redesenho para a página não saltar enquanto o usuário digita */
      res.style.minHeight = res.offsetHeight + 'px'; setTimeout(function () { res.style.minHeight = ''; }, 0);
      res.innerHTML = '';
      if (msg) { res.appendChild(h('div', { class: 'az-cartao az-vazio', text: msg })); botoesNoGrafico(); altura(); return; }
      var vv = Object.assign({}, v); campos.forEach(function (c) { if (NUMERICOS[c.tipo] && !isFinite(vv[c.id])) vv[c.id] = 0; });
      try { r = spec.calcular(vv, AZ) || {}; } catch (e) { if (g.console) console.error(e); r = { erro: 'Não foi possível calcular com os valores informados. Revise os campos e tente novamente.' }; }
      if (r.erro) { res.appendChild(h('div', { class: 'az-alerta az-atencao', text: r.erro })); botoesNoGrafico(); altura(); return; }
      AZ.desenhar(res, r, spec); botoesNoGrafico(); formulas(res); ajustarKpis(res); ajustarTabelas(res); AZ.encaixarFluxo();
      altura();
    }
    /* botões no gráfico: segmento ou select vira um grupo de botões (um ativo); check vira um botão liga/desliga.
       Ficam no cabeçalho do gráfico de índice c.noGrafico (ou no topo do resultado, se ele não existir) e mudam o mesmo valor do campo. */
    function botoesNoGrafico() {
      var cartoes = res.querySelectorAll('.az-graf');
      campos.forEach(function (c) {
        if (c.noGrafico == null || refs[c.id].oculto) return;
        var alvo = cartoes[c.noGrafico] ? cartoes[c.noGrafico].parentNode : (res.querySelector('.az-bloco.az-texto') || res), barra = null;
        [].forEach.call(alvo.children, function (x) { if (x.classList.contains('az-gbar')) barra = x; });
        if (!barra) { barra = h('div', { class: 'az-gbar' }); var t = alvo.querySelector('h2'); alvo.insertBefore(barra, t && t.parentNode === alvo ? t.nextSibling : alvo.firstChild); }
        var grupo = h('div', { class: 'az-gbtn', role: 'group', 'aria-label': c.rotulo });
        var trocar = function (x) { v[c.id] = x; visibilidade(); calcular(); gravarHash(); };
        if (c.tipo === 'check') {
          grupo.appendChild(h('button', { type: 'button', class: 'az-gb az-chk' + (v[c.id] ? ' az-on' : ''), 'aria-pressed': v[c.id] ? 'true' : 'false', text: c.rotulo, onclick: function () { trocar(!v[c.id]); } }));
        } else {
          if (c.rotuloNoGrafico !== false) grupo.appendChild(h('span', { class: 'az-gbtn-rot', text: c.rotulo }));
          var seg = h('span', { class: 'az-gseg' }); grupo.appendChild(seg);
          c.opcoes.forEach(function (o) { var on = String(v[c.id]) === String(o.v); seg.appendChild(h('button', { type: 'button', class: 'az-gb' + (on ? ' az-on' : ''), 'aria-pressed': on ? 'true' : 'false', text: o.t, onclick: function () { if (!on) trocar(o.v); } })); });
        }
        barra.appendChild(grupo);
      });
    }
    function gravarHash() {
      try {
        var p = []; campos.forEach(function (c) { if (c.tipo === 'titulo') return; var x = v[c.id], s; if (c.tipo === 'data') s = isNaN(x) ? '' : datas.iso(x); else if (c.tipo === 'lista') s = JSON.stringify(x); else if (c.tipo === 'check') s = x ? '1' : '0'; else s = NUMERICOS[c.tipo] ? (isFinite(x) ? String(x) : '') : String(x == null ? '' : x); p.push(encodeURIComponent(c.id) + '=' + encodeURIComponent(s)); if (c.unidades) p.push(encodeURIComponent(c.id + 'Un') + '=' + encodeURIComponent(v[c.id + 'Un'])); });
        history.replaceState(null, '', '#' + p.join('&'));
      } catch (e) { }
    }
    function lerHash() {
      try {
        var hs = location.hash.replace(/^#/, ''); if (!hs) return; var m = {};
        hs.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) m[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
        campos.forEach(function (c) {
          if (c.tipo === 'titulo' || !(c.id in m)) { if (c.unidades && (c.id + 'Un') in m) v[c.id + 'Un'] = m[c.id + 'Un']; return; } var s = m[c.id];
          if (c.tipo === 'data') { var d = datas.deIso(s); if (!isNaN(d)) v[c.id] = d; }
          else if (c.tipo === 'lista') { var a = JSON.parse(s); if (Array.isArray(a) && a.length) v[c.id] = a.map(function (l) { var o = {}; c.colunas.forEach(function (k) { o[k.id] = l[k.id] == null && NUMERICOS[k.tipo] ? NaN : l[k.id]; }); return o; }); }
          else if (c.tipo === 'check') v[c.id] = s === '1';
          else if (NUMERICOS[c.tipo]) { v[c.id] = s === '' ? NaN : parseFloat(s); if (c.tipo === 'int' && isFinite(v[c.id])) v[c.id] = Math.round(v[c.id]); }
          else if (c.tipo === 'select' || c.tipo === 'segmento') { if (c.opcoes.some(function (o) { return String(o.v) === s; })) v[c.id] = s; }
          else v[c.id] = s;
          if (c.unidades && m[c.id + 'Un'] && c.unidades.some(function (o) { return o.v === m[c.id + 'Un']; })) v[c.id + 'Un'] = m[c.id + 'Un'];
        });
      } catch (e) { }
    }
  };

  function copiar(txt, botao, original) {
    var ok = function () { botao.textContent = 'Link copiado'; setTimeout(function () { botao.textContent = original; }, 1800); };
    try { navigator.clipboard.writeText(txt).then(ok, function () { prompt('Copie o link:', txt); }); } catch (e) { try { prompt('Copie o link:', txt); } catch (e2) { } }
  }
  function altura() { try { if (g.parent !== g) g.parent.postMessage({ az: 'altura', h: document.documentElement.scrollHeight }, '*'); } catch (e) { } }

  /* desenha o resultado devolvido por spec.calcular */
  AZ.desenhar = function (res, r, spec) {
    if (r.alerta) res.appendChild(h('div', { class: 'az-alerta' + (r.alertaTom === 'atencao' ? ' az-atencao' : ''), role: 'note', html: r.alerta }));
    if (r.destaques && r.destaques.length) {
      var k = h('div', { class: 'az-kpis az-n' + r.destaques.length });
      r.destaques.forEach(function (d) {
        k.appendChild(h('div', { class: 'az-kpi' + (d.tom ? ' az-' + d.tom : '') }, [
          h('div', { class: 'az-k-rot', text: d.rotulo }), h('div', { class: 'az-k-val', text: AZ.formatar(d.valor, d.formato) }),
          d.nota ? h('div', { class: 'az-k-nota', html: d.nota }) : null]));
      });
      res.appendChild(k);
    }
    /* a leitura do resultado fica embaixo do primeiro gráfico (um parágrafo por coisa); sem gráfico, logo após os destaques */
    var grs = r.graficos || [];
    if (r.resumo && !grs.length) res.appendChild(h('div', { class: 'az-cartao az-bloco az-texto', html: r.resumo }));
    grs.forEach(function (gr, i) {
      var b = h('div', { class: 'az-cartao az-bloco' }); if (gr.titulo) b.appendChild(h('h2', { text: gr.titulo }));
      var c = h('div', { class: 'az-graf' }); b.appendChild(c); res.appendChild(b);
      AZ.grafico(c, gr);
      var leitura = gr.leitura || (i === 0 ? r.resumo : null);
      if (leitura) b.appendChild(h('div', { class: 'az-leitura', html: leitura }));
    });
    /* só a primeira tabela fica aberta; as demais viram uma linha "Ver tabela" (o spec decide com recolhida: true/false) */
    (r.tabelas || []).forEach(function (t, i) { res.appendChild(tabela(t, (spec && spec.slug || 'simulacao') + (i ? '-' + (i + 1) : ''), t.recolhida != null ? t.recolhida : i > 0)); });
    (r.blocos || []).forEach(function (b) { var e = h('div', { class: 'az-cartao az-bloco az-texto' }); if (b.titulo) e.appendChild(h('h2', { text: b.titulo })); e.appendChild(h('div', { html: b.html })); res.appendChild(e); });
    if (r.textos && r.textos.length) res.appendChild(h('div', { class: 'az-cartao az-bloco az-texto', html: r.textos.join('') }));
  };

  /* valor do destaque em uma linha: reduz a fonte até caber; se ainda assim não couber, deixa quebrar */
  function ajustarKpis(raiz) {
    /* todos os valores de um mesmo grupo de destaques ficam com o mesmo tamanho: o maior em que o mais longo ainda cabe */
    [].forEach.call((raiz || document).querySelectorAll('.az-kpis'), function (grupo) {
      var vals = [].slice.call(grupo.querySelectorAll('.az-k-val')), min = (g.innerWidth || 1280) < 601 ? 15 : 18, t;
      vals.forEach(function (e) { e.classList.remove('az-quebra'); e.style.fontSize = ''; });
      t = vals.length ? parseFloat(g.getComputedStyle(vals[0]).fontSize) || 30 : 30;
      function cabe() { return vals.every(function (e) { return e.scrollWidth <= e.clientWidth + 1; }); }
      while (!cabe() && t > min) { t -= 1; vals.forEach(function (e) { e.style.fontSize = t + 'px'; }); }
      if (!cabe()) vals.forEach(function (e) { if (e.scrollWidth > e.clientWidth + 1) e.classList.add('az-quebra'); });
    });
  }
  /* tabela larga no computador: reduz fonte e respiro até caber na coluna; no celular, rola de lado */
  function ajustarTabelas(raiz) {
    [].forEach.call((raiz || document).querySelectorAll('.az-rolo'), function (r) {
      var tb = r.querySelector('table'); if (!tb) return; tb.style.fontSize = ''; tb.classList.remove('az-aperta');
      var t = parseFloat(g.getComputedStyle(tb).fontSize) || 18, piso = (g.innerWidth || 1280) < 861 ? 13 : 14;
      if (r.scrollWidth > r.clientWidth + 1) tb.classList.add('az-aperta');
      while (r.scrollWidth > r.clientWidth + 1 && t > piso) { t -= 0.5; tb.style.fontSize = t + 'px'; }
    });
  }
  /* Leiaute do computador. Duas opções, medidas a cada cálculo; vale a que deixa menos área vazia:
     A) corrido: dados flutuam à esquerda, o resultado corre ao lado e depois ocupa a largura toda; um bloco que
        atravessaria o fim dos dados desce para baixo deles (e o gráfico anterior se estica para fechar o vão);
     B) lateral: dados e "Como funciona" formam a coluna da esquerda e o resultado fica inteiro à direita. */
  function esticar(wrap, extra) { if ((wrap._extra || 0) === extra) return; wrap._extra = extra; if (wrap._redesenhar) wrap._redesenhar(); }
  function encaixarFluxo() {
    var app = document.getElementById('az-app'); if (!app) return;
    var larg = app.parentNode, f = null, r = null, i, k = app.children;
    for (i = 0; i < k.length; i++) { if (k[i].classList.contains('az-form')) f = k[i]; else if (k[i].classList.contains('az-res')) r = k[i]; }
    if (!f || !r) return;
    var sobre = app.nextElementSibling; if (!(sobre && sobre.classList.contains('az-sobre'))) sobre = null;
    var ks = [].slice.call(r.children); if (sobre) ks.push(sobre);
    var grafs = [].slice.call(r.querySelectorAll('.az-graf-in'));
    function limpar() { ks.forEach(function (e) { e.classList.remove('az-abaixo'); }); grafs.forEach(function (w) { esticar(w, 0); }); }
    function bb(e) { return e.getBoundingClientRect(); }
    limpar(); larg.classList.remove('az-lado');
    if ((g.innerWidth || 1280) < 960 || app.classList.contains('az-largo')) return;
    function corrido() {
      limpar();
      var F = bb(f), fb = F.bottom + 16, wEsq = F.width, wDir = bb(app).width - wEsq, j, b, sobra, prev, graf;
      for (j = 0; j < ks.length; j++) {
        b = bb(ks[j]); if (b.left < F.right - 5) break;
        sobra = fb - b.top; if (sobra <= 0) break;
        if (b.bottom <= fb + 1) continue;
        prev = j > 0 ? ks[j - 1] : null; graf = prev && prev.querySelector('.az-graf-in');
        if (graf || (b.height - sobra) * wEsq > sobra * wDir) { ks[j].classList.add('az-abaixo'); if (graf) esticar(graf, Math.round(sobra)); }
        break;
      }
      F = bb(f); fb = F.bottom + 16; var estreitoFim = 0;
      ks.forEach(function (e) { var c = bb(e); if (c.left >= F.right - 5) estreitoFim = Math.max(estreitoFim, c.bottom); });
      return Math.max(0, estreitoFim - fb) * wEsq + Math.max(0, fb - estreitoFim) * wDir;
    }
    var vA = corrido();
    if (sobre) {
      limpar(); larg.classList.add('az-lado');
      var fh = f.offsetHeight + 16 + sobre.offsetHeight, rh = r.offsetHeight, wEsq2 = f.offsetWidth, wDir2 = larg.clientWidth - wEsq2 - 22;
      var vB = fh > rh ? (fh - rh) * wDir2 : (rh - fh) * wEsq2;
      if (vA <= vB) { larg.classList.remove('az-lado'); corrido(); }
    }
  }
  AZ.ajustarTabelas = ajustarTabelas;
  AZ.ajustarKpis = ajustarKpis;
  AZ.encaixarFluxo = encaixarFluxo;
  if (g.addEventListener) { var tk; g.addEventListener('resize', function () { clearTimeout(tk); tk = setTimeout(function () { ajustarKpis(); ajustarTabelas(); encaixarFluxo(); }, 120); }); if (g.document && document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ajustarKpis(); ajustarTabelas(); encaixarFluxo(); }); }
  /* linha "de onde vêm as taxas sugeridas", montada a partir das chaves de AZ.cfg que o simulador usa */
  function notaFonte(lista) {
    if (!lista) return null; var c = AZ.cfg || {}, k = lista.split(','), p = [], f = [];
    function tem(x) { return k.indexOf(x) >= 0 && isFinite(c[x]); }
    function fonte(x) { if (f.indexOf(x) < 0) f.push(x); }
    if (tem('selic')) { p.push('Selic de ' + F.pct(c.selic) + ' ao ano'); fonte('Banco Central'); }
    if (tem('selicEfetiva')) { p.push('Selic efetiva de ' + F.pct(c.selicEfetiva) + ' ao ano'); fonte('Banco Central'); }
    if (tem('cdi')) { p.push('CDI de ' + F.pct(c.cdi) + ' ao ano'); fonte('Banco Central'); }
    if (tem('ipca')) { p.push('IPCA de ' + F.pct(c.ipca) + ' em 12 meses'); fonte('IBGE'); }
    if (tem('igpm')) { p.push('IGP-M de ' + F.pct(c.igpm) + ' em 12 meses'); fonte('FGV'); }
    if (tem('poupanca')) { p.push('poupança de ' + F.pct(c.poupanca) + ' ao mês'); fonte('Banco Central'); }
    if (tem('tr')) { p.push('TR de ' + F.pct(c.tr) + ' ao mês'); fonte('Banco Central'); }
    if (!p.length) return null;
    return h('p', { class: 'az-fonte', text: 'Taxas sugeridas' + (c.referencia ? ' de ' + c.referencia : '') + ' (' + f.join(' e ') + ').' });
  }

  function tabela(t, nome, dobrar) {
    var b = h(dobrar ? 'details' : 'div', { class: 'az-cartao az-bloco' + (dobrar ? ' az-dobra' : '') }), lim = t.mostrar || (t.linhas.length > 15 ? 12 : t.linhas.length), aberto = t.linhas.length <= lim;
    if (dobrar) { b.appendChild(h('summary', {}, [h('h2', { text: t.titulo || 'Tabela' })])); b.addEventListener('toggle', function () { if (b.open) ajustarTabelas(b); altura(); }); }
    else b.appendChild(h('div', { class: 'az-tab-cab' }, [h('h2', { text: t.titulo || 'Tabela' })]));
    var rolo = h('div', { class: 'az-rolo' + (t.linhas.length > 16 ? ' az-longa' : ''), tabindex: '0' }), tb = h('table', { class: 'az-tab' }); rolo.appendChild(tb); b.appendChild(rolo);
    /* a nota é o parágrafo de leitura da tabela: logo abaixo dela, antes dos botões */
    if (t.nota) b.appendChild(h('div', { class: 'az-leitura', html: t.nota }));
    var esq = t.colunas.map(function (c, i) { return c.alinhar ? c.alinhar === 'esq' : (c.f === 'texto' || (i === 0 && !c.f)); });
    /* coluna só com valores em reais: o "R$" vai para o cabeçalho, uma vez, e sai das células */
    var emReais = t.colunas.map(function (c, i) { var n = 0, ok = t.linhas.every(function (l) { var tx = AZ.formatar(l[i], c.f); if (tx === '' || /^[-–—]$/.test(tx)) return true; n++; return /^[-−]?R\$\s?[\d.,]+$/.test(tx); }); return ok && n > 0; });
    function pintar() {
      tb.innerHTML = '';
      tb.appendChild(h('thead', {}, [h('tr', {}, t.colunas.map(function (c, i) { return h('th', { class: esq[i] ? 'az-e' : null, scope: 'col', text: emReais[i] && !/R\$/.test(c.t) ? c.t + ' (R$)' : c.t }); }))]));
      var corpo = h('tbody');
      (aberto ? t.linhas : t.linhas.slice(0, lim)).forEach(function (l, li) { corpo.appendChild(h('tr', { class: t.destaque === li || (Array.isArray(t.destaque) && t.destaque.indexOf(li) >= 0) ? 'az-dest' : null }, l.map(function (x, i) { var tx = AZ.formatar(x, t.colunas[i].f); return h('td', { class: esq[i] ? 'az-e' : null, text: emReais[i] ? tx.replace(/R\$\s?/, '') : tx }); }))); });
      tb.appendChild(corpo);
    }
    pintar();
    var rod = h('div', { class: 'az-tab-rod' });
    if (t.linhas.length > lim) { var bt = h('button', { type: 'button', class: 'az-botao az-sec az-peq', text: 'Mostrar todas as ' + t.linhas.length + ' linhas', onclick: function () { aberto = !aberto; bt.textContent = aberto ? 'Mostrar menos' : 'Mostrar todas as ' + t.linhas.length + ' linhas'; pintar(); ajustarTabelas(b); altura(); } }); rod.appendChild(bt); }
    if (t.linhas.length > 3 && t.csv !== false) rod.appendChild(h('button', { type: 'button', class: 'az-botao az-sec az-peq', text: 'Baixar planilha (CSV)', onclick: function () {
      var q = function (s) { s = String(s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      var csv = [t.colunas.map(function (c) { return q(c.t); }).join(';')].concat(t.linhas.map(function (l) { return l.map(function (x) { return q(typeof x === 'number' ? String(Math.round(x * 1e8) / 1e8).replace('.', ',') : x instanceof Date ? F.data(x) : x == null ? '' : x); }).join(';'); })).join('\r\n');
      var a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })), download: nome + '.csv' }); document.body.appendChild(a); a.click(); a.remove();
    } }));
    if (rod.childNodes.length) b.appendChild(rod);
    return b;
  }

  /* ───────────── gráficos (SVG próprio, sem bibliotecas) ───────────── */
  var NS = 'http://www.w3.org/2000/svg';
  var gradN = 0;
  function s(tag, at) { var e = document.createElementNS(NS, tag), k; for (k in at) if (at[k] != null) e.setAttribute(k, at[k]); return e; }
  function cor(sr, i) { return sr.cor ? (typeof sr.cor === 'number' ? 'var(--s' + sr.cor + ')' : sr.cor) : 'var(--s' + (i % 5 + 1) + ')'; }
  function escala(min, max, n) {
    if (min === max) { max = min + 1; } var bruto = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(bruto))), rr = bruto / mag, passo = (rr <= 1 ? 1 : rr <= 2 ? 2 : rr <= 2.5 ? 2.5 : rr <= 5 ? 5 : 10) * mag;
    var a = Math.floor(min / passo) * passo, b = Math.ceil(max / passo) * passo, t = [], x; for (x = a; x <= b + passo / 2; x += passo) t.push(Math.abs(x) < passo / 1e6 ? 0 : x); return { min: a, max: b, ticks: t, passo: passo };
  }
  function fmtEixo(v, f, passo) { if (f === 'brl') return F.compacto(v, true); if (f && f.slice && f.slice(0, 3) === 'pct') return F.num(v, passo < 1 ? (passo < 0.1 ? 2 : 1) : passo % 1 ? 1 : 0) + '%'; if (f === 'int') return F.compacto(v); if (typeof f === 'function') return f(v); return Math.abs(v) >= 1e4 ? F.compacto(v) : F.num(v, passo < 1 ? (passo < 0.1 ? 2 : 1) : 0); }

  AZ.grafico = function (cont, gr) {
    if (gr.tipo === 'barras-h') return barrasH(cont, gr);
    var series = gr.series.filter(function (x) { return x && x.dados && x.dados.length; }), rot = gr.rotulos || [], n = rot.length || (series[0] ? series[0].dados.length : 0);
    if (!series.length || !n) return;
    var emp = gr.tipo === 'barras-empilhadas', barra = emp || gr.tipo === 'barras', fmt = gr.formato || 'num';
    if (series.length > 1) { var leg = h('div', { class: 'az-leg' }); series.forEach(function (sr, i) { leg.appendChild(h('span', {}, [h('i', { style: 'background:' + cor(sr, i) }), sr.nome])); }); cont.appendChild(leg); }
    var wrap = h('div', { class: 'az-graf-in' }); cont.appendChild(wrap);
    var dica = h('div', { class: 'az-dica' });
    function desenhar() {
      wrap.innerHTML = ''; wrap.appendChild(dica);
      var W = Math.max(280, wrap.clientWidth || 640), H = (gr.altura || (W < 480 ? 250 : 320)) + (wrap._extra || 0), fs = W < 480 ? 13 : 14, cw = fs * 0.57, i, j, lo = Infinity, hi = -Infinity;
      if (emp) { for (i = 0; i < n; i++) { var p = 0, q = 0; series.forEach(function (sr) { var x = sr.dados[i] || 0; if (x >= 0) p += x; else q += x; }); hi = Math.max(hi, p); lo = Math.min(lo, q); } }
      else series.forEach(function (sr) { sr.dados.forEach(function (x) { if (isFinite(x)) { lo = Math.min(lo, x); hi = Math.max(hi, x); } }); });
      if (barra || gr.zero !== false) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      var e = escala(lo, hi, H < 260 ? 4 : 5), rots = e.ticks.map(function (t) { return fmtEixo(t, fmt, e.passo); });
      if (rots.some(function (r, k) { return rots.indexOf(r) !== k; })) { var cs = e.passo >= 1 ? 0 : e.passo >= 0.1 ? 1 : 2; rots = e.ticks.map(function (t) { return fmt === 'brl' ? 'R$ ' + F.num(t, cs) : F.num(t, Math.max(cs, e.passo < 0.01 ? 4 : cs)) + (fmt && fmt.slice && fmt.slice(0, 3) === 'pct' ? '%' : ''); }); }
      var ml = Math.max.apply(null, rots.map(function (r) { return r.length; })) * cw + 12, mr = 14, mt = 12, mb = fs + 18, pw = W - ml - mr, ph = H - mt - mb;
      var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': gr.titulo || 'Gráfico', style: 'font-size:' + fs + 'px' });
      var y = function (v) { return mt + ph - (v - e.min) / (e.max - e.min) * ph; };
      e.ticks.forEach(function (t, k) { svg.appendChild(s('line', { x1: ml, x2: W - mr, y1: y(t), y2: y(t), stroke: t === 0 ? '#C3CAD8' : '#EEF1F6', 'stroke-width': 1 })); var tx = s('text', { x: ml - 8, y: y(t) + fs * 0.34, 'text-anchor': 'end' }); tx.textContent = rots[k]; svg.appendChild(tx); });
      var faixa = pw / n, x = barra ? function (k) { return ml + faixa * (k + 0.5); } : function (k) { return n === 1 ? ml + pw / 2 : ml + pw * k / (n - 1); };
      var lmax = 0; for (i = 0; i < n; i++) lmax = Math.max(lmax, String(rot[i] == null ? '' : rot[i]).length);
      var maxR = Math.max(2, Math.floor(pw / Math.max(fs * 5, lmax * cw + fs * 1.5))), passoR = Math.max(1, Math.ceil((barra ? n : n - 1) / maxR));
      var ultReg = Math.floor((n - 1) / passoR) * passoR, temFinal = !barra && (n - 1) % passoR !== 0;
      for (i = 0; i < n; i += passoR) { if (temFinal && i !== 0 && x(n - 1) - x(i) < (String(rot[i]).length / 2 + String(rot[n - 1]).length) * cw + 12) continue; var tt = s('text', { x: x(i), y: H - 10, 'text-anchor': barra ? 'middle' : i === 0 ? 'start' : 'middle' }); tt.textContent = rot[i] == null ? '' : rot[i]; svg.appendChild(tt); }
      if (temFinal) { var tf = s('text', { x: x(n - 1), y: H - 10, 'text-anchor': 'end' }); tf.textContent = rot[n - 1]; svg.appendChild(tf); }
      var guia = s(barra ? 'rect' : 'line', barra ? { y: mt, height: ph, width: faixa, fill: 'rgba(19,41,96,.06)', visibility: 'hidden' } : { y1: mt, y2: mt + ph, stroke: '#8A93A6', 'stroke-width': 1, visibility: 'hidden' });
      svg.appendChild(guia);
      if (barra) {
        var grupos = emp ? 1 : series.length, lb = Math.min(24, Math.max(2, (faixa * 0.72 - (grupos - 1) * 2) / grupos)), tot = grupos * lb + (grupos - 1) * 2;
        for (i = 0; i < n; i++) {
          var pos = 0, neg = 0;
          series.forEach(function (sr, si) {
            var val = sr.dados[i] || 0; if (!val) return; var y0, y1, bx;
            if (emp) { if (val >= 0) { y0 = y(pos); pos += val; y1 = y(pos); } else { y0 = y(neg); neg += val; y1 = y(neg); } bx = x(i) - lb / 2; }
            else { y0 = y(0); y1 = y(val); bx = x(i) - tot / 2 + si * (lb + 2); }
            var topo = Math.min(y0, y1), alt = Math.abs(y1 - y0), gap = emp && alt > 3 ? 2 : 0, rr = Math.min(6, lb / 2, alt), ultimo = !emp || si === series.length - 1 || !series.slice(si + 1).some(function (o) { return (o.dados[i] || 0) * val > 0; });
            var d; alt = Math.max(0.5, alt - gap);
            if (val >= 0) { topo += gap; d = ultimo ? 'M' + bx + ' ' + (topo + alt) + 'V' + (topo + rr) + 'q0 ' + (-rr) + ' ' + rr + ' ' + (-rr) + 'h' + (lb - 2 * rr) + 'q' + rr + ' 0 ' + rr + ' ' + rr + 'V' + (topo + alt) + 'Z' : 'M' + bx + ' ' + topo + 'h' + lb + 'v' + alt + 'h' + (-lb) + 'Z'; }
            else d = ultimo ? 'M' + bx + ' ' + topo + 'V' + (topo + alt - rr) + 'q0 ' + rr + ' ' + rr + ' ' + rr + 'h' + (lb - 2 * rr) + 'q' + rr + ' 0 ' + rr + ' ' + (-rr) + 'V' + topo + 'Z' : 'M' + bx + ' ' + topo + 'h' + lb + 'v' + alt + 'h' + (-lb) + 'Z';
            svg.appendChild(s('path', { d: d, style: 'fill:' + cor(sr, si) }));
          });
        }
      } else {
        series.forEach(function (sr, si) {
          var d = '', ult = null, prim = null; sr.dados.forEach(function (val, k) { if (!isFinite(val)) return; d += (d ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(val).toFixed(1); ult = k; if (prim == null) prim = k; });
          if ((gr.tipo === 'area' && si === 0) || sr.area) {
            /* preenchimento em degradê: forte junto à linha, some na base */
            var gid = 'az-g' + (++gradN), defs = s('defs', {}), lg = s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
            lg.appendChild(s('stop', { offset: '0%', style: 'stop-color:' + cor(sr, si) + ';stop-opacity:.26' })); lg.appendChild(s('stop', { offset: '100%', style: 'stop-color:' + cor(sr, si) + ';stop-opacity:.02' })); defs.appendChild(lg); svg.appendChild(defs);
            svg.appendChild(s('path', { d: d + 'L' + x(ult).toFixed(1) + ' ' + y(Math.max(e.min, 0)) + 'L' + x(prim).toFixed(1) + ' ' + y(Math.max(e.min, 0)) + 'Z', fill: 'url(#' + gid + ')' }));
          }
          svg.appendChild(s('path', { d: d, fill: 'none', style: 'stroke:' + cor(sr, si), 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
          if (ult != null) svg.appendChild(s('circle', { cx: x(ult), cy: y(sr.dados[ult]), r: 4, style: 'fill:' + cor(sr, si), stroke: '#fff', 'stroke-width': 2 }));
        });
      }
      var pontos = s('g', {}); svg.appendChild(pontos);
      var alvo = s('rect', { x: ml, y: mt, width: pw, height: ph, fill: 'transparent', style: 'touch-action:pan-y' }); svg.appendChild(alvo);
      function mover(ev) {
        var bb = svg.getBoundingClientRect(), px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - bb.left) * (W / bb.width), k = barra ? Math.floor((px - ml) / faixa) : Math.round((px - ml) / pw * (n - 1));
        k = Math.max(0, Math.min(n - 1, k));
        if (barra) { guia.setAttribute('x', ml + faixa * k); } else { guia.setAttribute('x1', x(k)); guia.setAttribute('x2', x(k)); }
        guia.setAttribute('visibility', 'visible'); pontos.innerHTML = '';
        var linhas = '<b>' + esc((gr.rotuloDica ? gr.rotuloDica + ' ' : '') + (rot[k] == null ? '' : rot[k])) + '</b>';
        series.forEach(function (sr, si) { var val = sr.dados[k]; if (!isFinite(val)) return; if (!barra) pontos.appendChild(s('circle', { cx: x(k), cy: y(val), r: 4.5, style: 'fill:' + cor(sr, si), stroke: '#fff', 'stroke-width': 2 })); linhas += '<div><span><i style="background:' + cor(sr, si) + '"></i>' + esc(sr.nome || '') + '</span><span>' + AZ.formatar(val, fmt) + '</span></div>'; });
        if (emp && series.length > 1) { var tot2 = 0; series.forEach(function (sr) { tot2 += sr.dados[k] || 0; }); linhas += '<div><span>Total</span><span>' + AZ.formatar(tot2, fmt) + '</span></div>'; }
        dica.innerHTML = linhas; dica.style.opacity = 1;
        var cx = x(k) * (bb.width / W), dw = dica.offsetWidth, esq2 = cx + 14 + dw > bb.width ? cx - 14 - dw : cx + 14; dica.style.left = Math.max(0, esq2) + 'px'; dica.style.top = mt + 'px';
      }
      function sair() { guia.setAttribute('visibility', 'hidden'); pontos.innerHTML = ''; dica.style.opacity = 0; }
      alvo.addEventListener('mousemove', mover); alvo.addEventListener('mouseleave', sair); alvo.addEventListener('touchstart', mover, { passive: true }); alvo.addEventListener('touchmove', mover, { passive: true }); alvo.addEventListener('touchend', sair);
      wrap.appendChild(svg);
    }
    desenhar();
    wrap._redesenhar = desenhar;
    if (g.ResizeObserver) { var lw = wrap.clientWidth, ro = new ResizeObserver(function () { if (!document.body.contains(wrap)) { ro.disconnect(); return; } if (Math.abs(wrap.clientWidth - lw) > 4) { lw = wrap.clientWidth; desenhar(); } }); ro.observe(wrap); }
  };
  /* barras horizontais para comparar poucos itens nomeados: {tipo:'barras-h', itens:[{nome, valor, cor?}], formato} */
  function barrasH(cont, gr) {
    var its = gr.itens || [], max = Math.max.apply(null, its.map(function (i) { return Math.abs(i.valor); }).concat([1e-9]));
    var b = h('div', { class: 'az-barras-h', style: 'display:grid;gap:12px' });
    its.forEach(function (it, i) {
      b.appendChild(h('div', {}, [
        h('div', { style: 'display:flex;justify-content:space-between;gap:12px;font-weight:600;margin-bottom:5px' }, [h('span', { text: it.nome }), h('span', { text: AZ.formatar(it.valor, gr.formato || 'num'), style: 'font-variant-numeric:lining-nums tabular-nums' })]),
        h('div', { style: 'background:#EEF1F6;border-radius:999px;height:12px;overflow:hidden' }, [h('div', { style: 'height:12px;border-radius:999px;width:' + Math.max(0.5, Math.abs(it.valor) / max * 100) + '%;background:' + (it.cor ? (typeof it.cor === 'number' ? 'var(--s' + it.cor + ')' : it.cor) : 'var(--s' + (i % 5 + 1) + ')') })])]));
    });
    cont.appendChild(b);
  }


  /* ───────────── identidade do site (topo e rodapé em todas as páginas) ───────────── */
  AZ.site = Object.assign({
    base: 'https://investimentosdeaz.com.br',
    nav: [['Conteúdo', '/conteudo'], ['Painel econômico', '/painel-economico'], ['__simuladores__', ''], ['Nosso time', '/nosso-time']],
    login: ['Login', '/area-restrita/login'],
    slogan: 'Economia, mercado e educação financeira para investir com clareza.',
    atalhos: [['Conteúdo', '/conteudo'], ['Painel econômico', '/painel-economico'], ['Simuladores', 'index.html'], ['Nosso time', '/nosso-time']],
    email: 'azinvest.equipe@gmail.com',
    telefone: '(48) 99938-6708',
    whatsapp: 'https://wa.me/5548999386708',
    youtube: 'https://www.youtube.com/channel/UCuMfW1AOhcbSP1zRG5hyBZQ',
    sobre: 'A AZ Invest é uma plataforma de conteúdo sobre economia, mercado e educação financeira — análises, simuladores e um painel econômico atualizado para você investir com mais clareza.',
    empresa: 'INVESTIMENTOS DE A A Z',
    razaoSocial: '', cnpj: '', regulatorio: '',
    aviso: 'Simulação de caráter educativo. Os resultados dependem das premissas informadas e não constituem recomendação de investimento.'
  }, AZ.cfg.site || {});
  function urlSite(u) { return /^(https?:)?\/\//.test(u) || /\.html(#|$)/.test(u) || u.charAt(0) === '#' ? u : AZ.site.base + u; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  AZ.menu = [
    ['index.html', 'Todos os simuladores'],
    ['juros-compostos-unificado.html', 'Juros compostos'],
    ['https://investimentosdeaz.com.br/simuladores/consorcio', 'Consórcio ou financiamento'],
    ['restituicao-imposto-de-renda.html', 'Imposto de renda e PGBL'],
    ['aposentadoria-unificada.html', 'Aposentadoria e viver de renda'],
    ['renda-fixa-unificada.html', 'CDB, LCI e LCA'],
    ['financiamento-unificado.html', 'Financiamento e empréstimo'],
    ['correcao-unificada.html', 'Correção de valores'],
    ['index.html#temas', 'Todos por tema']
  ];
  function montarMenu() {
    var nav = document.querySelector('.az-topo nav'); if (!nav) return;
    var atual = (location.pathname.split('/').pop() || 'index.html');
    nav.innerHTML = '';
    AZ.site.nav.forEach(function (it) {
      if (it[0] === '__simuladores__') {
        var d = el('details', 'az-menu'), sm = el('summary', null, 'Simuladores'); d.appendChild(sm);
        var ul = el('ul');
        AZ.menu.forEach(function (m) { var li = el('li'), a = el('a', null, m[1]); a.href = m[0]; if (m[0] === atual) a.setAttribute('aria-current', 'page'); if (m[0].indexOf('#') > 0) a.className = 'az-menu-outros'; li.appendChild(a); ul.appendChild(li); });
        d.appendChild(ul); nav.appendChild(d);
        document.addEventListener('click', function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.open = false; });
      } else { var a = el('a', null, it[0]); a.href = urlSite(it[1]); nav.appendChild(a); }
    });
    if (AZ.site.login) { var lg = el('a', 'az-login', AZ.site.login[0]); lg.href = urlSite(AZ.site.login[1]); nav.appendChild(lg); }
    var logo = document.querySelector('.az-topo .az-logo'); if (logo) { logo.href = urlSite('/'); logo.setAttribute('aria-label', 'AZ Invest: página inicial'); }
    montarPainel(nav);
  }
  /* celular e tablet (< 1024 px): como no site (MobileMenu de NavLinks.tsx), só Login + botão de menu; o painel abre
     por cima do conteúdo, com os mesmos itens do site e "Simuladores" marcado */
  var HAMB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>',
    FECHAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';
  function montarPainel(nav) {
    var topo = nav.closest('.az-topo'); if (!topo || topo.querySelector('.az-painel')) return;
    var bt = el('button', 'az-hamb'), painel = el('div', 'az-painel'), ul = el('ul');
    bt.type = 'button'; bt.setAttribute('aria-controls', 'menu-principal');
    painel.id = 'menu-principal'; painel.setAttribute('role', 'navigation'); painel.setAttribute('aria-label', 'Navegação principal');
    function abrir(v) { painel.hidden = !v; bt.setAttribute('aria-expanded', String(v)); bt.setAttribute('aria-label', v ? 'Fechar menu' : 'Abrir menu'); bt.innerHTML = v ? FECHAR : HAMB; }
    AZ.site.nav.forEach(function (it) {
      var sim = it[0] === '__simuladores__', li = el('li'), a = el('a', null, sim ? 'Simuladores' : it[0]);
      a.href = sim ? 'index.html' : urlSite(it[1]); if (sim) a.setAttribute('aria-current', 'page');
      a.addEventListener('click', function () { abrir(false); }); li.appendChild(a); ul.appendChild(li);
    });
    painel.appendChild(ul);
    bt.addEventListener('click', function () { abrir(painel.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !painel.hidden) { abrir(false); bt.focus(); } });
    nav.appendChild(bt); topo.appendChild(painel); abrir(false);
  }
  /* trilha: "← Todos os simuladores" + pílula da categoria */
  function montarTrilha() {
    var t = document.querySelector('.az-hero .az-trilha'); if (!t) return;
    var links = t.querySelectorAll('a'); if (!links.length) return;
    var volta = el('a', 'az-voltar', 'Todos os simuladores'); volta.href = 'index.html';
    var frag = document.createDocumentFragment(); frag.appendChild(volta);
    if (links.length > 1) { var p = el('a', 'az-pill', links[links.length - 1].textContent.trim()); p.href = links[links.length - 1].getAttribute('href'); frag.appendChild(p); }
    t.innerHTML = ''; t.appendChild(frag);
  }
  /* aviso curto abaixo do simulador */
  function montarAviso() {
    var app = document.getElementById('az-app'); if (!app || !AZ.site.aviso) return;
    app.insertAdjacentElement('afterend', el('p', 'az-aviso-rod', AZ.site.aviso));
  }
  /* rodapé igual ao do site (site-az-invest/src/components/common/Footer.tsx); os avisos legais dos
     simuladores ficam na faixa .az-legal, logo acima */
  var ICONES = {
    YouTube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    WhatsApp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.520.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.711.306 1.265.489 1.697.626.713.226 1.362.194 1.875.118.572-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>'
  };
  function montarRodape() {
    var rod = document.querySelector('.az-rodape'); if (!rod || rod.querySelector('.az-rod-grade')) return;
    var S = AZ.site, g = el('div', 'az-rod-grade');
    var c1 = el('div', 'az-rod-marca'), c1i = el('div', 'az-rod-marca-in');
    var home = el('a'); home.href = urlSite('/'); home.setAttribute('aria-label', 'AZ Invest: página inicial');
    var img = el('img'); img.src = 'assets/logo-topo.webp'; img.alt = 'AZ Invest - Investimentos de A a Z'; img.width = 951; img.height = 310; img.loading = 'lazy';
    home.appendChild(img); c1i.appendChild(home); c1i.appendChild(el('p', 'az-rod-tag', S.slogan));
    var soc = el('div', 'az-rod-sociais');
    [['YouTube', S.youtube], ['WhatsApp', S.whatsapp]].forEach(function (r) {
      if (!r[1]) return;
      var a = el('a'); a.href = r[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', r[0]); a.innerHTML = ICONES[r[0]]; soc.appendChild(a);
    });
    c1i.appendChild(soc); c1.appendChild(c1i); g.appendChild(c1);
    var c2 = el('div', 'az-rod-col'); c2.appendChild(el('h2', null, 'Atalhos')); var ul = el('ul');
    S.atalhos.forEach(function (it) { var li = el('li'), a = el('a', null, it[0]); a.href = urlSite(it[1]); li.appendChild(a); ul.appendChild(li); });
    c2.appendChild(ul); g.appendChild(c2);
    var c3 = el('div', 'az-rod-col'); c3.appendChild(el('h2', null, 'Entre em contato'));
    function linha(rot, txt, href) { var p = el('p'); p.appendChild(el('strong', null, rot)); p.appendChild(document.createTextNode(' ')); var a = el('a', null, txt); a.href = href; p.appendChild(a); c3.appendChild(p); }
    if (S.email) linha('Email:', S.email, 'mailto:' + S.email);
    if (S.telefone) linha('Telefone:', S.telefone, 'tel:+' + S.telefone.replace(/\D/g, '').replace(/^(?!55)/, '55'));
    if (S.whatsapp) { var w = el('a', 'az-rod-wpp', 'WhatsApp'); w.href = S.whatsapp; w.target = '_blank'; w.rel = 'noopener noreferrer'; c3.appendChild(w); }
    g.appendChild(c3);
    var sobre = el('div', 'az-rod-sobre'), si = el('div');
    si.appendChild(el('p', null, S.sobre));
    if (S.regulatorio) si.appendChild(el('p', null, S.regulatorio));
    sobre.appendChild(si);
    rod.innerHTML = ''; rod.appendChild(g); rod.appendChild(sobre);
    rod.appendChild(el('p', 'az-rod-copy', new Date().getFullYear() + ' Todos os direitos reservados para ' + (S.razaoSocial || S.empresa) + (S.cnpj ? ' · CNPJ ' + S.cnpj : '')));
  }
  /* fórmulas do "Como funciona": expoentes sobrescritos e, quando longas, em linha própria */
  function formulas(raiz) {
    [].forEach.call((raiz || document).querySelectorAll(raiz ? 'code' : '.az-sobre code'), function (c) {
      var t = c.textContent; if (c.children.length) return;
      c.innerHTML = esc(t).replace(/\^\(([^()]*)\)/g, '<sup>$1</sup>').replace(/\^(-?[\w,.]+)/g, '<sup>$1</sup>');
      if (t.length > 26) {
        c.className = 'az-formula';
        /* pontuação que vinha logo depois da fórmula sobe para a linha dela, para não ficar solta */
        var nx = c.nextSibling; if (nx && nx.nodeType === 3) { var m = /^\s*([.,;:])\s*/.exec(nx.nodeValue); if (m) { c.appendChild(document.createTextNode(m[1])); nx.nodeValue = nx.nodeValue.slice(m[0].length); } }
      }
    });
  }
  /* ───────────── contador de visitas ─────────────
     Envia ao coletor do site (/api/analytics/collect, o mesmo das páginas Next) só o endereço da página, sem query nem
     fragmento (é lá que ficam os valores digitados), a origem externa (sem query) e as utm. Só conta no domínio do site;
     não conta robôs (navigator.webdriver ou agente headless, de busca ou de captura), páginas embutidas (embed=1, a página
     que embute já conta) nem a equipe: um link com ?nao-contar=1 grava a marca neste navegador e ?nao-contar=0 a apaga.
     O parâmetro sai da barra logo depois de lido, para não ir junto no "Copiar link da simulação". */
  function contarVisita() {
    try {
      var host = location.hostname, q = new URLSearchParams(location.search);
      if (q.has('nao-contar')) {
        try { if (q.get('nao-contar') === '1') localStorage.setItem('az-nao-contar', '1'); else localStorage.removeItem('az-nao-contar'); } catch (e) { }
        var q2 = new URLSearchParams(location.search); q2.delete('nao-contar'); var s = q2.toString();
        try { history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) { }
      }
      if (!/(^|\.)investimentosdeaz\.com\.br$/.test(host) || navigator.webdriver || q.get('embed') === '1') return;
      if (/HeadlessChrome|Lighthouse|\bbot\b|bot\/|crawler|spider|slurp/i.test(navigator.userAgent || '')) return;
      try { if (localStorage.getItem('az-nao-contar') === '1') return; } catch (e) { }
      var corpo = { type: 'page_view', path: location.pathname.slice(0, 500) };
      try { var r = document.referrer && new URL(document.referrer); if (r && r.hostname !== host) corpo.referrer = (r.origin + r.pathname).slice(0, 500); } catch (e) { }
      ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { var x = q.get(k); if (x) corpo[k] = x.slice(0, 200); });
      fetch('/api/analytics/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), keepalive: true }).catch(function () { });
    } catch (e) { }
  }
  /* ───────────── página índice: busca ───────────── */
  function norm(t) { return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  document.addEventListener('DOMContentLoaded', function () {
    try { if (/[?&]embed=1/.test(location.search)) document.documentElement.classList.add('az-embed'); } catch (e) { }
    montarMenu(); montarTrilha(); montarAviso(); montarRodape(); contarVisita();
    /* índice com duas vistas: principais OU outros. Com "Outros simuladores" aberto e sem busca, os principais ficam ocultos. */
    var outrosEl = document.getElementById('az-outros');
    function vista() { var b = document.getElementById('az-busca'), q = !!(b && b.value.trim()); document.documentElement.classList.toggle('az-so-outros', !!(outrosEl && outrosEl.open && !q)); document.documentElement.classList.toggle('az-buscando', q); }
    function abrirOutros() { if (outrosEl && location.hash === '#az-outros') { outrosEl.open = true; vista(); setTimeout(function () { window.scrollTo(0, 0); }, 0); } }
    if (outrosEl) outrosEl.addEventListener('toggle', function () { var antes = document.documentElement.classList.contains('az-so-outros'); vista(); if (document.documentElement.classList.contains('az-so-outros') !== antes) window.scrollTo(0, 0); if (!outrosEl.open && location.hash === '#az-outros') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } } });
    abrirOutros(); window.addEventListener('hashchange', abrirOutros);
    var mais = document.querySelector('.az-mais'); if (mais && outrosEl) mais.addEventListener('click', function (e) { e.preventDefault(); outrosEl.open = true; try { history.replaceState(null, '', '#az-outros'); } catch (e2) { } vista(); window.scrollTo(0, 0); });
    var volta = outrosEl && outrosEl.querySelector('summary'); if (volta) volta.addEventListener('click', function (e) { e.preventDefault(); outrosEl.open = false; });
    var cta = document.getElementById('az-cta'), c = Object.assign({}, AZ.cfg.cta || {}); if (!c.url) c.url = AZ.site.whatsapp || '';
    formulas();
    if (cta && c.url && c.titulo) { cta.hidden = false; cta.querySelector('h2').textContent = c.titulo; cta.querySelector('p').textContent = c.texto; var a = cta.querySelector('a'); a.textContent = c.botao; a.href = c.url; }
    /* no celular os temas começam recolhidos (a estrutura cabe numa tela); o cabeçalho abre e fecha */
    if ((g.innerWidth || 1280) < 761) [].forEach.call(document.querySelectorAll('.az-tema'), function (sec) {
      var cab = sec.querySelector('.az-tema-cab'); if (!cab) return; sec.classList.add('az-fechado');
      cab.setAttribute('role', 'button'); cab.setAttribute('tabindex', '0'); cab.setAttribute('aria-expanded', 'false');
      var alternar = function () { var f = sec.classList.toggle('az-fechado'); cab.setAttribute('aria-expanded', f ? 'false' : 'true'); };
      cab.addEventListener('click', alternar); cab.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } });
    });
    var busca = document.getElementById('az-busca'); if (!busca) return;
    var itens = [].slice.call(document.querySelectorAll('.az-item')), nada = document.getElementById('az-nada');
    busca.addEventListener('input', function () {
      var outros = document.getElementById('az-outros'); if (outros && busca.value.trim()) outros.open = true;
      /* casa no começo das palavras ("ir" não acha "investir"); plural simples e "ações" viram a forma do cadastro */
      var SIN = { acoes: 'acao', imoveis: 'imovel', emprestimos: 'emprestimo' };
      var t = norm(busca.value.trim()).split(/[^a-z0-9%$]+/).filter(Boolean).map(function (p) { return SIN[p] || (p.length > 4 && /s$/.test(p) ? p.slice(0, -1) : p); }), vis = 0;
      itens.forEach(function (it) { var txt = it._t || (it._t = ' ' + norm(it.textContent + ' ' + (it.getAttribute('data-k') || '')).replace(/[^a-z0-9%$]+/g, ' ')), ok = t.every(function (p) { return txt.indexOf(' ' + p) >= 0; }); it.hidden = !ok; if (ok) vis++; });
      [].forEach.call(document.querySelectorAll('.az-cat, .az-cat .az-sub'), function (sec) { sec.hidden = !sec.querySelector('.az-item:not([hidden])'); });
      if (nada) nada.hidden = vis > 0;
      document.documentElement.classList.toggle('az-vazio', !vis && !!busca.value.trim());
      if (outros && !busca.value.trim()) outros.open = false;
      vista();
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
