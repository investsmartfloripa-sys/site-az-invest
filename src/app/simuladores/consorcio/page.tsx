"use client";

import { useState, useMemo, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Home, Car, Truck, Bike, Key, Building2, TrendingUp, Briefcase, Check, ChevronLeft, Trophy, Info, ArrowRight, Sparkles, Target, AlertCircle, Settings, TrendingDown, Layers, Wallet } from "lucide-react";

const fmt = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtCents = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
const fmtCompact = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `R$ ${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `R$ ${(n / 1e3).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
};

// 2 índices apenas (média IPCA/INCC e Pré 3%)
const TAXAS_CORRECAO = { media: 0.0575, pre3: 0.03 };
const NOMES_INDICE = { media: 'Média IPCA/INCC', pre3: 'Pré 3%' };

// Logos das administradoras (representação estilizada — substituir por imagens reais quando houver)
const ADMS = [
  { nome: 'Porto', cor: '#0033A0' },
  { nome: 'Embracon', cor: '#0066B3' },
  { nome: 'Rodobens', cor: '#003F7F' },
  { nome: 'Ademicon', cor: '#1A4D8C' },
  { nome: 'CNP', cor: '#003366' },
  { nome: 'Mapfre', cor: '#D80E18' },
  { nome: 'Itaú', cor: '#EC7000' },
  { nome: 'HS', cor: '#1E3A8A' },
  { nome: 'Bradesco', cor: '#CC092F' },
  { nome: 'Santander', cor: '#EC0000' },
];

const VALORIZACAO_IMOVEL = 0.05;
const CDI_PROJECAO = 0.10;

// Paleta refinada — azul mais sóbrio (navy), uso comedido de azul vibrante
const C = {
  // Tons principais
  dark: '#0f172a',
  darker: '#020617',
  // Azul navy (sóbrio) — usado pra texto, headings, números importantes
  navy: '#1e3a8a',
  navyDeep: '#172554',
  // Azul médio — pra elementos de UI ativos
  blue: '#2563eb',
  blueSoft: '#3b82f6',
  // Acento (raro, pra hover/focus)
  blueAccent: '#0284c7',
  // Backgrounds azulados
  blueBg: '#dbeafe',
  blueBgSoft: '#eff6ff',
  // Laranja (CTA principal)
  orange: '#FF5713',
  orangeDark: '#E04A0F',
  orangeBg: '#fff7ed',
  orangeBgSoft: '#fff3ed',
  // Cinzas
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  textDim: '#64748b',
  textMore: '#94a3b8',
};

// ===== Tipos de bem =====
const TIPOS_BEM = {
  imovel: {
    label: 'Imóvel',
    iconeKey: 'home',
    desc: 'Casa, apartamento, terreno ou comercial',
    img: null,
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
    valorDefault: 400000, prazoDefault: 200,
    prazos: [180, 200, 220, 240],
    minValor: 100000, maxValor: 2000000, stepValor: 25000,
    taxaAdm: 0.23,
    taxaFinanMensal: 0.01045, // ~13,3% a.a. — SFH
    prazoMaxFinan: 360,
    indiceDefault: 'media',
    objetivos: [
      { id: 'sair-aluguel', nome: 'Sair do aluguel', desc: 'Parar de pagar aluguel e conquistar o primeiro imóvel', iconeKey: 'key' },
      { id: 'trocar', nome: 'Trocar de imóvel', desc: 'Upgrade: maior, melhor localização ou novo padrão', iconeKey: 'building' },
      { id: 'renda', nome: 'Ter renda de aluguel', desc: 'Investir em imóvel para alugar e gerar renda passiva', iconeKey: 'trending' },
    ],
  },
  carro: {
    label: 'Carro',
    iconeKey: 'car',
    desc: 'Veículo novo, seminovo, utilitário',
    img: null,
    gradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
    valorDefault: 80000, prazoDefault: 60,
    prazos: [48, 60, 72],
    minValor: 30000, maxValor: 300000, stepValor: 5000,
    taxaAdm: 0.20,
    taxaFinanMensal: 0.01876, // ~25% a.a.
    prazoMaxFinan: 60,
    indiceDefault: 'media',
    objetivos: [
      { id: 'adquirir-carro', nome: 'Adquirir um carro', desc: 'Conquistar seu primeiro carro ou um adicional', iconeKey: 'car' },
      { id: 'trocar-carro', nome: 'Trocar de carro', desc: 'Vender o atual e usar como lance — acelera muito', iconeKey: 'car' },
    ],
  },
  pesados: {
    label: 'Pesados',
    iconeKey: 'truck',
    desc: 'Caminhões, máquinas, ônibus',
    img: null,
    gradient: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
    valorDefault: 250000, prazoDefault: 80,
    prazos: [60, 80, 100, 120],
    minValor: 80000, maxValor: 1000000, stepValor: 10000,
    taxaAdm: 0.22,
    taxaFinanMensal: 0.0156, // ~20,4% a.a.
    prazoMaxFinan: 84,
    indiceDefault: 'media',
    objetivos: [
      { id: 'pesado', nome: 'Adquirir veículo pesado', desc: 'Caminhão, máquina ou ônibus', iconeKey: 'truck' },
    ],
  },
  motos: {
    label: 'Motocicletas',
    iconeKey: 'bike',
    desc: 'Motos novas ou seminovas',
    img: null,
    gradient: 'linear-gradient(135deg, #FF5713 0%, #7c2d0e 100%)',
    valorDefault: 25000, prazoDefault: 60,
    prazos: [48, 60, 72],
    minValor: 8000, maxValor: 150000, stepValor: 1000,
    taxaAdm: 0.21,
    taxaFinanMensal: 0.0210, // ~28,3% a.a.
    prazoMaxFinan: 60,
    indiceDefault: 'media',
    objetivos: [
      { id: 'adquirir-moto', nome: 'Adquirir uma moto', desc: 'Conquistar sua primeira moto ou uma adicional', iconeKey: 'bike' },
      { id: 'trocar-moto', nome: 'Trocar de moto', desc: 'Vender a atual e usar como lance — acelera muito', iconeKey: 'bike' },
    ],
  },
};

const ICONS = {
  home: Home, car: Car, truck: Truck, bike: Bike,
  key: Key, building: Building2, trending: TrendingUp,
  briefcase: Briefcase,
};

// ===== Componentes auxiliares =====
const NumField = ({ value, onChange, min, max, prefix, suffix, width = 'w-28', size = 'text-xl' }) => (
  <div className="inline-flex items-center gap-1">
    {prefix && <span className="text-sm" style={{ color: C.textDim }}>{prefix}</span>}
    <input
      type="text"
      inputMode="numeric"
      value={value.toLocaleString('pt-BR')}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/\D/g, '');
        const num = cleaned === '' ? 0 : parseInt(cleaned);
        onChange(Math.min(Math.max(num, min), max));
      }}
      onFocus={(e) => e.target.select()}
      className={`${size} font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right ${width}`}
      style={{ color: C.dark, borderColor: 'transparent' }}
      onFocusCapture={(e) => { e.target.style.borderColor = C.blue; e.target.style.backgroundColor = '#f8fafc'; }}
      onBlurCapture={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
    />
    {suffix && <span className="text-sm" style={{ color: C.textDim }}>{suffix}</span>}
  </div>
);

const ChartLegend = ({ items }) => (
  <div className="flex items-center justify-center flex-wrap gap-4 mb-3 text-xs" style={{ color: '#475569' }}>
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: it.color }} />
        <span>{it.label}</span>
      </div>
    ))}
  </div>
);

// Logo placeholder estilizado
const AdmLogo = ({ adm }) => (
  <div className="flex items-center justify-center px-4 py-2.5 rounded-lg shrink-0"
    style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', minWidth: 100, minHeight: 44 }}>
    <span className="text-sm font-extrabold tracking-tight" style={{
      color: adm.cor,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      letterSpacing: '-0.02em',
    }}>{adm.nome}</span>
  </div>
);

// Card de tipo de bem — usa foto se info.img existir, senão gradient com ícone grande
const TipoBemCard = ({ tipoKey, info, onClick }) => {
  const Ico = ICONS[info.iconeKey];
  const temFoto = !!info.img;
  return (
    <button onClick={onClick}
      className="group rounded-2xl text-left transition-all overflow-hidden flex flex-col"
      style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.boxShadow = '0 16px 40px -12px rgba(30,58,138,0.3)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
      <div className="relative h-44 md:h-52 w-full overflow-hidden flex items-center justify-center"
        style={{
          background: temFoto
            ? `linear-gradient(180deg, transparent 55%, rgba(15,23,42,0.4) 100%), url("${info.img}") center/cover no-repeat, ${info.gradient}`
            : info.gradient
        }}>
        {!temFoto && (
          <>
            <div className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 50%)',
              }} />
            <div className="relative z-10 transition-transform duration-500 group-hover:scale-110">
              <Ico className="w-20 h-20 md:w-24 md:h-24" strokeWidth={1.25} style={{ color: 'rgba(255,255,255,0.95)' }} />
            </div>
          </>
        )}
        {temFoto && (
          <div className="absolute top-3 left-3 w-10 h-10 rounded-lg flex items-center justify-center backdrop-blur-sm z-10"
            style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}>
            <Ico className="w-5 h-5" strokeWidth={2} style={{ color: C.navy }} />
          </div>
        )}
      </div>
      <div className="p-5 md:p-6 flex-1 flex flex-col">
        <div className="text-xl md:text-2xl font-bold mb-1" style={{ color: C.dark }}>{info.label}</div>
        <div className="mb-4 text-sm flex-1" style={{ color: C.textDim }}>{info.desc}</div>
        <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: C.navy }}>
          Começar <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </button>
  );
};

export default function Simulador() {
  const [step, setStep] = useState(0);
  const [tipoBem, setTipoBem] = useState(null);
  const [objetivo, setObjetivo] = useState(null);
  const [valorBem, setValorBem] = useState(400000);
  const [prazo, setPrazo] = useState(180);
  const [aluguelAtual, setAluguelAtual] = useState(2500);
  const [invMensal, setInvMensal] = useState(0);
  const [aluguelEsperado, setAluguelEsperado] = useState(2500);
  const [invMensalRenda, setInvMensalRenda] = useState(0);
  const [faturamentoEsperado, setFaturamentoEsperado] = useState(3000);
  const [valorBemAtual, setValorBemAtual] = useState(0);
  const [lanceProprioAtivo, setLanceProprioAtivo] = useState(false);
  const [valorLance, setValorLance] = useState(0);
  const [lanceEmbutidoAtivo, setLanceEmbutidoAtivo] = useState(false);
  const [embutidoPerc, setEmbutidoPerc] = useState(10);
  const [taxaAdmCustom, setTaxaAdmCustom] = useState(null);
  const [indiceCorrecao, setIndiceCorrecao] = useState('media');
  const [redutor, setRedutor] = useState('nenhum');
  const [numCartas, setNumCartas] = useState(1);
  const [aumentarChances, setAumentarChances] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [leadNome, setLeadNome] = useState('');
  const [leadTel, setLeadTel] = useState('');
  const [leadEnviado, setLeadEnviado] = useState(false);

  const info = tipoBem ? TIPOS_BEM[tipoBem] : null;
  const isImovel = tipoBem === 'imovel';
  const isCarro = tipoBem === 'carro';
  const isPesado = tipoBem === 'pesados';
  const isMoto = tipoBem === 'motos';

  useEffect(() => {
    if (!tipoBem) return;
    const i = TIPOS_BEM[tipoBem];
    setValorBem(i.valorDefault);
    setPrazo(i.prazoDefault);
    setIndiceCorrecao(i.indiceDefault);
    if (tipoBem === 'imovel') { setAluguelAtual(2500); setAluguelEsperado(2500); setInvMensal(0); setInvMensalRenda(0); }
    else { setFaturamentoEsperado(3000); }
    setLanceProprioAtivo(false); setValorLance(0);
    setLanceEmbutidoAtivo(false); setEmbutidoPerc(10);
    setTaxaAdmCustom(null); setRedutor('nenhum');
    setNumCartas(1); setAumentarChances(false);
    setValorBemAtual(0);
  }, [tipoBem]);

  useEffect(() => {
    if (!aumentarChances) setNumCartas(1);
    else if (numCartas === 1) setNumCartas(2);
  }, [aumentarChances]);

  const taxaAdmDefault = info ? (isCarro && prazo <= 60 ? 0.20 : info.taxaAdm) : 0.23;
  const taxaAdm = taxaAdmCustom !== null ? taxaAdmCustom : taxaAdmDefault;
  const fundoReserva = 0.02;
  const taxaCorrecao = TAXAS_CORRECAO[indiceCorrecao];
  const nomeIndice = NOMES_INDICE[indiceCorrecao];

  const cdiMensalProj = Math.pow(1 + CDI_PROJECAO, 1/12) - 1;

  const saldoTotalPlano = valorBem * (1 + taxaAdm + fundoReserva);
  const parcelaNormal = prazo > 0 ? saldoTotalPlano / prazo : 0;
  const fatorRedutor = redutor === '25' ? 0.75 : redutor === '50' ? 0.50 : 1;
  const parcelaAtual = parcelaNormal * fatorRedutor;
  const custoTotalConsorcio = parcelaNormal * prazo;

  const valorLanceProprio = lanceProprioAtivo ? valorLance : 0;
  const valorLanceEmbutido = lanceEmbutidoAtivo ? valorBem * (embutidoPerc / 100) : 0;
  const valorLanceTotal = valorLanceProprio + valorLanceEmbutido;
  const creditoLiquido = lanceEmbutidoAtivo ? valorBem * (1 - embutidoPerc / 100) : valorBem;
  const temLance = valorLanceTotal > 0;
  const temRedutor = redutor !== 'nenhum';

  const valorPorCarta = valorBem / numCartas;
  const lanceProprioPorCarta = valorLanceProprio / numCartas;
  const lanceTotalPorCarta = valorLanceTotal / numCartas;

  // ===== Financiamento =====
  const taxaFinanMensal = info?.taxaFinanMensal || 0.01045;
  const taxaFinanAnual = Math.pow(1 + taxaFinanMensal, 12) - 1;
  const prazoMaxFinan = info?.prazoMaxFinan || 360;
  const prazoFinanComparado = Math.min(prazo, prazoMaxFinan);
  const prazoExcedeFinan = prazo > prazoMaxFinan;

  const entradaFinan = valorBem * 0.2;
  const valorFinanciado = valorBem - entradaFinan;

  const calcPrice = (principal, rate, n) => {
    if (!n) return { parcela: 0, total: 0 };
    const parcela = principal * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
    return { parcela, total: parcela * n + entradaFinan };
  };
  const calcSac = (principal, rate, n) => {
    if (!n) return { parcInicial: 0, parcFinal: 0, total: 0 };
    const amort = principal / n;
    const parcInicial = amort + principal * rate;
    const parcFinal = amort + amort * rate;
    const totalJuros = principal * rate * (n + 1) / 2;
    return { parcInicial, parcFinal, total: principal + totalJuros + entradaFinan };
  };

  // Comparativo: financiamento no MESMO prazo do consórcio (capeado em prazoMaxFinan)
  const cenariosFinan = useMemo(() => [
    { tipo: 'Price', prazoM: prazoFinanComparado, ...calcPrice(valorFinanciado, taxaFinanMensal, prazoFinanComparado) },
    { tipo: 'SAC', prazoM: prazoFinanComparado, ...calcSac(valorFinanciado, taxaFinanMensal, prazoFinanComparado) },
  ], [valorFinanciado, taxaFinanMensal, prazoFinanComparado]);

  const melhorFinan = cenariosFinan.reduce((a, b) => (a.total < b.total ? a : b), { total: Infinity });
  const economiaVsMelhor = melhorFinan.total - custoTotalConsorcio;

  // ===== Probabilidade — calibragem realista =====
  const dadosProbabilidade = useMemo(() => {
    if (prazo <= 0) return [];
    const lanceMedio = isCarro || isMoto ? 0.40 : 0.30;
    const percLance = valorBem > 0 ? valorLanceTotal / valorBem : 0;
    const strength = lanceMedio > 0 && percLance > 0 ? percLance / lanceMedio : 0;

    let pLanceMensal;
    if (percLance === 0) pLanceMensal = 0;
    else if (strength >= 2.2) pLanceMensal = 0.06;
    else if (strength >= 1.7) pLanceMensal = 0.045;
    else if (strength >= 1.3) pLanceMensal = 0.03;
    else if (strength >= 1.0) pLanceMensal = 0.02;
    else if (strength >= 0.6) pLanceMensal = 0.01;
    else if (strength >= 0.3) pLanceMensal = 0.005;
    else pLanceMensal = 0.002;

    const dados = [];
    for (let m = 1; m <= prazo; m++) {
      const pLance = 1 - Math.pow(1 - pLanceMensal, m);
      const pSorteio = m / prazo;
      const pIndividual = 1 - (1 - pLance) * (1 - pSorteio);
      const pMultiplas = 1 - Math.pow(1 - pIndividual, numCartas);
      dados.push({
        mes: m,
        individual: +(pIndividual * 100).toFixed(1),
        multiplas: +(pMultiplas * 100).toFixed(1),
      });
    }
    return dados;
  }, [prazo, isCarro, isMoto, valorLanceTotal, valorBem, numCartas]);

  const mes50 = dadosProbabilidade.find(x => (numCartas > 1 ? x.multiplas : x.individual) >= 50)?.mes || Math.round(prazo / 2);
  const prob12 = numCartas > 1 ? (dadosProbabilidade[11]?.multiplas || 0) : (dadosProbabilidade[11]?.individual || 0);
  const prob36Idx = Math.min(35, prazo - 1);
  const prob36 = numCartas > 1 ? (dadosProbabilidade[prob36Idx]?.multiplas || 0) : (dadosProbabilidade[prob36Idx]?.individual || 0);
  const probIndividual12 = dadosProbabilidade[11]?.individual || 0;

  const pagoAteContemplacao = parcelaAtual * mes50;
  const saldoAposContemplacao = Math.max(0, saldoTotalPlano - pagoAteContemplacao - valorLanceTotal);
  const mesesRestantes = Math.max(1, prazo - mes50);
  const parcelaPosContemplacao = saldoAposContemplacao / mesesRestantes;
  const diferencaPos = parcelaPosContemplacao - parcelaAtual;
  const parcelaPosAumentou = diferencaPos > 1;
  const parcelaPosDiminuiu = diferencaPos < -1;
  const mostrarParcelaPos = temLance || temRedutor;

  const orcamentoTotal = aluguelAtual + invMensal;
  const sobraConsorcio = orcamentoTotal - parcelaAtual;
  const orcamentoInsuficiente = sobraConsorcio < 0;

  const dadosEvolucao = useMemo(() => {
    if (prazo <= 0 || objetivo !== 'sair-aluguel') return [];
    const anos = Math.ceil(prazo / 12);
    const pontos = [];
    for (let a = 0; a <= anos; a++) {
      const meses = Math.min(a * 12, prazo);
      const patAluguel = invMensal > 0 && meses > 0
        ? invMensal * ((Math.pow(1 + cdiMensalProj, meses) - 1) / cdiMensalProj) : 0;
      let patConsorcio = 0;
      if (meses >= mes50 && mes50 > 0) patConsorcio = valorBem * Math.pow(1 + VALORIZACAO_IMOVEL, a);
      if (sobraConsorcio > 0 && meses > 0) {
        patConsorcio += sobraConsorcio * ((Math.pow(1 + cdiMensalProj, meses) - 1) / cdiMensalProj);
      }
      pontos.push({
        ano: a,
        'Com consórcio': Math.round(patConsorcio),
        'Continuar no aluguel': Math.round(patAluguel),
      });
    }
    return pontos;
  }, [prazo, mes50, parcelaAtual, aluguelAtual, invMensal, valorBem, cdiMensalProj, objetivo, sobraConsorcio]);

  const patFimAluguel = dadosEvolucao[dadosEvolucao.length - 1]?.['Continuar no aluguel'] || 0;
  const patFimConsorcio = dadosEvolucao[dadosEvolucao.length - 1]?.['Com consórcio'] || 0;
  const diferencaPat = patFimConsorcio - patFimAluguel;

  const dadosEvolucaoRenda = useMemo(() => {
    if (prazo <= 0 || objetivo !== 'renda') return [];
    const anos = Math.ceil(prazo / 12);
    const pontos = [];
    for (let a = 0; a <= anos; a++) {
      const meses = Math.min(a * 12, prazo);
      let valorImovel = 0, rendaAcumulada = 0, invProprio = 0;
      if (meses >= mes50) {
        valorImovel = valorBem * Math.pow(1 + VALORIZACAO_IMOVEL, a);
        const mesesAlugando = meses - mes50;
        rendaAcumulada = mesesAlugando > 0 ? aluguelEsperado * ((Math.pow(1 + cdiMensalProj, mesesAlugando) - 1) / cdiMensalProj) : 0;
      }
      if (invMensalRenda > 0 && meses > 0) {
        invProprio = invMensalRenda * ((Math.pow(1 + cdiMensalProj, meses) - 1) / cdiMensalProj);
      }
      pontos.push({
        ano: a,
        'Valor do imóvel': Math.round(valorImovel),
        'Aluguéis investidos': Math.round(rendaAcumulada),
        'Investimento próprio': Math.round(invProprio),
      });
    }
    return pontos;
  }, [prazo, mes50, aluguelEsperado, valorBem, cdiMensalProj, objetivo, invMensalRenda]);

  const yieldAluguel = aluguelEsperado > 0 && parcelaAtual > 0 ? (aluguelEsperado / parcelaAtual) * 100 : 0;
  const faturamentoRestante = faturamentoEsperado - parcelaAtual;

  const handleLeadSubmit = () => { if (leadNome && leadTel) setLeadEnviado(true); };
  const reset = () => { setStep(0); setTipoBem(null); setObjetivo(null); setLeadEnviado(false); setLeadNome(''); setLeadTel(''); };

  const toggleStyle = (active) => ({ backgroundColor: active ? C.navy : '#cbd5e1', transition: 'background-color 0.2s' });
  const toggleHandleStyle = (active) => ({ transform: active ? 'translateX(20px)' : 'translateX(2px)', transition: 'transform 0.2s' });
  const btnChip = (active) => ({
    backgroundColor: active ? C.navy : '#f1f5f9',
    color: active ? '#ffffff' : '#475569',
    transition: 'all 0.15s',
  });

  // ===== STEP 0 =====
  if (step === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#ffffff', color: C.dark }}>
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-20">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6"
              style={{ backgroundColor: C.blueBgSoft, color: C.navy, border: `1px solid ${C.blueBg}` }}>
              <Sparkles className="w-3.5 h-3.5" />
              Simulador de Consórcio
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-[1.1]">
              Conquiste seu bem <span style={{ color: C.navy }}>sem pagar juros</span>.
            </h1>
            <p className="text-base md:text-lg max-w-2xl mx-auto" style={{ color: C.textDim }}>
              Simule em segundos, compare com financiamento e descubra o caminho mais inteligente para o seu próximo bem.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {Object.entries(TIPOS_BEM).map(([key, val]) => (
              <TipoBemCard key={key} tipoKey={key} info={val} onClick={() => {
                setTipoBem(key);
                if (val.objetivos.length === 1) {
                  setObjetivo(val.objetivos[0].id);
                  setStep(2);
                } else {
                  setStep(1);
                }
              }} />
            ))}
          </div>

          <div className="rounded-2xl p-6 md:p-8" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
            <div className="text-xs uppercase tracking-wider mb-4 text-center font-semibold" style={{ color: C.textDim }}>
              Trabalhamos com todas as principais administradoras
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {ADMS.map(a => <AdmLogo key={a.nome} adm={a} />)}
            </div>
            <div className="text-center text-xs mt-4" style={{ color: C.textDim }}>
              Sem preferência comercial — comparamos e indicamos a melhor opção pro seu perfil.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== STEP 1 =====
  if (step === 1) {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: '#ffffff', color: C.dark }}>
        <div className="max-w-3xl mx-auto py-8">
          <button onClick={() => setStep(0)} className="inline-flex items-center gap-2 mb-8 text-sm" style={{ color: C.textDim }}>
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="mb-8">
            <div className="text-xs font-semibold mb-2" style={{ color: C.textDim }}>PASSO 2 DE 3</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Qual é o seu <span style={{ color: C.navy }}>objetivo</span>?
            </h2>
            <p style={{ color: C.textDim }}>Isso direciona a análise que vamos fazer pra você.</p>
          </div>
          <div className="space-y-3">
            {info.objetivos.map(o => {
              const Ico = ICONS[o.iconeKey];
              return (
                <button key={o.id} onClick={() => { setObjetivo(o.id); setStep(2); }}
                  className="group w-full rounded-2xl p-5 transition-all text-left flex items-center gap-4"
                  style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.boxShadow = '0 4px 12px -4px rgba(30,58,138,0.18)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: C.blueBgSoft }}>
                    <Ico className="w-6 h-6" strokeWidth={2} style={{ color: C.navy }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-semibold mb-0.5">{o.nome}</div>
                    <div className="text-sm" style={{ color: C.textDim }}>{o.desc}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-all" style={{ color: C.textMore }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ===== STEP 2 =====
  const objAtual = info.objetivos.find(o => o.id === objetivo);
  const TipoIcone = ICONS[info.iconeKey];
  const objImovel = ['sair-aluguel', 'trocar', 'renda'].includes(objetivo);
  const isTrocaVeiculo = ['trocar-carro', 'trocar-moto'].includes(objetivo);
  const isAdquirirVeiculo = ['adquirir-carro', 'adquirir-moto'].includes(objetivo);
  const objPesadoSel = objetivo === 'pesado';
  const isWorkObj = false;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9', color: C.dark }}>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 text-sm" style={{ color: C.textDim }}>
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <button onClick={reset} className="text-sm" style={{ color: C.textDim }}>Recomeçar</button>
        </div>

        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3"
            style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}`, color: '#475569' }}>
            <TipoIcone className="w-3 h-3" />
            {info.label} • {objAtual?.nome}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Monte sua simulação</h1>
          <p className="mt-1" style={{ color: C.textDim }}>Use os controles ou digite os valores diretamente. Atualiza em tempo real.</p>
        </div>

        {/* INPUTS */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-sm font-medium" style={{ color: '#334155' }}>Valor do bem</label>
                <NumField value={valorBem} onChange={setValorBem} min={info.minValor} max={info.maxValor} prefix="R$" width="w-32" />
              </div>
              <input type="range" min={info.minValor} max={info.maxValor} step={info.stepValor} value={valorBem}
                onChange={(e) => setValorBem(+e.target.value)} className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
              <div className="flex justify-between text-[11px] mt-1" style={{ color: C.textMore }}>
                <span>{fmt(info.minValor)}</span><span>{fmt(info.maxValor)}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-sm font-medium" style={{ color: '#334155' }}>Prazo</label>
                <NumField value={prazo} onChange={setPrazo} min={12} max={info.prazos[info.prazos.length - 1]} suffix="meses" width="w-16" />
              </div>
              <div className="flex gap-1.5">
                {info.prazos.map(p => (
                  <button key={p} onClick={() => setPrazo(p)} style={btnChip(prazo === p)}
                    className="flex-1 py-2 rounded-lg text-xs md:text-sm font-medium">{p}</button>
                ))}
              </div>
              <div className="text-[11px] mt-1" style={{ color: C.textMore }}>{(prazo / 12).toFixed(1)} anos</div>
            </div>

            {objetivo === 'sair-aluguel' && (
              <>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium" style={{ color: '#334155' }}>Aluguel que você paga hoje</label>
                    <NumField value={aluguelAtual} onChange={setAluguelAtual} min={0} max={50000} prefix="R$" suffix="/mês" width="w-24" size="text-lg" />
                  </div>
                  <input type="range" min={0} max={15000} step={50} value={Math.min(aluguelAtual, 15000)}
                    onChange={(e) => setAluguelAtual(+e.target.value)} className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium" style={{ color: '#334155' }}>Investimento mensal disponível</label>
                    <NumField value={invMensal} onChange={setInvMensal} min={0} max={100000} prefix="R$" suffix="/mês" width="w-24" size="text-lg" />
                  </div>
                  <input type="range" min={0} max={10000} step={50} value={Math.min(invMensal, 10000)}
                    onChange={(e) => setInvMensal(+e.target.value)} className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                  <div className="text-[11px] mt-1" style={{ color: C.textMore }}>Quanto você consegue poupar/investir além do aluguel</div>
                </div>
              </>
            )}
            {objetivo === 'renda' && (
              <>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium" style={{ color: '#334155' }}>Aluguel esperado do imóvel</label>
                    <NumField value={aluguelEsperado} onChange={setAluguelEsperado} min={0} max={50000} prefix="R$" suffix="/mês" width="w-24" size="text-lg" />
                  </div>
                  <input type="range" min={0} max={20000} step={50} value={Math.min(aluguelEsperado, 20000)}
                    onChange={(e) => setAluguelEsperado(+e.target.value)} className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium" style={{ color: '#334155' }}>Investimento mensal disponível</label>
                    <NumField value={invMensalRenda} onChange={setInvMensalRenda} min={0} max={100000} prefix="R$" suffix="/mês" width="w-24" size="text-lg" />
                  </div>
                  <input type="range" min={0} max={15000} step={50} value={Math.min(invMensalRenda, 15000)}
                    onChange={(e) => setInvMensalRenda(+e.target.value)} className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                </div>
              </>
            )}
            {(objetivo === 'trocar-carro' || objetivo === 'trocar-moto') && (
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-medium" style={{ color: '#334155' }}>Valor do {isCarro ? 'carro' : 'moto'} atual (FIPE)</label>
                  <NumField value={valorBemAtual} onChange={(v) => {
                    setValorBemAtual(v);
                    if (v > 0) { setLanceProprioAtivo(true); setValorLance(v); }
                  }} min={0} max={Math.round(valorBem * 0.8)} prefix="R$" width="w-28" size="text-lg" />
                </div>
                <input type="range" min={0} max={Math.round(valorBem * 0.8)} step={isMoto ? 500 : 1000}
                  value={Math.min(valorBemAtual, Math.round(valorBem * 0.8))}
                  onChange={(e) => {
                    const v = +e.target.value;
                    setValorBemAtual(v);
                    if (v > 0) { setLanceProprioAtivo(true); setValorLance(v); }
                  }}
                  className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                <div className="text-[11px] mt-1" style={{ color: C.textMore }}>
                  Esse valor é usado automaticamente como lance — acelera muito a contemplação
                </div>
              </div>
            )}
          </div>

          {/* LANCE */}
          <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="mb-4">
              <div className="text-sm font-semibold" style={{ color: C.dark }}>Lance</div>
              <div className="text-xs" style={{ color: C.textDim }}>Ative um ou ambos — somam pra acelerar a contemplação</div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-xl p-4 transition-all" style={{
                backgroundColor: lanceProprioAtivo ? C.blueBgSoft : '#f8fafc',
                border: lanceProprioAtivo ? `1px solid ${C.navy}` : `1px solid ${C.border}`,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.dark }}>Recursos próprios</div>
                    <div className="text-[11px]" style={{ color: C.textDim }}>Dinheiro que você tem pra lance</div>
                  </div>
                  <button onClick={() => setLanceProprioAtivo(!lanceProprioAtivo)}
                    className="relative w-11 h-6 rounded-full shrink-0" style={toggleStyle(lanceProprioAtivo)}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full" style={toggleHandleStyle(lanceProprioAtivo)} />
                  </button>
                </div>
                {lanceProprioAtivo && (
                  <div className="mt-3">
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs" style={{ color: '#475569' }}>Valor total</label>
                      <NumField value={valorLance} onChange={setValorLance} min={0} max={Math.round(valorBem * 0.6)} prefix="R$" width="w-24" size="text-base" />
                    </div>
                    <input type="range" min={0} max={Math.round(valorBem * 0.6)} step={1000}
                      value={Math.min(valorLance, Math.round(valorBem * 0.6))} onChange={(e) => setValorLance(+e.target.value)}
                      className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                    <div className="text-[11px] mt-1.5" style={{ color: C.textDim }}>
                      {valorBem > 0 ? ((valorLance / valorBem) * 100).toFixed(1) : 0}% da carta • lance médio vencedor: ~{(isCarro || isMoto) ? 40 : 30}%
                    </div>
                    {numCartas > 1 && (
                      <div className="text-[10px] mt-1.5 px-2 py-1 rounded" style={{ backgroundColor: '#fff', color: C.textDim }}>
                        Em {numCartas} cartas: {fmt(lanceProprioPorCarta)} por carta
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl p-4 transition-all" style={{
                backgroundColor: lanceEmbutidoAtivo ? C.blueBgSoft : '#f8fafc',
                border: lanceEmbutidoAtivo ? `1px solid ${C.navy}` : `1px solid ${C.border}`,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.dark }}>Lance embutido</div>
                    <div className="text-[11px]" style={{ color: C.textDim }}>Desconta da carta, sem usar dinheiro</div>
                  </div>
                  <button onClick={() => setLanceEmbutidoAtivo(!lanceEmbutidoAtivo)}
                    className="relative w-11 h-6 rounded-full shrink-0" style={toggleStyle(lanceEmbutidoAtivo)}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full" style={toggleHandleStyle(lanceEmbutidoAtivo)} />
                  </button>
                </div>
                {lanceEmbutidoAtivo && (
                  <div className="mt-3">
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs" style={{ color: '#475569' }}>Percentual</label>
                      <NumField value={embutidoPerc} onChange={setEmbutidoPerc} min={1} max={30} suffix="%" width="w-14" size="text-base" />
                    </div>
                    <input type="range" min={1} max={30} step={1} value={embutidoPerc}
                      onChange={(e) => setEmbutidoPerc(+e.target.value)} className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                    <div className="mt-2 flex items-start gap-1.5 text-[11px]" style={{ color: C.orangeDark }}>
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Crédito líquido: <strong>{fmt(creditoLiquido)}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {temLance && (
              <div className="mt-3 px-4 py-2.5 rounded-lg text-sm"
                style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}`, color: '#334155' }}>
                Lance total ativo: <strong style={{ color: C.navy }}>{fmt(valorLanceTotal)}</strong>
                {numCartas > 1 && <span style={{ color: C.textDim }}> ({fmt(lanceTotalPorCarta)} por carta)</span>}
              </div>
            )}
          </div>

          {/* CORREÇÃO + REDUTOR */}
          <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="mb-3">
              <div className="text-sm font-semibold" style={{ color: C.dark }}>Índice de correção anual</div>
              <div className="text-xs" style={{ color: C.textDim }}>Ajusta carta e parcela todo ano</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                { id: 'media', label: 'Média IPCA/INCC', taxa: '~5,75%' },
                { id: 'pre3', label: 'Pré 3%', taxa: 'fixo' },
              ].map(i => (
                <button key={i.id} onClick={() => setIndiceCorrecao(i.id)} style={btnChip(indiceCorrecao === i.id)}
                  className="py-2.5 px-3 rounded-lg text-xs font-medium flex flex-col items-center">
                  <span className="font-bold text-sm">{i.label}</span>
                  <span className="text-[10px] opacity-80">{i.taxa}</span>
                </button>
              ))}
            </div>

            <div>
              <div className="text-sm font-semibold mb-2" style={{ color: C.dark }}>Redutor de parcela</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'nenhum', label: 'Sem redutor' },
                  { id: '25', label: 'Redutor 25%' },
                  { id: '50', label: 'Redutor 50%' },
                ].map(r => (
                  <button key={r.id} onClick={() => setRedutor(r.id)} style={btnChip(redutor === r.id)}
                    className="py-2.5 px-2 rounded-lg text-xs md:text-sm font-medium">{r.label}</button>
                ))}
              </div>
              <div className="text-[11px] mt-2" style={{ color: C.textDim }}>
                Reduz parcela até a contemplação. Sem lance, parcela volta a subir depois.
              </div>
            </div>
          </div>

          {/* AUMENTAR CHANCES */}
          <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2" style={{ color: C.dark }}>
                  <Layers className="w-4 h-4" style={{ color: C.navy }} />
                  Quero aumentar as chances de contemplação
                </div>
                <div className="text-xs mt-0.5" style={{ color: C.textDim }}>
                  Divide sua carta em cotas menores — aumenta a chance de contemplar ao menos uma cedo
                </div>
              </div>
              <button onClick={() => setAumentarChances(!aumentarChances)}
                className="relative w-11 h-6 rounded-full shrink-0" style={toggleStyle(aumentarChances)}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full" style={toggleHandleStyle(aumentarChances)} />
              </button>
            </div>

            {aumentarChances && (
              <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                <div className="text-xs mb-3" style={{ color: '#475569' }}>
                  {numCartas} cartas de <strong>{fmt(valorPorCarta)}</strong> cada (soma: {fmt(valorBem)})
                  {temLance && <span> • lance de {fmt(lanceTotalPorCarta)} por carta</span>}
                </div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-xs" style={{ color: '#475569' }}>Número de cartas</label>
                  <div className="text-base font-bold tabular-nums" style={{ color: C.navy }}>{numCartas}</div>
                </div>
                <input type="range" min={2} max={5} step={1} value={numCartas}
                  onChange={(e) => setNumCartas(+e.target.value)} className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                <div className="flex justify-between text-[10px] mt-0.5" style={{ color: C.textMore }}>
                  <span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
              </div>
            )}
          </div>

          {/* AVANÇADO */}
          <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
              <Settings className="w-4 h-4" />
              Ajustar taxa da administradora
            </button>
            {showAdvanced && (
              <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-medium" style={{ color: '#334155' }}>Taxa de administração total</label>
                  <div className="text-lg font-bold tabular-nums" style={{ color: C.navy }}>{(taxaAdm * 100).toFixed(1)}%</div>
                </div>
                <input type="range" min={0.18} max={0.25} step={0.005} value={taxaAdm}
                  onChange={(e) => setTaxaAdmCustom(+e.target.value)} className="w-full cursor-pointer" style={{ accentColor: C.navy }} />
                <div className="text-[11px] mt-1.5" style={{ color: C.textDim }}>Varia de 18% a 25% conforme administradora</div>
              </div>
            )}
          </div>
        </div>

        {/* HERO */}
        <div className="rounded-2xl p-6 md:p-8 mb-5 relative overflow-hidden" style={{
          backgroundColor: '#ffffff',
          border: `1px solid ${C.border}`,
          borderLeft: `6px solid ${C.orange}`,
        }}>
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none"
            style={{ backgroundColor: 'rgba(255,87,19,0.06)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.textDim }}>
                {temRedutor ? `Parcela inicial (com redutor ${redutor}%)` : 'Sua parcela mensal'}
              </div>
              {temRedutor && (
                <div className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: C.blueBg, color: C.navy }}>-{redutor}%</div>
              )}
              {numCartas > 1 && (
                <div className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: C.blueBg, color: C.navy }}>{numCartas}× cartas</div>
              )}
            </div>
            <div className="text-5xl md:text-6xl font-bold tabular-nums mb-2 leading-none" style={{ color: C.orange }}>
              {numCartas > 1 ? `${numCartas}× ${fmtCents(parcelaAtual / numCartas)}` : fmtCents(parcelaAtual)}
            </div>
            <div className="text-sm mb-6 flex items-center gap-1.5" style={{ color: C.textDim }}>
              <Info className="w-3 h-3" />
              Corrigida anualmente pelo {nomeIndice}
              {numCartas > 1 && ` • Soma: ${fmtCents(parcelaAtual)}/mês`}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs" style={{ color: C.textDim }}>Carta de crédito</div>
                <div className="text-lg font-semibold tabular-nums" style={{ color: C.dark }}>
                  {numCartas > 1 ? `${numCartas}× ${fmt(valorPorCarta)}` : fmt(valorBem)}
                </div>
              </div>
              {lanceEmbutidoAtivo ? (
                <div>
                  <div className="text-xs" style={{ color: C.textDim }}>Você recebe</div>
                  <div className="text-lg font-semibold tabular-nums" style={{ color: C.orange }}>{fmt(creditoLiquido)}</div>
                </div>
              ) : (
                <div>
                  <div className="text-xs" style={{ color: C.textDim }}>Prazo</div>
                  <div className="text-lg font-semibold tabular-nums" style={{ color: C.dark }}>{prazo} meses</div>
                </div>
              )}
              <div>
                <div className="text-xs" style={{ color: C.textDim }}>Taxa adm + FR</div>
                <div className="text-lg font-semibold tabular-nums" style={{ color: C.dark }}>{((taxaAdm + fundoReserva) * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* PÓS-CONTEMPLAÇÃO */}
        {mostrarParcelaPos && (
          <div className="rounded-2xl p-5 md:p-6 mb-5" style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${parcelaPosAumentou ? '#fed7aa' : '#bfdbfe'}`,
          }}>
            <div className="flex items-center gap-2 mb-1">
              {parcelaPosAumentou ? <TrendingUp className="w-4 h-4" style={{ color: C.orange }} /> : <TrendingDown className="w-4 h-4" style={{ color: C.navy }} />}
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                {parcelaPosAumentou ? 'Atenção: parcela sobe' : 'Efeito do lance'}
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Parcela após a contemplação</h3>
            <p className="text-sm mb-5" style={{ color: '#475569' }}>
              Considerando contemplação no mês {mes50}: saldo restante ({fmt(saldoAposContemplacao)}) ÷ {mesesRestantes} meses.
              {parcelaPosAumentou && temRedutor && !temLance && ' Você pagou menos com o redutor — o saldo restante eleva a parcela depois.'}
              {parcelaPosDiminuiu && temLance && ' Você antecipou parte do custo com o lance — por isso a parcela fica menor.'}
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f1f5f9' }}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>Antes da contemplação</div>
                <div className="text-xl md:text-2xl font-bold tabular-nums mb-0.5" style={{ color: C.dark }}>{fmtCents(parcelaAtual)}</div>
                <div className="text-[11px]" style={{ color: C.textDim }}>Por {mes50} meses</div>
              </div>
              <div className="rounded-xl p-4" style={{
                backgroundColor: parcelaPosAumentou ? C.orangeBgSoft : C.blueBgSoft,
                border: `1px solid ${parcelaPosAumentou ? '#fed7aa' : '#bfdbfe'}`,
              }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 font-semibold"
                  style={{ color: parcelaPosAumentou ? C.orange : C.navy }}>Depois da contemplação</div>
                <div className="text-xl md:text-2xl font-bold tabular-nums mb-0.5"
                  style={{ color: parcelaPosAumentou ? C.orange : C.navy }}>{fmtCents(parcelaPosContemplacao)}</div>
                <div className="text-[11px]" style={{ color: C.textDim }}>Por {mesesRestantes} meses restantes</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: parcelaPosAumentou ? C.orangeBg : C.blueBgSoft }}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>
                  {parcelaPosAumentou ? 'Acréscimo mensal' : 'Redução da parcela'}
                </div>
                <div className="text-xl md:text-2xl font-bold tabular-nums mb-0.5"
                  style={{ color: parcelaPosAumentou ? C.orange : C.navy }}>
                  {diferencaPos > 0 ? '+' : ''}{fmtCents(diferencaPos)}
                </div>
                <div className="text-[11px]" style={{ color: C.textDim }}>
                  {parcelaAtual > 0 ? `${((Math.abs(diferencaPos) / parcelaAtual) * 100).toFixed(0)}%` : ''} {parcelaPosAumentou ? 'a mais' : 'a menos'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROBABILIDADE */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4" style={{ color: C.navy }} />
            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Contemplação</div>
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Quando você deve ser contemplado</h3>
          <p className="text-sm mb-5" style={{ color: '#475569' }}>
            Todo cotista é contemplado até o fim do prazo. O que muda é <strong style={{ color: C.dark }}>quando</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Mês da virada (50%)', valor: `${mes50}º`, sub: `≈ ${(mes50 / 12).toFixed(1)} anos` },
              { label: 'Chance em 12 meses', valor: `${prob12.toFixed(0)}%`, sub: 'Primeiro ano' },
              { label: 'Chance em 36 meses', valor: `${prob36.toFixed(0)}%`, sub: 'Primeiros 3 anos' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-4" style={{ backgroundColor: '#f1f5f9' }}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>{c.label}</div>
                <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: C.navy }}>{c.valor}</div>
                <div className="text-[11px] mt-0.5" style={{ color: C.textDim }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <ChartLegend items={[
            { color: C.navy, label: numCartas > 1 ? 'Ao menos 1 carta contemplada' : 'Probabilidade acumulada' },
            ...(numCartas > 1 ? [{ color: C.textMore, label: 'Por carta individual' }] : []),
          ]} />

          <div className="rounded-xl p-3 md:p-4 h-64 md:h-72" style={{ backgroundColor: '#f8fafc' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosProbabilidade} margin={{ top: 25, right: 15, left: 0, bottom: 30 }}>
                <defs>
                  <linearGradient id="colorMult" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.navy} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={C.navy} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.textMore} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.textMore} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }}
                  label={{ value: 'Mês', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px' }}
                  formatter={(v, name) => [`${v}%`, name === 'individual' ? (numCartas > 1 ? 'Por carta' : 'Probabilidade') : 'Ao menos 1 carta']}
                  labelFormatter={(v) => `Mês ${v}`} />
                {numCartas > 1 && <Area type="monotone" dataKey="individual" stroke={C.textMore} strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorInd)" />}
                <Area type="monotone" dataKey={numCartas > 1 ? 'multiplas' : 'individual'} stroke={C.navy} strokeWidth={2.5} fillOpacity={1} fill="url(#colorMult)" />
                {mes50 > 0 && mes50 < prazo && <ReferenceLine x={mes50} stroke={C.navy} strokeDasharray="3 3" label={{ value: `50% • mês ${mes50}`, fill: C.navy, fontSize: 11, position: 'insideTopRight', offset: 8 }} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {numCartas > 1 && (
            <div className="mt-3 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
              <Layers className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.navy }} />
              <div className="text-sm" style={{ color: '#334155' }}>
                Com <strong>{numCartas} cartas</strong>, chance de contemplar ao menos uma em 12 meses sobe pra <strong style={{ color: C.navy }}>{prob12.toFixed(0)}%</strong> (vs. {probIndividual12.toFixed(0)}% com carta única).
              </div>
            </div>
          )}
        </div>

        {/* COMPARATIVO */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4" style={{ color: C.orange }} />
            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Comparativo</div>
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Consórcio vs. Financiamento</h3>
          <p className="text-sm mb-4" style={{ color: '#475569' }}>
            Comparação no <strong>mesmo prazo de {prazoFinanComparado} meses</strong>. Financiamento exige entrada de 20% ({fmt(entradaFinan)}) e tem taxa de {(taxaFinanAnual * 100).toFixed(1)}% a.a.
            {prazoExcedeFinan && <span style={{ color: C.orange }}> Seu prazo de consórcio excede o máximo permitido em financiamento ({prazoMaxFinan}m), então comparamos no teto.</span>}
          </p>

          {/* Callout entrada */}
          <div className="rounded-xl p-4 mb-4 flex items-start gap-3"
            style={{ backgroundColor: C.orangeBgSoft, border: '1px solid #fed7aa' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,87,19,0.15)' }}>
              <AlertCircle className="w-4 h-4" style={{ color: C.orange }} />
            </div>
            <div className="text-sm" style={{ color: '#1e293b' }}>
              <strong style={{ color: C.orange }}>Pra financiar, você desembolsa {fmt(entradaFinan)} agora.</strong> Esse mesmo valor pode ser usado como <strong>lance no consórcio</strong>, antecipando muito sua contemplação.
            </div>
          </div>

          <div className="rounded-xl p-5 mb-4" style={{
            background: `linear-gradient(135deg, ${C.blueBgSoft} 0%, ${C.blueBg} 100%)`,
            border: `1px solid ${C.navy}30`,
          }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.navy }} />
                  <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>SEU CONSÓRCIO</div>
                </div>
                <div className="text-xs mb-2" style={{ color: '#475569' }}>
                  {prazo} meses • Taxa adm {(taxaAdm * 100).toFixed(1)}% • {nomeIndice} • <span className="font-semibold" style={{ color: C.navy }}>Sem juros</span>
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-[11px]" style={{ color: C.textDim }}>Parcela</div>
                  <div className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: C.dark }}>{fmtCents(parcelaAtual)}</div>
                </div>
                <div>
                  <div className="text-[11px]" style={{ color: C.textDim }}>Custo total</div>
                  <div className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: C.dark }}>{fmt(custoTotalConsorcio)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {cenariosFinan.map((c, i) => (
              <div key={i} className="rounded-xl p-5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.textMore }} />
                  <div className="text-xs font-bold tracking-wider" style={{ color: C.textDim }}>FINANCIAMENTO {c.tipo.toUpperCase()} • {c.prazoM}m</div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-[10px]" style={{ color: C.textDim }}>Parcela{c.tipo === 'SAC' ? ' inicial' : ''}</div>
                    <div className="text-lg font-bold tabular-nums" style={{ color: '#334155' }}>
                      {fmtCents(c.tipo === 'Price' ? c.parcela : c.parcInicial)}
                    </div>
                    {c.tipo === 'SAC' && <div className="text-[10px]" style={{ color: C.textDim }}>→ {fmtCents(c.parcFinal)} fim</div>}
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: C.textDim }}>Custo total</div>
                    <div className="text-lg font-bold tabular-nums" style={{ color: '#334155' }}>{fmt(c.total)}</div>
                  </div>
                </div>
                <div className="text-[11px] pt-2" style={{ color: C.textDim, borderTop: `1px solid ${C.border}` }}>
                  Inclui entrada de {fmt(entradaFinan)} + parcelas
                </div>
              </div>
            ))}
          </div>

          {economiaVsMelhor > 0 && (
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ backgroundColor: C.orangeBg, border: '1px solid #fed7aa' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(255,87,19,0.15)' }}>
                <TrendingUp className="w-5 h-5" style={{ color: C.orange }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: '#475569' }}>
                  Economia vs. {melhorFinan.tipo} {melhorFinan.prazoM}m (mais barato dos 2)
                </div>
                <div className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: C.orange }}>{fmt(economiaVsMelhor)}</div>
              </div>
            </div>
          )}
        </div>

        {/* EVOLUÇÃO PATRIMONIAL */}
        {objetivo === 'sair-aluguel' && dadosEvolucao.length > 0 && (
          <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Evolução patrimonial</div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Consórcio vs. Continuar no aluguel</h3>
            <p className="text-sm mb-4" style={{ color: '#475569' }}>
              Mesmo orçamento mensal ({fmt(orcamentoTotal)}: {fmt(aluguelAtual)} aluguel + {fmt(invMensal)} investimento).
              {sobraConsorcio > 0 && ` No consórcio, sobra ${fmt(sobraConsorcio)}/mês pra investir.`}
              {orcamentoInsuficiente && <span style={{ color: C.orange, fontWeight: 500 }}> A parcela ({fmt(parcelaAtual)}) excede seu orçamento.</span>}
            </p>

            <ChartLegend items={[
              { color: C.navy, label: 'Com consórcio' },
              { color: C.textMore, label: 'Continuar no aluguel' },
            ]} />

            <div className="rounded-xl p-3 md:p-4 h-72 md:h-80 mb-3" style={{ backgroundColor: '#f8fafc' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="ano" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }}
                    label={{ value: 'Anos', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px' }}
                    formatter={(v) => fmt(v)} labelFormatter={(v) => `Ano ${v}`} />
                  <Bar dataKey="Com consórcio" fill={C.navy} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Continuar no aluguel" fill={C.textMore} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid md:grid-cols-3 gap-2.5">
              <div className="rounded-xl p-4" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 font-semibold" style={{ color: C.navy }}>Patrimônio — Consórcio</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.navy }}>{fmt(patFimConsorcio)}</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f1f5f9', border: `1px solid ${C.border}` }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 font-semibold" style={{ color: '#475569' }}>Patrimônio — Aluguel</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: '#334155' }}>{fmt(patFimAluguel)}</div>
              </div>
              <div className="rounded-xl p-4" style={{
                backgroundColor: diferencaPat > 0 ? C.orangeBg : '#f1f5f9',
                border: `1px solid ${diferencaPat > 0 ? '#fed7aa' : C.border}`,
              }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 font-semibold" style={{ color: '#475569' }}>Diferença</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: diferencaPat > 0 ? C.orange : '#334155' }}>
                  {diferencaPat > 0 ? '+' : ''}{fmt(diferencaPat)}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Valorização do imóvel <strong>5% a.a.</strong> (conservadora — oscila por região). CDI <strong>10% a.a.</strong> (média histórica). Brutos de IR.</span>
            </div>
          </div>
        )}

        {/* EVOLUÇÃO RENDA */}
        {objetivo === 'renda' && dadosEvolucaoRenda.length > 0 && (
          <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Construção de patrimônio</div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Seu patrimônio ao longo do tempo</h3>

            <ChartLegend items={[
              { color: C.navy, label: 'Valor do imóvel' },
              { color: C.orange, label: 'Aluguéis investidos' },
              ...(invMensalRenda > 0 ? [{ color: C.textMore, label: 'Investimento próprio' }] : []),
            ]} />

            <div className="rounded-xl p-3 md:p-4 h-72 md:h-80" style={{ backgroundColor: '#f8fafc' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosEvolucaoRenda} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="ano" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }}
                    label={{ value: 'Anos', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px' }}
                    formatter={(v) => fmt(v)} labelFormatter={(v) => `Ano ${v}`} />
                  <Bar dataKey="Valor do imóvel" stackId="a" fill={C.navy} />
                  <Bar dataKey="Aluguéis investidos" stackId="a" fill={C.orange} />
                  {invMensalRenda > 0 && <Bar dataKey="Investimento próprio" stackId="a" fill={C.textMore} radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid md:grid-cols-3 gap-2.5">
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f1f5f9' }}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>Cobertura aluguel</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: yieldAluguel >= 100 ? C.navy : C.orange }}>{yieldAluguel.toFixed(0)}%</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f1f5f9' }}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>Contemplação</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.dark }}>Mês {mes50}</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 font-semibold" style={{ color: C.navy }}>Patrimônio ao fim</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.navy }}>
                  {fmt((dadosEvolucaoRenda[dadosEvolucaoRenda.length - 1]?.['Valor do imóvel'] || 0) + (dadosEvolucaoRenda[dadosEvolucaoRenda.length - 1]?.['Aluguéis investidos'] || 0) + (dadosEvolucaoRenda[dadosEvolucaoRenda.length - 1]?.['Investimento próprio'] || 0))}
                </div>
              </div>
            </div>
          </div>
        )}

        {isWorkObj && (
          <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Viabilidade como trabalho</div>
            </div>
            <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>Quanto sobra depois da parcela</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f1f5f9' }}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>Faturamento bruto</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.dark }}>{fmt(faturamentoEsperado)}</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f1f5f9' }}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>Parcela do consórcio</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.orange }}>- {fmt(parcelaAtual)}</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f1f5f9' }}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textDim }}>Sobra</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: faturamentoRestante > 0 ? C.navy : '#ef4444' }}>{fmt(faturamentoRestante)}</div>
                <div className="text-[11px] mt-0.5" style={{ color: C.textDim }}>Antes de combustível e manutenção</div>
              </div>
            </div>
          </div>
        )}

        {objetivo === 'trocar' && (
          <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Por que consórcio é eficiente pra upgrade</h3>
            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
              Após contemplado, você pode usar o imóvel atual como parte do pagamento (dação) ou vendê-lo, evitando juros altos de financiamento num momento em que já tem patrimônio.
            </p>
          </div>
        )}

        {objetivo === 'primeiro-trocar' && !isMoto && (
          <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Por que consórcio pra carro faz sentido</h3>
            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
              Com taxas de financiamento de veículo acima de 25% a.a., o consórcio é dramaticamente mais barato no custo total. Lance acelera muito a conquista se você já tem recursos guardados.
            </p>
          </div>
        )}

        {objetivo === 'primeiro-trocar' && isMoto && (
          <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Por que consórcio pra moto vale a pena</h3>
            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
              Financiamento de moto chega a 28% a.a. — uma moto de R$ 25k vira R$ 50k+ no fim. Consórcio elimina os juros, e o lance acelera muito porque o ticket baixo facilita lances competitivos.
            </p>
          </div>
        )}

        {/* LEAD */}
        <div className="rounded-2xl p-6 md:p-8 mb-5" style={{ backgroundColor: C.orange, color: '#ffffff' }}>
          {leadEnviado ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <Check className="w-7 h-7" strokeWidth={3} style={{ color: '#ffffff' }} />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#ffffff' }}>Recebido, {leadNome.split(' ')[0]}!</h3>
              <p className="max-w-lg mx-auto text-sm md:text-base" style={{ color: 'rgba(255,255,255,0.95)' }}>
                Em breve você recebe no WhatsApp as melhores cotações das administradoras.
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-2xl md:text-3xl font-bold mb-2 leading-tight" style={{ color: '#ffffff' }}>
                Quer essa simulação com cotações reais?
              </h3>
              <p className="mb-5 text-sm md:text-base" style={{ color: 'rgba(255,255,255,0.95)' }}>
                Comparamos as administradoras que mais combinam com seu perfil — sem preferência comercial.
              </p>
              <div className="grid md:grid-cols-2 gap-2.5 mb-2.5">
                <input type="text" placeholder="Seu nome" value={leadNome} onChange={(e) => setLeadNome(e.target.value)}
                  style={{ backgroundColor: '#ffffff', color: C.dark, border: 'none' }}
                  className="rounded-lg px-4 py-3 focus:outline-none placeholder:text-slate-400" />
                <input type="tel" placeholder="WhatsApp (DDD + número)" value={leadTel} onChange={(e) => setLeadTel(e.target.value)}
                  style={{ backgroundColor: '#ffffff', color: C.dark, border: 'none' }}
                  className="rounded-lg px-4 py-3 focus:outline-none placeholder:text-slate-400" />
              </div>
              <button onClick={handleLeadSubmit} disabled={!leadNome || !leadTel}
                style={{ backgroundColor: C.dark, color: '#ffffff' }}
                className="w-full font-bold py-3.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                Receber cotações <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-[11px] mt-3 text-center" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Sem compromisso. Seus dados são usados apenas pra enviar as cotações.
              </p>
            </>
          )}
        </div>

        <div className="text-center text-[11px] pb-8 px-4 leading-relaxed" style={{ color: C.textDim }}>
          Simulação meramente ilustrativa. Valores reais variam por administradora, grupo, correção e perfil. Consórcio não garante contemplação antecipada.
        </div>
      </div>
    </div>
  );
}
