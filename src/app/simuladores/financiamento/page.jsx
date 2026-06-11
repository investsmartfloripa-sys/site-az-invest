"use client";

import { useState, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Home, Building2, Calculator, TrendingDown, Info, AlertCircle, Briefcase } from "lucide-react";

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
  navyBg: '#eff6ff',
  navyBgSoft: '#f0f5ff',
  blue: '#2563eb',
  blueBg: '#dbeafe',
  blueBgSoft: '#eff6ff',
  orange: '#FF5713',
  orangeDark: '#E04A0F',
  orangeBg: '#fff7ed',
  orangeBgSoft: '#fff3ed',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  textDim: '#64748b',
  textMore: '#94a3b8',
};

// ===== Cálculos =====
function calcPrice(saldoInicial, taxaMensal, n) {
  if (n <= 0 || saldoInicial <= 0) return [];
  const arr = [];
  let pmt;
  if (Math.abs(taxaMensal) < 1e-10) {
    pmt = saldoInicial / n;
  } else {
    const fator = Math.pow(1 + taxaMensal, n);
    pmt = (saldoInicial * taxaMensal * fator) / (fator - 1);
  }
  let saldo = saldoInicial;
  for (let m = 1; m <= n; m++) {
    const juros = saldo * taxaMensal;
    const amortizacao = pmt - juros;
    saldo = Math.max(0, saldo - amortizacao);
    arr.push({ mes: m, parcela: pmt, juros, amortizacao, saldo });
  }
  return arr;
}

function calcSAC(saldoInicial, taxaMensal, n) {
  if (n <= 0 || saldoInicial <= 0) return [];
  const arr = [];
  const amortizacao = saldoInicial / n;
  let saldo = saldoInicial;
  for (let m = 1; m <= n; m++) {
    const juros = saldo * taxaMensal;
    const parcela = amortizacao + juros;
    saldo = Math.max(0, saldo - amortizacao);
    arr.push({ mes: m, parcela, juros, amortizacao, saldo });
  }
  return arr;
}

// ===== Inputs =====
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
  useEffect(() => { setLocalStr(value.toString().replace('.', ',')); }, [value]);
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
export default function SimuladorFinanciamento() {
  const [valorImovel, setValorImovel] = useState(0);
  const [entrada, setEntrada] = useState(0);
  const [prazoMeses, setPrazoMeses] = useState(0);
  const [taxaAno, setTaxaAno] = useState(11);
  const [sistemaFoco, setSistemaFoco] = useState('comparar'); // 'comparar' | 'price' | 'sac'

  const valorFinanciado = Math.max(0, valorImovel - entrada);
  const percentEntrada = valorImovel > 0 ? (entrada / valorImovel) * 100 : 0;
  const taxaMensal = Math.pow(1 + taxaAno / 100, 1 / 12) - 1;

  const podeCalcular = valorFinanciado > 0 && prazoMeses > 0 && taxaAno > 0;

  const dadosPrice = useMemo(() => podeCalcular ? calcPrice(valorFinanciado, taxaMensal, prazoMeses) : [], [valorFinanciado, taxaMensal, prazoMeses, podeCalcular]);
  const dadosSAC = useMemo(() => podeCalcular ? calcSAC(valorFinanciado, taxaMensal, prazoMeses) : [], [valorFinanciado, taxaMensal, prazoMeses, podeCalcular]);

  // Resumos
  const resumoPrice = useMemo(() => {
    if (dadosPrice.length === 0) return null;
    const totalPago = dadosPrice.reduce((s, d) => s + d.parcela, 0);
    const totalJuros = dadosPrice.reduce((s, d) => s + d.juros, 0);
    return {
      primeira: dadosPrice[0].parcela,
      ultima: dadosPrice[dadosPrice.length - 1].parcela,
      media: totalPago / dadosPrice.length,
      totalPago,
      totalJuros,
      jurosPercent: (totalJuros / valorFinanciado) * 100,
    };
  }, [dadosPrice, valorFinanciado]);

  const resumoSAC = useMemo(() => {
    if (dadosSAC.length === 0) return null;
    const totalPago = dadosSAC.reduce((s, d) => s + d.parcela, 0);
    const totalJuros = dadosSAC.reduce((s, d) => s + d.juros, 0);
    return {
      primeira: dadosSAC[0].parcela,
      ultima: dadosSAC[dadosSAC.length - 1].parcela,
      media: totalPago / dadosSAC.length,
      totalPago,
      totalJuros,
      jurosPercent: (totalJuros / valorFinanciado) * 100,
    };
  }, [dadosSAC, valorFinanciado]);

  // Dados pro gráfico (combinado, amostrado se prazo muito longo)
  const dadosGrafico = useMemo(() => {
    const n = Math.max(dadosPrice.length, dadosSAC.length);
    if (n === 0) return [];
    const arr = [];
    // Amostragem: se prazo > 60 meses, amostra a cada 3 meses
    const step = n > 120 ? 6 : (n > 60 ? 3 : 1);
    for (let m = 0; m < n; m += step) {
      arr.push({
        mes: m + 1,
        ano: ((m + 1) / 12).toFixed(1),
        parcelaPrice: dadosPrice[m]?.parcela || null,
        parcelaSAC: dadosSAC[m]?.parcela || null,
        saldoPrice: dadosPrice[m]?.saldo || null,
        saldoSAC: dadosSAC[m]?.saldo || null,
      });
    }
    // Garantir o último ponto
    if (n > 0 && arr[arr.length - 1].mes !== n) {
      arr.push({
        mes: n,
        ano: (n / 12).toFixed(1),
        parcelaPrice: dadosPrice[n - 1]?.parcela || null,
        parcelaSAC: dadosSAC[n - 1]?.parcela || null,
        saldoPrice: dadosPrice[n - 1]?.saldo || null,
        saldoSAC: dadosSAC[n - 1]?.saldo || null,
      });
    }
    return arr;
  }, [dadosPrice, dadosSAC]);

  // Tabela anual resumida
  const dadosAnuais = useMemo(() => {
    if (dadosPrice.length === 0 && dadosSAC.length === 0) return [];
    const totalAnos = Math.ceil(prazoMeses / 12);
    const arr = [];
    for (let a = 1; a <= totalAnos; a++) {
      const ate = Math.min(a * 12, prazoMeses);
      const de = (a - 1) * 12;
      const fatiaPrice = dadosPrice.slice(de, ate);
      const fatiaSAC = dadosSAC.slice(de, ate);
      const pagoPrice = fatiaPrice.reduce((s, d) => s + d.parcela, 0);
      const pagoSAC = fatiaSAC.reduce((s, d) => s + d.parcela, 0);
      const jurosPrice = fatiaPrice.reduce((s, d) => s + d.juros, 0);
      const jurosSAC = fatiaSAC.reduce((s, d) => s + d.juros, 0);
      arr.push({
        ano: a,
        parcelaPrice: fatiaPrice[0]?.parcela || 0,
        parcelaSAC: fatiaSAC[0]?.parcela || 0,
        pagoPrice,
        pagoSAC,
        jurosPrice,
        jurosSAC,
        saldoPrice: fatiaPrice[fatiaPrice.length - 1]?.saldo || 0,
        saldoSAC: fatiaSAC[fatiaSAC.length - 1]?.saldo || 0,
      });
    }
    return arr;
  }, [dadosPrice, dadosSAC, prazoMeses]);

  // Cenários de TR — pra educar sobre o impacto ao longo do contrato.
  // A TR oscila mês a mês conforme a Selic (fica zerada quando Selic ≤ 8,5%, sobe quando passa).
  // Em 20-40 anos de contrato é estatisticamente quase certo passar por ciclos com TR positiva.
  // Modelamos isso como uma TR MÉDIA equivalente durante todo o contrato.
  // Histórico 2015-2025 inclui ~4 anos zerada (2018-2021), o que puxa a média pra baixo.
  const TR_MEDIA = 0.5; // a.a. — cenário realista (mistura de ciclos zerados e positivos)
  const TR_STRESS = 1;  // a.a. — cenário pessimista (Selic alta mais persistente)

  const calcCenario = (trAno) => {
    if (!podeCalcular) return { totalPrice: 0, totalSAC: 0, mediaPrice: 0, mediaSAC: 0 };
    const trMensal = Math.pow(1 + trAno / 100, 1 / 12) - 1;
    // Simulação mês a mês conforme o contrato SFH: a TR corrige o SALDO DEVEDOR
    // e a prestação (Price) ou a amortização (SAC = saldo corrigido ÷ meses restantes)
    // é recalculada sobre o saldo corrigido e o prazo restante — as parcelas crescem
    // ao longo do contrato e o total nominal pago reflete o efeito real da TR.
    let saldoPrice = valorFinanciado;
    let totalPrice = 0;
    for (let m = 1; m <= prazoMeses; m++) {
      saldoPrice *= 1 + trMensal;
      const restantes = prazoMeses - m + 1;
      let pmt;
      if (Math.abs(taxaMensal) < 1e-10) {
        pmt = saldoPrice / restantes;
      } else {
        const fator = Math.pow(1 + taxaMensal, restantes);
        pmt = (saldoPrice * taxaMensal * fator) / (fator - 1);
      }
      const juros = saldoPrice * taxaMensal;
      saldoPrice = Math.max(0, saldoPrice - (pmt - juros));
      totalPrice += pmt;
    }
    let saldoSAC = valorFinanciado;
    let totalSAC = 0;
    for (let m = 1; m <= prazoMeses; m++) {
      saldoSAC *= 1 + trMensal;
      const amortizacao = saldoSAC / (prazoMeses - m + 1);
      const juros = saldoSAC * taxaMensal;
      totalSAC += amortizacao + juros;
      saldoSAC = Math.max(0, saldoSAC - amortizacao);
    }
    return {
      totalPrice,
      totalSAC,
      mediaPrice: totalPrice / prazoMeses,
      mediaSAC: totalSAC / prazoMeses,
    };
  };

  const cenarioMedia = useMemo(() => calcCenario(TR_MEDIA), [valorFinanciado, taxaMensal, prazoMeses, podeCalcular]);
  const cenarioStress = useMemo(() => calcCenario(TR_STRESS), [valorFinanciado, taxaMensal, prazoMeses, podeCalcular]);

  // Impactos vs base (sem TR)
  const impMediaPriceTotal = cenarioMedia.totalPrice - (resumoPrice?.totalPago || 0);
  const impMediaSACTotal = cenarioMedia.totalSAC - (resumoSAC?.totalPago || 0);
  const impMediaPriceParcela = cenarioMedia.mediaPrice - (resumoPrice?.media || 0);
  const impMediaSACParcela = cenarioMedia.mediaSAC - (resumoSAC?.media || 0);
  const impStressPriceTotal = cenarioStress.totalPrice - (resumoPrice?.totalPago || 0);
  const impStressSACTotal = cenarioStress.totalSAC - (resumoSAC?.totalPago || 0);
  const impStressPriceParcela = cenarioStress.mediaPrice - (resumoPrice?.media || 0);
  const impStressSACParcela = cenarioStress.mediaSAC - (resumoSAC?.media || 0);

  // Helpers de UI
  const chipBtn = (active, accentColor) => ({
    backgroundColor: active ? accentColor : '#ffffff',
    color: active ? '#ffffff' : '#475569',
    border: `1px solid ${active ? accentColor : C.border}`,
    transition: 'all 0.15s',
  });

  // Chips de prazo pré-definidos
  const prazosComuns = [
    { meses: 120, label: '10 anos' },
    { meses: 180, label: '15 anos' },
    { meses: 240, label: '20 anos' },
    { meses: 360, label: '30 anos' },
    { meses: 420, label: '35 anos' },
  ];

  // Chips de entrada pré-definidos
  const setEntradaPercent = (p) => setEntrada(Math.round(valorImovel * p / 100));
  const entradasComuns = [
    { p: 20, label: '20%' },
    { p: 30, label: '30%' },
    { p: 40, label: '40%' },
    { p: 50, label: '50%' },
  ];

  // Diferenças resumo
  const economiaSAC = resumoPrice && resumoSAC ? resumoPrice.totalPago - resumoSAC.totalPago : 0;
  const diferencaPrimeira = resumoSAC && resumoPrice ? resumoSAC.primeira - resumoPrice.primeira : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff', color: C.dark }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* HEADER */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: C.blueBgSoft, color: C.navy, border: `1px solid ${C.blueBg}` }}>
            <Home className="w-3.5 h-3.5" />
            Simulador de Financiamento Imobiliário
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 leading-[1.1]">
            SAC ou PRICE? <span style={{ color: C.navy }}>Cotamos para você nos principais bancos.</span>
          </h1>
          <p className="text-base max-w-2xl" style={{ color: C.textDim }}>
            Simule parcela, custo total e impacto da TR nos dois sistemas. Depois, conectamos você aos nossos parceiros para fechar com a melhor oferta.
          </p>
        </div>

        {/* BANCOS PARCEIROS */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
          <div className="text-[11px] uppercase tracking-wider font-semibold mb-3 text-center" style={{ color: C.textDim }}>
            Cotamos em todos os principais bancos do mercado
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {['Caixa', 'Banco do Brasil', 'Itaú', 'Bradesco', 'Santander', 'Inter', 'Sicoob', 'C6 Bank'].map((banco) => (
              <div key={banco} className="px-4 py-2 rounded-lg text-xs font-semibold tabular-nums"
                style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}`, color: C.navy, minWidth: '95px', textAlign: 'center' }}>
                {banco}
              </div>
            ))}
          </div>
          <div className="text-center text-[10px] mt-3" style={{ color: C.textMore }}>
            Cada banco tem taxa, prazo máximo e regras próprias. Cotamos em todos para encontrar a oferta certa para o seu perfil.
          </div>
        </div>

        {/* INPUTS */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>

          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4" style={{ color: C.navy }} />
            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
              Dados do financiamento
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <InputCard label="Valor do imóvel" hint="Valor total de avaliação ou compra">
              <NumField value={valorImovel} onChange={(v) => {
                setValorImovel(v);
                if (entrada > v) setEntrada(v);
              }} min={0} max={1000000000} prefix="R$" />
            </InputCard>

            <InputCard
              label="Entrada"
              hint={valorImovel > 0 ? `${percentEntrada.toFixed(1).replace('.', ',')}% do imóvel` : 'Quanto você vai dar de entrada'}
            >
              <NumField value={entrada} onChange={setEntrada} min={0} max={valorImovel || 1000000000} prefix="R$" />
            </InputCard>

            <InputCard label="Prazo" hint={prazoMeses > 0 ? `${(prazoMeses / 12).toFixed(prazoMeses % 12 === 0 ? 0 : 1).replace('.', ',')} ${prazoMeses < 24 ? 'ano' : 'anos'}` : 'Duração do financiamento'}>
              <NumField value={prazoMeses} onChange={setPrazoMeses} min={0} max={600} suffix="meses" />
            </InputCard>

            <InputCard
              label="Taxa de juros (a.a.)"
              hint={`Padrão: 11% (média SFH atual). As taxas variam de 9% a 13% conforme o banco.`}
            >
              <NumFieldDecimal value={taxaAno} onChange={setTaxaAno} min={0} max={50} suffix="% a.a." />
            </InputCard>
          </div>

          {/* Chips de prazo rápido */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Prazo rápido:</span>
            {prazosComuns.map((p) => (
              <button key={p.meses} onClick={() => setPrazoMeses(p.meses)} style={chipBtn(prazoMeses === p.meses, C.navy)}
                className="px-3 py-1 rounded-md text-[11px] font-medium">{p.label}</button>
            ))}
          </div>

          {/* Chips de entrada rápida — sempre visíveis */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Entrada rápida:</span>
            {entradasComuns.map((e) => (
              <button key={e.p} onClick={() => setEntradaPercent(e.p)} style={chipBtn(Math.round(percentEntrada) === e.p && valorImovel > 0, C.navy)}
                className="px-3 py-1 rounded-md text-[11px] font-medium" disabled={valorImovel === 0}>
                {e.label}
              </button>
            ))}
            {valorImovel === 0 && <span className="text-[10px]" style={{ color: C.textMore }}>(preencha o valor do imóvel)</span>}
          </div>

          {valorFinanciado > 0 && (
            <div className="mt-4 p-3 rounded-lg flex items-center justify-between" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.navy }}>Valor a financiar</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: C.navy }}>{fmt(valorFinanciado)}</div>
            </div>
          )}
        </div>

        {/* RESULTADO */}
        {!podeCalcular ? (
          <div className="rounded-2xl p-12 md:p-16 text-center" style={{ backgroundColor: '#f8fafc', border: `1px dashed ${C.border}` }}>
            <Calculator className="w-12 h-12 mx-auto mb-4" style={{ color: C.textMore }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: C.dark }}>Preencha os dados acima</h3>
            <p className="text-sm" style={{ color: C.textDim }}>
              Você precisa informar o valor a financiar, o prazo e a taxa de juros para ver a comparação.
            </p>
          </div>
        ) : (
          <>
            {/* HERO COMPARATIVO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {/* PRICE */}
              <div className="rounded-2xl p-6 relative overflow-hidden" style={{
                backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderLeft: `6px solid ${C.navy}`,
              }}>
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                  style={{ backgroundColor: 'rgba(30,58,138,0.06)' }} />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.navy }}>PRICE</div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: C.navyBg, color: C.navy, border: `1px solid ${C.blueBg}` }}>
                      Parcela fixa
                    </span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>
                    Parcela mensal
                  </div>
                  <div className="text-3xl md:text-4xl font-bold tabular-nums leading-none mb-2" style={{ color: C.navy }}>
                    {fmtCents(resumoPrice?.primeira || 0)}
                  </div>
                  <div className="text-sm" style={{ color: C.textDim }}>
                    do início ao fim, por <strong style={{ color: C.dark }}>{prazoMeses} meses</strong>.
                  </div>
                </div>
              </div>

              {/* SAC */}
              <div className="rounded-2xl p-6 relative overflow-hidden" style={{
                backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderLeft: `6px solid ${C.orange}`,
              }}>
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                  style={{ backgroundColor: 'rgba(255,87,19,0.06)' }} />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.orange }}>SAC</div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: C.orangeBg, color: C.orangeDark, border: `1px solid #fed7aa` }}>
                      Parcela decrescente
                    </span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>
                    Primeira parcela
                  </div>
                  <div className="text-3xl md:text-4xl font-bold tabular-nums leading-none mb-2" style={{ color: C.orange }}>
                    {fmtCents(resumoSAC?.primeira || 0)}
                  </div>
                  <div className="text-sm" style={{ color: C.textDim }}>
                    cai até <strong style={{ color: C.dark }}>{fmtCents(resumoSAC?.ultima || 0)}</strong> na última.
                  </div>
                </div>
              </div>
            </div>

            {/* COMPARATIVO DETALHADO */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                  Comparativo
                </div>
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>PRICE vs SAC, lado a lado</h3>

              <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}></th>
                      <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.navy }}>PRICE</th>
                      <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.orange }}>SAC</th>
                      <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-3 px-3" style={{ color: '#475569' }}>Primeira parcela</td>
                      <td className="py-3 px-3 text-right tabular-nums" style={{ color: C.dark }}>{fmtCents(resumoPrice?.primeira || 0)}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: C.dark }}>{fmtCents(resumoSAC?.primeira || 0)}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-xs" style={{ color: diferencaPrimeira > 0 ? C.orangeDark : C.navy }}>
                        SAC {diferencaPrimeira > 0 ? '+' : ''}{fmtCents(diferencaPrimeira)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-3 px-3" style={{ color: '#475569' }}>Última parcela</td>
                      <td className="py-3 px-3 text-right tabular-nums" style={{ color: C.dark }}>{fmtCents(resumoPrice?.ultima || 0)}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: C.dark }}>{fmtCents(resumoSAC?.ultima || 0)}</td>
                      <td className="py-3 px-3 text-right text-xs" style={{ color: C.textDim }}>—</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-3 px-3" style={{ color: '#475569' }}>Parcela média</td>
                      <td className="py-3 px-3 text-right tabular-nums" style={{ color: C.dark }}>{fmtCents(resumoPrice?.media || 0)}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: C.dark }}>{fmtCents(resumoSAC?.media || 0)}</td>
                      <td className="py-3 px-3 text-right text-xs" style={{ color: C.textDim }}>—</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-3 px-3" style={{ color: '#475569' }}>Total de juros</td>
                      <td className="py-3 px-3 text-right tabular-nums" style={{ color: C.dark }}>{fmt(resumoPrice?.totalJuros || 0)}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: C.dark }}>{fmt(resumoSAC?.totalJuros || 0)}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-xs" style={{ color: C.textDim }}>
                        {resumoPrice ? `${resumoPrice.jurosPercent.toFixed(0)}% vs ${resumoSAC.jurosPercent.toFixed(0)}% do financiado` : '—'}
                      </td>
                    </tr>
                    <tr style={{ backgroundColor: C.orangeBgSoft, borderTop: `2px solid ${C.border}` }}>
                      <td className="py-3.5 px-3 font-bold text-sm" style={{ color: C.orangeDark }}>Custo total</td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-base font-bold" style={{ color: C.dark }}>{fmt(resumoPrice?.totalPago || 0)}</td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-base font-bold" style={{ color: C.dark }}>{fmt(resumoSAC?.totalPago || 0)}</td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-xs font-semibold" style={{ color: economiaSAC > 0 ? C.navy : C.orangeDark }}>
                        {economiaSAC > 0 ? `SAC economiza ${fmt(economiaSAC)}` : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {economiaSAC > 0 && (
                <div className="mt-4 rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: C.orangeBgSoft, border: `1px solid #fed7aa` }}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.orangeDark }} />
                  <div className="text-xs" style={{ color: '#7c2d12' }}>
                    <strong>No SAC, você economiza {fmt(economiaSAC)} em juros</strong> ao longo do contrato, mas paga uma primeira parcela {fmtCents(diferencaPrimeira)} mais alta. SAC compensa quem aguenta o aperto inicial e quer pagar menos no total.
                  </div>
                </div>
              )}
            </div>

            {/* CENÁRIOS DE TR */}
            <div className="rounded-2xl p-5 md:p-6 mb-5 relative overflow-hidden" style={{
              backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderLeft: `6px solid ${C.orange}`,
            }}>
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
                style={{ backgroundColor: 'rgba(255,87,19,0.05)' }} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4" style={{ color: C.orange }} />
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.orangeDark }}>
                    O que muitos simuladores não mostram
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-2" style={{ color: C.dark }}>O impacto da TR ao longo do contrato</h3>
                <p className="text-sm mb-4" style={{ color: '#475569' }}>
                  A TR <strong>varia mês a mês</strong> conforme a Selic. Ficou zerada em todo o período 2018–2021 (Selic baixa), mas em ciclos de juros altos ela volta — 2015–2016 e 2022–2023 acumularam algo entre 1% e 1,7% a.a. Em {(prazoMeses / 12).toFixed(0)} anos de contrato você quase certamente passa por ciclos onde ela é positiva, mas é difícil prever quando. Para dar dimensão do impacto acumulado, mostramos dois cenários com <strong>TR média equivalente</strong> ao longo do contrato:
                </p>

                <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                        <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Cenário</th>
                        <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.navy }}>PRICE</th>
                        <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.orange }}>SAC</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: '#f8fafc' }}>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-sm" style={{ color: C.dark }}>TR média ~0,5% a.a.</div>
                          <div className="text-[11px]" style={{ color: C.textDim }}>cenário realista — mistura de ciclos zerados e positivos</div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="text-sm font-bold tabular-nums" style={{ color: C.orangeDark }}>+{fmt(impMediaPriceTotal)}</div>
                          <div className="text-[11px] tabular-nums" style={{ color: C.textDim }}>+{fmtCents(impMediaPriceParcela)}/mês na média</div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="text-sm font-bold tabular-nums" style={{ color: C.orangeDark }}>+{fmt(impMediaSACTotal)}</div>
                          <div className="text-[11px] tabular-nums" style={{ color: C.textDim }}>+{fmtCents(impMediaSACParcela)}/mês na média</div>
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: C.orangeBgSoft }}>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-sm" style={{ color: C.dark }}>TR média ~1% a.a.</div>
                          <div className="text-[11px]" style={{ color: C.textDim }}>cenário de estresse — Selic alta persistente</div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="text-sm font-bold tabular-nums" style={{ color: C.orangeDark }}>+{fmt(impStressPriceTotal)}</div>
                          <div className="text-[11px] tabular-nums" style={{ color: C.textDim }}>+{fmtCents(impStressPriceParcela)}/mês na média</div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="text-sm font-bold tabular-nums" style={{ color: C.orangeDark }}>+{fmt(impStressSACTotal)}</div>
                          <div className="text-[11px] tabular-nums" style={{ color: C.textDim }}>+{fmtCents(impStressSACParcela)}/mês na média</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.navy }} />
                  <div className="text-xs" style={{ color: C.navy }}>
                    Os valores acima são uma <strong>aproximação por TR média</strong> equivalente. Na prática a TR oscila — meses com ela zerada se misturam a meses com 0,1–0,2% — mas o efeito acumulado num contrato longo se aproxima desses números. É um sinal de risco, não uma previsão.
                  </div>
                </div>
              </div>
            </div>

            {/* GRÁFICO DE PARCELAS */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                  Evolução das parcelas
                </div>
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>Quanto você paga em cada mês</h3>

              <div className="flex items-center justify-center flex-wrap gap-4 mb-3 text-xs" style={{ color: '#475569' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: C.navy }} />
                  <span>PRICE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: C.orange }} />
                  <span>SAC</span>
                </div>
              </div>

              <div className="rounded-xl p-3 md:p-4 h-72 md:h-80" style={{ backgroundColor: '#f8fafc' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }}
                      label={{ value: 'Mês', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px' }}
                      formatter={(v, name) => [fmtCents(v), name === 'parcelaPrice' ? 'PRICE' : 'SAC']}
                      labelFormatter={(v) => `Mês ${v}`}
                    />
                    <Line type="monotone" dataKey="parcelaPrice" stroke={C.navy} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="parcelaSAC" stroke={C.orange} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  No PRICE a parcela é fixa do começo ao fim. No SAC ela começa alta e cai mês a mês porque os juros incidem sobre um saldo cada vez menor.
                </span>
              </div>
            </div>

            {/* GRÁFICO DE SALDO DEVEDOR */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                  Saldo devedor
                </div>
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>Quanto você ainda deve ao longo do tempo</h3>

              <div className="flex items-center justify-center flex-wrap gap-4 mb-3 text-xs" style={{ color: '#475569' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: C.navy }} />
                  <span>PRICE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: C.orange }} />
                  <span>SAC</span>
                </div>
              </div>

              <div className="rounded-xl p-3 md:p-4 h-72 md:h-80" style={{ backgroundColor: '#f8fafc' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }}
                      label={{ value: 'Mês', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px' }}
                      formatter={(v, name) => [fmt(v), name === 'saldoPrice' ? 'PRICE' : 'SAC']}
                      labelFormatter={(v) => `Mês ${v}`}
                    />
                    <Line type="monotone" dataKey="saldoPrice" stroke={C.navy} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="saldoSAC" stroke={C.orange} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  No SAC o saldo cai em linha reta (amortização constante). No PRICE ele cai devagar no início (a maior parte da parcela é juro) e acelera no fim.
                </span>
              </div>
            </div>

            {/* TABELA ANUAL */}
            <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                  Amortização ano a ano
                </div>
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>O contrato decomposto</h3>

              <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }} rowSpan={2}>Ano</th>
                      <th className="text-center py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold border-l" style={{ color: C.navy, borderColor: C.border }} colSpan={3}>PRICE</th>
                      <th className="text-center py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold border-l" style={{ color: C.orange, borderColor: C.border }} colSpan={3}>SAC</th>
                    </tr>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold border-l" style={{ color: C.textDim, borderColor: C.border }}>Parcela</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Juros no ano</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Saldo no fim</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold border-l" style={{ color: C.textDim, borderColor: C.border }}>1ª parcela</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Juros no ano</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Saldo no fim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosAnuais.map((d) => (
                      <tr key={d.ano} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                        <td className="py-2.5 px-3 font-bold tabular-nums" style={{ color: C.dark }}>{d.ano}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums border-l" style={{ color: '#475569', borderColor: C.borderSoft }}>{fmtCents(d.parcelaPrice)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.jurosPrice)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.dark, fontWeight: 500 }}>{fmt(d.saldoPrice)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums border-l" style={{ color: '#475569', borderColor: C.borderSoft }}>{fmtCents(d.parcelaSAC)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.jurosSAC)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.dark, fontWeight: 500 }}>{fmt(d.saldoSAC)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  No SAC, a "1ª parcela" mostra o valor da primeira parcela daquele ano (as demais decrescem mês a mês dentro do mesmo ano).
                </span>
              </div>
            </div>
          </>
        )}

        {/* CTA — COTAÇÃO COM PARCEIROS */}
        {podeCalcular && (
          <div className="rounded-2xl p-6 md:p-10 mt-2 relative overflow-hidden" style={{
            background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyDeep} 100%)`,
            color: '#ffffff',
          }}>
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: 'rgba(255,87,19,0.15)' }} />
            <div className="relative max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
                <Home className="w-3.5 h-3.5" />
                Próximo passo
              </div>
              <h3 className="text-2xl md:text-4xl font-bold mb-3 leading-tight">
                Quer cotar isso em <span style={{ color: '#FF5713' }}>8 bancos de uma vez</span>?
              </h3>
              <p className="text-sm md:text-base mb-6" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Enviamos sua simulação para os principais bancos do mercado e trazemos para você a oferta com menor parcela, menor custo total e melhores condições — sem você precisar negociar individualmente com cada um.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                {['Caixa', 'BB', 'Itaú', 'Bradesco', 'Santander', 'Inter', 'Sicoob', 'C6'].map((banco) => (
                  <div key={banco} className="px-3 py-1.5 rounded-md text-[11px] font-semibold"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.18)' }}>
                    {banco}
                  </div>
                ))}
              </div>

              <button className="px-6 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: C.orange, color: '#ffffff', boxShadow: '0 8px 24px rgba(255,87,19,0.35)' }}>
                Receber cotações dos parceiros
                <span aria-hidden>→</span>
              </button>
              <div className="text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Sem compromisso. Seus dados são usados apenas para solicitar as cotações.
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[11px] mt-8 pb-4 px-4 leading-relaxed" style={{ color: C.textDim }}>
          Simulação meramente ilustrativa. O cálculo base não inclui TR (variável mês a mês conforme a Selic — veja o cenário de estresse acima). Também não considera seguros (MIP/DFI), tarifas administrativas, custos de avaliação e cartório. Valores reais podem variar conforme o banco e a linha de crédito.
        </div>
      </div>
    </div>
  );
}
