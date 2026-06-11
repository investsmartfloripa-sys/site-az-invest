"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Target, Calendar, Briefcase, TrendingUp, Info, AlertCircle, Wallet, PiggyBank, Percent } from "lucide-react";
import { CATEGORIAS } from "@/data/simuladores";

// Categoria do simulador (accent visual — não altera nenhum cálculo)
const CAT = CATEGORIAS.aposentadoria;

// ===== Helpers =====
const fmt = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtCents = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
const fmtCompact = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return `${n.toFixed(0)}`;
};

// ===== Paleta =====
const C = {
  dark: '#0f172a',
  navy: '#1e3a8a',
  navyDeep: '#172554',
  blue: '#2563eb',
  blueBg: '#dbeafe',
  blueBgSoft: '#eff6ff',
  orange: '#FF5713',
  orangeDark: '#E04A0F',
  orangeBg: '#fff7ed',
  orangeBgSoft: '#fff3ed',
  red: '#dc2626',
  redBg: '#fef2f2',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  textDim: '#64748b',
  textMore: '#94a3b8',
};

// ===== Funções financeiras =====
// PMT necessário pra atingir VF dado VP, taxa mensal i e prazo n (meses).
// VF = PMT * ((1+i)^n - 1)/i + VP*(1+i)^n  →  PMT = (VF - VP*(1+i)^n) * i / ((1+i)^n - 1)
function calcAporte(VF, VP, i, n) {
  if (n <= 0) return 0;
  if (Math.abs(i) < 1e-10) return Math.max(0, (VF - VP) / n);
  const fator = Math.pow(1 + i, n);
  return ((VF - VP * fator) * i) / (fator - 1);
}

// Taxa mensal necessária (bissecção). Retorna null se impossível.
function calcTaxaMensal(VF, VP, PMT, n) {
  if (n <= 0) return null;
  const valorEm = (i) => {
    if (Math.abs(i) < 1e-10) return VP + PMT * n;
    const fator = Math.pow(1 + i, n);
    return (PMT * (fator - 1)) / i + VP * fator;
  };
  // Sem juros já passa da meta?
  if (VP + PMT * n >= VF) return 0;
  // Mesmo com 100% ao mês não passa? (sanity check)
  if (valorEm(1.0) < VF) return null;

  let lo = 0, hi = 1.0;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (valorEm(mid) < VF) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ===== Inputs numéricos com máscara BR =====
const NumField = ({ value, onChange, min, max, prefix, suffix, size = 'text-base' }) => (
  <div className="flex items-center gap-1">
    {prefix && <span className="text-sm shrink-0" style={{ color: C.textDim }}>{prefix}</span>}
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
      className={`${size} font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right w-full`}
      style={{ color: C.dark, borderColor: 'transparent' }}
      onFocusCapture={(e) => { e.target.style.borderColor = C.blue; e.target.style.backgroundColor = '#f8fafc'; }}
      onBlurCapture={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
    />
    {suffix && <span className="text-sm shrink-0" style={{ color: C.textDim }}>{suffix}</span>}
  </div>
);

const NumFieldDecimal = ({ value, onChange, min, max, prefix, suffix, size = 'text-base' }) => {
  const [localStr, setLocalStr] = useState(value.toString().replace('.', ','));
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-sm shrink-0" style={{ color: C.textDim }}>{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={localStr}
        onChange={(e) => setLocalStr(e.target.value.replace(/[^0-9,.]/g, ''))}
        onBlur={() => {
          const num = parseFloat(localStr.replace(',', '.'));
          if (!isNaN(num)) {
            const clamped = Math.min(Math.max(num, min), max);
            onChange(clamped);
            setLocalStr(clamped.toString().replace('.', ','));
          } else {
            setLocalStr(value.toString().replace('.', ','));
          }
        }}
        onFocus={(e) => e.target.select()}
        className={`${size} font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right w-full`}
        style={{ color: C.dark, borderColor: 'transparent' }}
        onFocusCapture={(e) => { e.target.style.borderColor = C.blue; e.target.style.backgroundColor = '#f8fafc'; }}
        onBlurCapture={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
      />
      {suffix && <span className="text-sm shrink-0" style={{ color: C.textDim }}>{suffix}</span>}
    </div>
  );
};

// ===== Wrapper de input em card =====
const InputCard = ({ label, hint, children }) => (
  <div>
    <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: C.textDim }}>
      {label}
    </label>
    <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
      {children}
    </div>
    {hint && <div className="text-[11px] mt-1" style={{ color: C.textDim }}>{hint}</div>}
  </div>
);

// ===== Componente principal =====
export default function SimuladorAposentadoria() {
  // Modo: 'aporte' (descobrir aporte) ou 'taxa' (descobrir rentabilidade)
  const [modo, setModo] = useState('aporte');

  // Situação atual
  const [idadeAtual, setIdadeAtual] = useState(0);
  const [idadeAposentadoria, setIdadeAposentadoria] = useState(0);
  const [capitalAtual, setCapitalAtual] = useState(0);

  // Meta
  const [tipoMeta, setTipoMeta] = useState('patrimonio'); // 'patrimonio' | 'renda'
  const [valorMeta, setValorMeta] = useState(0);

  // Premissas
  const [taxaEsperadaAno, setTaxaEsperadaAno] = useState(0);
  const [aporteMensalDisponivel, setAporteMensalDisponivel] = useState(0);

  // Inflação editável (default 4% a.a.)
  const [inflacaoAno, setInflacaoAno] = useState(4);

  // Helpers de conversão nominal <-> real
  const nominalParaReal = (nominalAno, infl) => ((1 + nominalAno / 100) / (1 + infl / 100) - 1) * 100;
  const realParaNominal = (realAno, infl) => (((1 + realAno / 100) * (1 + infl / 100)) - 1) * 100;
  const formatRealAA = (nominalAno, infl) => {
    const real = nominalParaReal(nominalAno, infl);
    if (real < 0) return `IPCA${real.toFixed(2).replace('.', ',')}%`;
    return `IPCA+${real.toFixed(2).replace('.', ',')}%`;
  };

  // Derivações — TUDO em valores reais (poder de compra de hoje)
  const anos = Math.max(0, idadeAposentadoria - idadeAtual);
  const meses = anos * 12;
  const taxaRealAno = nominalParaReal(taxaEsperadaAno, inflacaoAno);
  const taxaRealMensal = Math.pow(1 + taxaRealAno / 100, 1 / 12) - 1;
  const taxaInformadaMensal = taxaRealMensal; // alias pra cálculos internos (sempre real)

  // Converter meta de renda → patrimônio necessário (usando taxa esperada como rendimento perpétuo)
  // Pra modo 'aporte': usa a taxa informada
  // Pra modo 'taxa': não conseguimos saber qual taxa será calculada antes; usamos uma referência
  // razoável (perpetuidade = renda / taxa mensal). Pra simplificar usamos a mesma taxa do input.
  const patrimonioMeta = useMemo(() => {
    if (tipoMeta === 'patrimonio') return valorMeta;
    // Se taxa zero, não dá pra calcular perpetuidade — retorna 0 e UI mostra aviso
    if (taxaInformadaMensal <= 0) return 0;
    return valorMeta / taxaInformadaMensal;
  }, [tipoMeta, valorMeta, taxaInformadaMensal]);

  // Cálculos
  const aporteCalculado = useMemo(() => {
    if (modo !== 'aporte' || meses === 0 || patrimonioMeta <= 0) return null;
    return calcAporte(patrimonioMeta, capitalAtual, taxaInformadaMensal, meses);
  }, [modo, meses, patrimonioMeta, capitalAtual, taxaInformadaMensal]);

  const taxaCalculadaMensal = useMemo(() => {
    if (modo !== 'taxa' || meses === 0 || patrimonioMeta <= 0) return null;
    return calcTaxaMensal(patrimonioMeta, capitalAtual, aporteMensalDisponivel, meses);
  }, [modo, meses, patrimonioMeta, capitalAtual, aporteMensalDisponivel]);

  const taxaCalculadaAno = taxaCalculadaMensal !== null && taxaCalculadaMensal !== undefined
    ? (Math.pow(1 + taxaCalculadaMensal, 12) - 1) * 100
    : null;
  // A taxa calculada é REAL. Converto pra nominal pra mostrar ao cliente (que pensa em nominal).
  const taxaCalculadaNominalAno = taxaCalculadaAno !== null
    ? realParaNominal(taxaCalculadaAno, inflacaoAno)
    : null;

  // Aporte e taxa "ativos" pra simulação do gráfico
  const aporteAtivo = modo === 'aporte' ? Math.max(0, aporteCalculado || 0) : aporteMensalDisponivel;
  const taxaAtiva = modo === 'aporte' ? taxaInformadaMensal : (taxaCalculadaMensal || 0);

  // Evolução ano a ano pro gráfico
  const dadosEvolucao = useMemo(() => {
    if (meses === 0) return [];
    const arr = [{ ano: 0, idade: idadeAtual, saldo: capitalAtual, aportado: capitalAtual, rendimento: 0 }];
    let saldo = capitalAtual;
    let aportado = capitalAtual;
    for (let m = 1; m <= meses; m++) {
      saldo = saldo * (1 + taxaAtiva) + aporteAtivo;
      aportado += aporteAtivo;
      if (m % 12 === 0 || m === meses) {
        arr.push({
          ano: m / 12,
          idade: idadeAtual + m / 12,
          saldo: Math.round(saldo),
          aportado: Math.round(aportado),
          rendimento: Math.round(saldo - aportado),
        });
      }
    }
    return arr;
  }, [meses, capitalAtual, taxaAtiva, aporteAtivo, idadeAtual]);

  // Validações
  const idadesValidas = idadeAtual > 0 && idadeAposentadoria > idadeAtual;
  const metaValida = valorMeta > 0;
  const podeCalcular = idadesValidas && metaValida;
  const podeCalcularAporte = podeCalcular && taxaEsperadaAno > 0 && taxaRealMensal > 0;
  const podeCalcularTaxa = podeCalcular && aporteMensalDisponivel > 0;
  const metaRendaSemTaxa = tipoMeta === 'renda' && (taxaEsperadaAno <= 0 || taxaRealMensal <= 0);
  const taxaAbaixoInflacao = taxaEsperadaAno > 0 && taxaRealAno <= 0;

  const totalAportadoFinal = dadosEvolucao.length > 0 ? dadosEvolucao[dadosEvolucao.length - 1].aportado : 0;
  const rendimentoFinal = dadosEvolucao.length > 0 ? dadosEvolucao[dadosEvolucao.length - 1].rendimento : 0;
  const saldoFinal = dadosEvolucao.length > 0 ? dadosEvolucao[dadosEvolucao.length - 1].saldo : 0;

  // Renda gerada no ponto da meta (renda mensal perpétua, em valores de hoje).
  // Na desacumulação a taxa é sempre a informada pelo usuário — a mesma que converteu
  // a renda-alvo em patrimônio-meta (linha do patrimonioMeta). A taxa calculada por
  // bissecção vale só para a fase de acumulação; usá-la aqui contradiz a meta digitada.
  // Para meta de patrimônio no modo 'taxa' (sem input de taxa), mantém o fallback.
  const rendaProjetada = saldoFinal * (
    modo === 'aporte' || tipoMeta === 'renda' ? taxaInformadaMensal : (taxaCalculadaMensal || 0)
  );

  // Equivalências NOMINAIS no futuro (contexto pro cliente)
  const fatorInflacaoFinal = anos > 0 ? Math.pow(1 + inflacaoAno / 100, anos) : 1;
  const patrimonioMetaNominal = patrimonioMeta * fatorInflacaoFinal;
  const rendaProjetadaNominal = rendaProjetada * fatorInflacaoFinal;
  const aporteCalculadoUltimoNominal = (aporteCalculado || 0) * fatorInflacaoFinal;
  const aporteDisponivelUltimoNominal = aporteMensalDisponivel * fatorInflacaoFinal;

  // Status do resultado
  const resultadoImpossivel = modo === 'taxa' && taxaCalculadaMensal === null && podeCalcularTaxa;
  const resultadoIrrealista = modo === 'taxa' && taxaCalculadaNominalAno !== null && taxaCalculadaNominalAno > 25;
  const capitalJaSuficiente = modo === 'aporte' && aporteCalculado !== null && aporteCalculado <= 0;

  // Helper styles
  const chipModo = (active) => ({
    backgroundColor: active ? C.navy : '#ffffff',
    color: active ? '#ffffff' : '#475569',
    border: `1px solid ${active ? C.navy : C.border}`,
    transition: 'all 0.15s',
  });
  const chipMeta = (active) => ({
    backgroundColor: active ? C.navy : '#f1f5f9',
    color: active ? '#ffffff' : '#475569',
    transition: 'all 0.15s',
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff', color: C.dark, borderTop: `4px solid ${CAT.cor}` }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* HEADER */}
        <div className="mb-8">
          <div className="mb-4">
            <Link href="/simuladores" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: C.textDim }}>
              <span aria-hidden>←</span> Todos os simuladores
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ backgroundColor: `${CAT.cor}14`, color: CAT.cor, border: `1px solid ${CAT.cor}33` }}>
            <Target className="w-3.5 h-3.5" />
            {CAT.nome}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 leading-[1.1]">
            Defina sua meta. <span style={{ color: C.navy }}>Descubra o caminho.</span>
          </h1>
          <p className="text-base max-w-2xl" style={{ color: C.textDim }}>
            Em vez de simular um cenário e ver onde você chega, parta da sua meta e descubra o que precisa para alcançá-la.
          </p>
        </div>

        {/* SELETOR DE MODO */}
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.textDim }}>
            O que você quer descobrir?
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button onClick={() => setModo('aporte')} style={chipModo(modo === 'aporte')}
              className="px-5 py-4 rounded-xl text-left">
              <div className="flex items-center gap-3">
                <PiggyBank className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Quanto preciso aportar por mês</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Fixa uma rentabilidade esperada e descobre o aporte mensal</div>
                </div>
              </div>
            </button>
            <button onClick={() => setModo('taxa')} style={chipModo(modo === 'taxa')}
              className="px-5 py-4 rounded-xl text-left">
              <div className="flex items-center gap-3">
                <Percent className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Que rentabilidade preciso obter</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Fixa um aporte mensal e descobre a rentabilidade necessária</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* INPUTS */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>

          {/* Situação atual */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                Sua situação hoje
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputCard label="Idade atual" hint={idadesValidas ? `${anos} ${anos === 1 ? 'ano' : 'anos'} até a aposentadoria` : 'Quantos anos você tem hoje'}>
                <NumField value={idadeAtual} onChange={setIdadeAtual} min={0} max={100} suffix="anos" />
              </InputCard>
              <InputCard label="Idade da aposentadoria" hint={idadesValidas ? `${meses} meses para acumular` : 'Quando pretende se aposentar'}>
                <NumField value={idadeAposentadoria} onChange={setIdadeAposentadoria} min={0} max={120} suffix="anos" />
              </InputCard>
              <InputCard label="Capital já investido" hint="Quanto você já tem guardado/investido">
                <NumField value={capitalAtual} onChange={setCapitalAtual} min={0} max={1000000000} prefix="R$" />
              </InputCard>
            </div>
          </div>

          {/* Sua meta */}
          <div className="mb-5 pt-5" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                Sua meta
              </div>
            </div>
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: C.textDim }}>
                Tipo de meta
              </div>
              <div className="inline-flex gap-2 p-1 rounded-lg" style={{ backgroundColor: '#f1f5f9' }}>
                <button onClick={() => setTipoMeta('patrimonio')} style={chipMeta(tipoMeta === 'patrimonio')}
                  className="px-4 py-1.5 rounded-md text-xs font-medium">Patrimônio acumulado</button>
                <button onClick={() => setTipoMeta('renda')} style={chipMeta(tipoMeta === 'renda')}
                  className="px-4 py-1.5 rounded-md text-xs font-medium">Renda mensal</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputCard
                label={tipoMeta === 'patrimonio' ? 'Quanto quer acumular' : 'Quanto quer receber por mês'}
                hint={tipoMeta === 'renda' && taxaInformadaMensal > 0
                  ? `Equivale a um patrimônio de ${fmt(patrimonioMeta)} rendendo ${taxaEsperadaAno.toString().replace('.', ',')}% ao ano`
                  : tipoMeta === 'renda' ? 'Informe a taxa esperada para calcular o patrimônio equivalente' : 'Valor total que quer ter ao se aposentar'}
              >
                <NumField value={valorMeta} onChange={setValorMeta} min={0} max={1000000000} prefix="R$" suffix={tipoMeta === 'renda' ? '/mês' : ''} />
              </InputCard>
            </div>
          </div>

          {/* Premissas */}
          <div className="pt-5" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                Premissas
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {modo === 'aporte' ? (
                <InputCard
                  label="Rentabilidade esperada (a.a.)"
                  hint={taxaEsperadaAno > 0
                    ? `Equivale a ${formatRealAA(taxaEsperadaAno, inflacaoAno)} real (acima da inflação)`
                    : 'Nominal — taxa bruta do investimento (ex.: Selic, CDB, IPCA+X)'}
                >
                  <NumFieldDecimal value={taxaEsperadaAno} onChange={setTaxaEsperadaAno} min={0} max={100} suffix="% a.a." />
                </InputCard>
              ) : (
                <InputCard
                  label="Aporte mensal disponível"
                  hint="Quanto você consegue investir por mês (em valores de hoje)"
                >
                  <NumField value={aporteMensalDisponivel} onChange={setAporteMensalDisponivel} min={0} max={10000000} prefix="R$" suffix="/mês" />
                </InputCard>
              )}
              {modo === 'taxa' && tipoMeta === 'renda' && (
                <InputCard
                  label="Rentabilidade esperada na aposentadoria"
                  hint="Usada para calcular o patrimônio necessário para gerar a renda desejada"
                >
                  <NumFieldDecimal value={taxaEsperadaAno} onChange={setTaxaEsperadaAno} min={0} max={100} suffix="% a.a." />
                </InputCard>
              )}
              <InputCard
                label="Inflação esperada (a.a.)"
                hint={`Padrão: 4% a.a. Ajuste se quiser.`}
              >
                <NumFieldDecimal value={inflacaoAno} onChange={setInflacaoAno} min={0} max={50} suffix="% a.a." />
              </InputCard>
            </div>

            {/* Avisos sobre poder de compra */}
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.navy }} />
              <div className="text-xs" style={{ color: C.navy }}>
                Todos os valores (meta, aporte e patrimônio acumulado) estão <strong>em valores de hoje</strong>.
                Isso significa que sua meta, ajustada pela inflação, mantém o poder de compra ao longo do tempo. O simulador trabalha com a <strong>rentabilidade real</strong> (rentabilidade esperada menos inflação) para garantir isso.
              </div>
            </div>
          </div>
        </div>

        {/* RESULTADO */}
        {!podeCalcular ? (
          <div className="rounded-2xl p-12 md:p-16 text-center" style={{ backgroundColor: '#f8fafc', border: `1px dashed ${C.border}` }}>
            <Target className="w-12 h-12 mx-auto mb-4" style={{ color: C.textMore }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: C.dark }}>Preencha os campos acima</h3>
            <p className="text-sm" style={{ color: C.textDim }}>
              Você precisa informar pelo menos sua idade, a idade da aposentadoria e o valor da meta.
            </p>
          </div>
        ) : metaRendaSemTaxa ? (
          <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: C.orangeBg, border: `1px solid #fed7aa` }}>
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: C.orangeDark }} />
            <h3 className="text-base font-semibold mb-1" style={{ color: C.orangeDark }}>
              {taxaEsperadaAno <= 0 ? 'Informe uma rentabilidade esperada' : 'Rentabilidade abaixo da inflação'}
            </h3>
            <p className="text-sm" style={{ color: '#7c2d12' }}>
              {taxaEsperadaAno <= 0
                ? 'Para converter renda mensal em patrimônio, precisamos saber qual a rentabilidade esperada do patrimônio na aposentadoria.'
                : `A taxa informada (${taxaEsperadaAno.toString().replace('.', ',')}% a.a.) está abaixo ou igual à inflação (${inflacaoAno.toString().replace('.', ',')}% a.a.). Para gerar renda mensal mantendo o poder de compra, a rentabilidade precisa ser superior à inflação.`}
            </p>
          </div>
        ) : (
          <>
            {/* Hero do resultado */}
            <div className="rounded-2xl p-6 md:p-8 mb-5 relative overflow-hidden" style={{
              backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderLeft: `6px solid ${C.orange}`,
            }}>
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
                style={{ backgroundColor: 'rgba(255,87,19,0.06)' }} />
              <div className="relative">
                {modo === 'aporte' ? (
                  podeCalcularAporte ? (
                    capitalJaSuficiente ? (
                      <>
                        <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.textDim }}>
                          Pronto para a meta
                        </div>
                        <div className="text-2xl md:text-3xl font-bold leading-tight mb-2" style={{ color: C.navy }}>
                          Seu capital atual já é suficiente
                        </div>
                        <p className="text-sm" style={{ color: C.textDim }}>
                          Com {fmt(capitalAtual)} rendendo {taxaEsperadaAno.toString().replace('.', ',')}% ao ano por {anos} anos, você ultrapassa a meta sem precisar de aportes adicionais.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.textDim }}>
                          Você precisa aportar
                        </div>
                        <div className="text-4xl md:text-6xl font-bold tabular-nums leading-none mb-2" style={{ color: C.orange }}>
                          {fmt(aporteCalculado)}
                        </div>
                        <div className="text-sm mb-3 font-semibold" style={{ color: C.navy }}>
                          por mês em valores de hoje
                          <span className="font-normal text-xs ml-1" style={{ color: C.textDim }}>(ajustando anualmente pela inflação)</span>
                        </div>
                        <div className="text-base" style={{ color: C.textDim }}>
                          durante <strong style={{ color: C.dark }}>{anos} anos</strong> para atingir {fmt(patrimonioMeta)}
                          {tipoMeta === 'renda' && ` (que renderia ${fmt(valorMeta)}/mês em valores de hoje)`}.
                        </div>
                      </>
                    )
                  ) : (
                    <div className="text-sm" style={{ color: C.textDim }}>
                      Informe a rentabilidade esperada para calcular o aporte necessário.
                    </div>
                  )
                ) : (
                  podeCalcularTaxa ? (
                    resultadoImpossivel ? (
                      <>
                        <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.red }}>
                          Meta inalcançável
                        </div>
                        <div className="text-2xl md:text-3xl font-bold leading-tight mb-2" style={{ color: C.red }}>
                          Não é possível atingir essa meta
                        </div>
                        <p className="text-sm" style={{ color: '#991b1b' }}>
                          Com {fmt(aporteMensalDisponivel)}/mês durante {anos} anos não é matematicamente possível chegar em {fmt(patrimonioMeta)}, nem com rentabilidades irrealistas.
                          Considere aumentar o aporte, estender o prazo ou reduzir a meta.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.textDim }}>
                          Sua carteira precisa render
                        </div>
                        <div className="text-4xl md:text-6xl font-bold tabular-nums leading-none mb-2" style={{ color: C.orange }}>
                          {taxaCalculadaNominalAno !== null ? `${taxaCalculadaNominalAno.toFixed(2).replace('.', ',')}% a.a.` : '—'}
                        </div>
                        {taxaCalculadaAno !== null && (
                          <div className="text-sm mb-3 font-semibold" style={{ color: C.navy }}>
                            ou <span className="tabular-nums">{taxaCalculadaAno >= 0 ? 'IPCA+' : 'IPCA'}{taxaCalculadaAno.toFixed(2).replace('.', ',')}%</span> em termos reais
                            <span className="font-normal text-xs ml-1" style={{ color: C.textDim }}>(considerando inflação de {inflacaoAno.toString().replace('.', ',')}% a.a.)</span>
                          </div>
                        )}
                        <div className="text-base" style={{ color: C.textDim }}>
                          aportando <strong style={{ color: C.dark }}>{fmt(aporteMensalDisponivel)}/mês</strong> por <strong style={{ color: C.dark }}>{anos} anos</strong> para chegar em {fmt(patrimonioMeta)}
                          {tipoMeta === 'renda' && ` (que renderia ${fmt(valorMeta)}/mês em valores de hoje)`}.
                        </div>
                        {resultadoIrrealista && (
                          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: C.orangeBg, border: `1px solid #fed7aa` }}>
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.orangeDark }} />
                            <div className="text-xs" style={{ color: '#7c2d12' }}>
                              Essa rentabilidade é difícil de atingir em investimentos tradicionais. CDB, Tesouro Direto e ações brasileiras costumam render entre 8% e 15% a.a. em termos nominais.
                              Considere aumentar o aporte ou estender o prazo.
                            </div>
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <div className="text-sm" style={{ color: C.textDim }}>
                      Informe o aporte mensal disponível para calcular a rentabilidade necessária.
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Cards complementares */}
            {(podeCalcularAporte || podeCalcularTaxa) && !resultadoImpossivel && !metaRendaSemTaxa && dadosEvolucao.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
                <div className="rounded-2xl p-5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                  <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>
                    Patrimônio na meta
                  </div>
                  <div className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: C.dark }}>
                    {fmt(saldoFinal)}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                    em valores de hoje
                  </div>
                </div>
                <div className="rounded-2xl p-5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                  <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>
                    Total aportado
                  </div>
                  <div className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: C.dark }}>
                    {fmt(totalAportadoFinal)}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                    em valores de hoje (capital atual + aportes)
                  </div>
                </div>
                <div className="rounded-2xl p-5" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
                  <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.navy }}>
                    Rendimento real
                  </div>
                  <div className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: C.navy }}>
                    {fmt(rendimentoFinal)}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: C.navy }}>
                    {saldoFinal > 0 ? ((rendimentoFinal / saldoFinal) * 100).toFixed(0) : 0}% do total (acima da inflação)
                  </div>
                </div>
                <div className="rounded-2xl p-5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                  <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>
                    Renda mensal gerada
                  </div>
                  <div className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: C.dark }}>
                    {fmt(rendaProjetada)}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                    em valores de hoje, sem consumir capital
                  </div>
                </div>
              </div>
            )}

            {/* EQUIVALÊNCIA NOMINAL FUTURA */}
            {(podeCalcularAporte || podeCalcularTaxa) && !resultadoImpossivel && !metaRendaSemTaxa && anos > 0 && (
              <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4" style={{ color: C.navy }} />
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                    Para você ter dimensão
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: C.dark }}>Equivalência em valores nominais</h3>
                <p className="text-sm mb-4" style={{ color: C.textDim }}>
                  Tudo que mostramos acima está em <strong>poder de compra de hoje</strong>. Para dar a você a noção de quanto isso representa em reais nominais daqui a {anos} anos com inflação de {inflacaoAno.toString().replace('.', ',')}% a.a.:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                    <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>Sua meta de patrimônio</div>
                    <div className="text-sm tabular-nums mb-1" style={{ color: '#475569' }}>
                      Hoje: <strong style={{ color: C.dark }}>{fmt(patrimonioMeta)}</strong>
                    </div>
                    <div className="text-base tabular-nums font-semibold" style={{ color: C.navy }}>
                      Em {anos} anos: {fmt(patrimonioMetaNominal)} nominais
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                      É o que você precisa ter acumulado em reais "do futuro" para equivaler a {fmt(patrimonioMeta)} de hoje.
                    </div>
                  </div>

                  <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                    <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>Renda mensal gerada</div>
                    <div className="text-sm tabular-nums mb-1" style={{ color: '#475569' }}>
                      Hoje: <strong style={{ color: C.dark }}>{fmt(rendaProjetada)}/mês</strong>
                    </div>
                    <div className="text-base tabular-nums font-semibold" style={{ color: C.navy }}>
                      Em {anos} anos: {fmt(rendaProjetadaNominal)}/mês nominais
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                      Ao manter só a taxa real, sua retirada cresce com a inflação e mantém o mesmo poder de compra ao longo da aposentadoria.
                    </div>
                  </div>

                  {modo === 'aporte' && aporteCalculado > 0 && (
                    <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>Seu aporte mensal</div>
                      <div className="text-sm tabular-nums mb-1" style={{ color: '#475569' }}>
                        1º mês: <strong style={{ color: C.dark }}>{fmt(aporteCalculado)}</strong>
                      </div>
                      <div className="text-base tabular-nums font-semibold" style={{ color: C.navy }}>
                        Último mês: {fmt(aporteCalculadoUltimoNominal)} nominais
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                        Você precisa reajustar seu aporte anualmente pela inflação para manter o plano.
                      </div>
                    </div>
                  )}

                  {modo === 'taxa' && aporteMensalDisponivel > 0 && (
                    <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>Seu aporte mensal</div>
                      <div className="text-sm tabular-nums mb-1" style={{ color: '#475569' }}>
                        1º mês: <strong style={{ color: C.dark }}>{fmt(aporteMensalDisponivel)}</strong>
                      </div>
                      <div className="text-base tabular-nums font-semibold" style={{ color: C.navy }}>
                        Último mês: {fmt(aporteDisponivelUltimoNominal)} nominais
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                        Você precisa reajustar seu aporte anualmente pela inflação para manter o poder de compra.
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    Fator de inflação acumulada em {anos} anos: <strong>{fatorInflacaoFinal.toFixed(2).replace('.', ',')}×</strong>. Ou seja, em {anos} anos, R$ 1 de hoje vale R$ {fatorInflacaoFinal.toFixed(2).replace('.', ',')} nominais.
                  </span>
                </div>
              </div>
            )}

            {/* Gráfico de evolução */}
            {dadosEvolucao.length > 1 && !resultadoImpossivel && (podeCalcularAporte || podeCalcularTaxa) && (
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4" style={{ color: C.navy }} />
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                    Evolução do patrimônio
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>Do hoje até a aposentadoria</h3>

                <div className="flex items-center justify-center flex-wrap gap-4 mb-3 text-xs" style={{ color: '#475569' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: C.textMore }} />
                    <span>Total aportado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: C.navy }} />
                    <span>Patrimônio acumulado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: C.orange }} />
                    <span>Meta</span>
                  </div>
                </div>

                <div className="rounded-xl p-3 md:p-4 h-80 md:h-96" style={{ backgroundColor: '#f8fafc' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                      <defs>
                        <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.navy} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={C.navy} stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradAportado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.textMore} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={C.textMore} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="idade" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'Idade', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px' }}
                        formatter={(v, name) => [fmt(v), name === 'saldo' ? 'Patrimônio' : name === 'aportado' ? 'Aportado' : name]}
                        labelFormatter={(v) => `${v} anos`}
                      />
                      <ReferenceLine y={patrimonioMeta} stroke={C.orange} strokeDasharray="5 5" strokeWidth={2}
                        label={{ value: `Meta: ${fmt(patrimonioMeta)}`, position: 'insideTopRight', fill: C.orange, fontSize: 11, fontWeight: 600 }} />
                      <Area type="monotone" dataKey="aportado" stroke={C.textMore} strokeWidth={2} fill="url(#gradAportado)" name="aportado" />
                      <Area type="monotone" dataKey="saldo" stroke={C.navy} strokeWidth={2.5} fill="url(#gradSaldo)" name="saldo" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    Todos os valores estão <strong>em poder de compra de hoje</strong>. A área azul-marinho é o patrimônio acumulado, a cinza é só o que você aportou — a diferença é o rendimento real (acima da inflação). A linha laranja é sua meta.
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="text-center text-[11px] mt-8 pb-4 px-4 leading-relaxed" style={{ color: C.textDim }}>
          Simulação meramente ilustrativa. Rentabilidade passada não garante rentabilidade futura. Considere taxas, impostos, perfil de risco e seu planejamento financeiro real.
        </div>
      </div>
    </div>
  );
}
