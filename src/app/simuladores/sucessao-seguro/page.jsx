"use client";

import { useState, useMemo, useEffect } from "react";
import { Shield, Heart, Info, Settings2, GraduationCap, Banknote, Briefcase, Users, AlertCircle, Building2, FileText, TrendingUp, Wallet, PiggyBank, CheckCircle2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// ===== Helpers =====
const fmt = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtCents = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

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
  green: '#16a34a',
  greenBg: '#f0fdf4',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  textDim: '#64748b',
  textMore: '#94a3b8',
};

// ===== ITCMD por estado — fonte: calculaonline.com.br (mar/2026), pós EC 132/2023 e LC 227/2026 =====
const ITCMD_ESTADOS = [
  { uf: 'AC', nome: 'Acre',                 min: 4, max: 7, tipo: 'Progressivo' },
  { uf: 'AL', nome: 'Alagoas',              min: 2, max: 4, tipo: 'Fixo diferenciado' },
  { uf: 'AM', nome: 'Amazonas',             min: 2, max: 4, tipo: 'Progressivo' },
  { uf: 'AP', nome: 'Amapá',                min: 2, max: 6, tipo: 'Progressivo' },
  { uf: 'BA', nome: 'Bahia',                min: 3, max: 8, tipo: 'Progressivo' },
  { uf: 'CE', nome: 'Ceará',                min: 2, max: 8, tipo: 'Progressivo' },
  { uf: 'DF', nome: 'Distrito Federal',     min: 4, max: 6, tipo: 'Progressivo' },
  { uf: 'ES', nome: 'Espírito Santo',       min: 4, max: 4, tipo: 'Fixo' },
  { uf: 'GO', nome: 'Goiás',                min: 2, max: 8, tipo: 'Progressivo' },
  { uf: 'MA', nome: 'Maranhão',             min: 1, max: 7, tipo: 'Progressivo' },
  { uf: 'MG', nome: 'Minas Gerais',         min: 5, max: 5, tipo: 'Fixo' },
  { uf: 'MS', nome: 'Mato Grosso do Sul',   min: 3, max: 6, tipo: 'Fixo diferenciado' },
  { uf: 'MT', nome: 'Mato Grosso',          min: 2, max: 8, tipo: 'Progressivo' },
  { uf: 'PA', nome: 'Pará',                 min: 2, max: 6, tipo: 'Progressivo' },
  { uf: 'PB', nome: 'Paraíba',              min: 2, max: 8, tipo: 'Progressivo' },
  { uf: 'PE', nome: 'Pernambuco',           min: 2, max: 8, tipo: 'Progressivo' },
  { uf: 'PI', nome: 'Piauí',                min: 2, max: 6, tipo: 'Progressivo' },
  { uf: 'PR', nome: 'Paraná',               min: 4, max: 4, tipo: 'Fixo' },
  { uf: 'RJ', nome: 'Rio de Janeiro',       min: 4, max: 8, tipo: 'Progressivo' },
  { uf: 'RN', nome: 'Rio Grande do Norte',  min: 3, max: 6, tipo: 'Progressivo' },
  { uf: 'RO', nome: 'Rondônia',             min: 2, max: 4, tipo: 'Progressivo' },
  { uf: 'RR', nome: 'Roraima',              min: 4, max: 4, tipo: 'Fixo' },
  { uf: 'RS', nome: 'Rio Grande do Sul',    min: 0, max: 6, tipo: 'Progressivo' },
  { uf: 'SC', nome: 'Santa Catarina',       min: 1, max: 7, tipo: 'Progressivo' },
  { uf: 'SE', nome: 'Sergipe',              min: 2, max: 8, tipo: 'Progressivo' },
  { uf: 'SP', nome: 'São Paulo',            min: 4, max: 4, tipo: 'Fixo (transição)' },
  { uf: 'TO', nome: 'Tocantins',            min: 2, max: 8, tipo: 'Progressivo' },
];

// ===== Split heurístico de seguro vs previdência por faixa etária =====
function getSplitPorIdade(idade) {
  if (idade < 35)  return { seguro: 0.80, prev: 0.20, label: 'jovem em formação' };
  if (idade < 45)  return { seguro: 0.65, prev: 0.35, label: 'fase de acumulação' };
  if (idade < 55)  return { seguro: 0.50, prev: 0.50, label: 'maturidade financeira' };
  if (idade < 65)  return { seguro: 0.30, prev: 0.70, label: 'pré-aposentadoria' };
  return             { seguro: 0.15, prev: 0.85, label: 'aposentadoria' };
}

// ===== Inputs =====
const NumField = ({ value, onChange, min, max, prefix, suffix }) => (
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
      className="text-base font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right w-full"
      style={{ color: C.dark, borderColor: 'transparent' }}
      onFocusCapture={(e) => { e.target.style.borderColor = C.blue; e.target.style.backgroundColor = '#f8fafc'; }}
      onBlurCapture={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
    />
    {suffix && <span className="text-sm shrink-0" style={{ color: C.textDim }}>{suffix}</span>}
  </div>
);

const NumFieldDecimal = ({ value, onChange, min, max, prefix, suffix }) => {
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
        className="text-base font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right w-full"
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
    <label className="text-xs uppercase tracking-wider font-bold block mb-2" style={{ color: C.dark }}>
      {label}
    </label>
    <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
      {children}
    </div>
    {hint && <div className="text-[11px] mt-1" style={{ color: C.textDim }}>{hint}</div>}
  </div>
);

export default function SimuladorSucessaoSeguro() {
  // Básico
  const [rendaMensal, setRendaMensal] = useState(0);
  const [anosProtecao, setAnosProtecao] = useState(0);
  const [idade, setIdade] = useState(0);

  // Despesas e compromissos
  const [outrasDespesas, setOutrasDespesas] = useState(0);
  const [dividas, setDividas] = useState(0);
  const [custoEducacao, setCustoEducacao] = useState(0);

  // Sucessão
  const [uf, setUf] = useState('SP');
  const [patrimonio, setPatrimonio] = useState(0);

  // O que já tem
  const [seguroAtual, setSeguroAtual] = useState(0);
  const [prevAtual, setPrevAtual] = useState(0);

  // Configurações
  const [inflacao, setInflacao] = useState(4);
  const [itcmd, setItcmd] = useState(4);
  const [custoProc, setCustoProc] = useState(7);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  // Quando muda UF, atualiza ITCMD pra alíquota máxima daquele estado
  useEffect(() => {
    const estado = ITCMD_ESTADOS.find(e => e.uf === uf);
    if (estado) setItcmd(estado.max);
  }, [uf]);

  const estadoAtual = ITCMD_ESTADOS.find(e => e.uf === uf);

  const podeCalcular = rendaMensal > 0 && anosProtecao > 0 && idade > 0;

  const resultado = useMemo(() => {
    if (!podeCalcular) return null;

    // Cobertura de renda: renda × meses (premissa: apólice corrige IPCA, capital rende inflação)
    const meses = anosProtecao * 12;
    const coberturaRenda = rendaMensal * meses;
    const rendaFutura = rendaMensal * Math.pow(1 + inflacao / 100, anosProtecao);

    // Sucessão
    const valorItcmd = patrimonio * (itcmd / 100);
    const valorProc = patrimonio * (custoProc / 100);

    // Necessidade total
    const necessidadeTotal = coberturaRenda + custoEducacao + dividas + outrasDespesas + valorItcmd + valorProc;

    // O que já tem (limitado a no máximo a necessidade — não pode "sobrar")
    const jaTem = seguroAtual + prevAtual;
    const gap = Math.max(0, necessidadeTotal - jaTem);
    const sobra = Math.max(0, jaTem - necessidadeTotal);

    // Plano de ação: split por idade (só metas de capital, sem precificação)
    const split = getSplitPorIdade(idade);
    const seguroAdicional = gap * split.seguro;
    const prevAdicional = gap * split.prev;

    return {
      coberturaRenda,
      rendaFutura,
      custoEducacao,
      dividas,
      outrasDespesas,
      valorItcmd,
      valorProc,
      necessidadeTotal,
      jaTem,
      gap,
      sobra,
      split,
      seguroAdicional,
      prevAdicional,
    };
  }, [rendaMensal, anosProtecao, idade, outrasDespesas, dividas, custoEducacao, patrimonio, seguroAtual, prevAtual, inflacao, itcmd, custoProc, podeCalcular]);

  // Pie chart data
  const pieData = useMemo(() => {
    if (!resultado) return [];
    return [
      { name: 'Renda da família', value: Math.round(resultado.coberturaRenda), color: C.navy },
      { name: 'Sucessão (ITCMD + custos)', value: Math.round(resultado.valorItcmd + resultado.valorProc), color: C.orange },
      { name: 'Dívidas', value: Math.round(resultado.dividas), color: C.blue },
      { name: 'Outras despesas', value: Math.round(resultado.outrasDespesas), color: '#7c3aed' },
      { name: 'Educação', value: Math.round(resultado.custoEducacao), color: C.green },
    ].filter(d => d.value > 0);
  }, [resultado]);

  const pct = (v) => resultado && resultado.necessidadeTotal > 0 ? ((v / resultado.necessidadeTotal) * 100).toFixed(1).replace('.', ',') : '0,0';

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0];
    return (
      <div className="rounded-lg p-2.5 text-xs" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div className="font-semibold mb-0.5" style={{ color: p.payload.color }}>{p.name}</div>
        <div className="tabular-nums font-bold" style={{ color: C.dark }}>{fmt(p.value)}</div>
        <div className="text-[10px]" style={{ color: C.textDim }}>{pct(p.value)}% do total</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff', color: C.dark }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* HEADER */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: C.blueBgSoft, color: C.navy, border: `1px solid ${C.blueBg}` }}>
            <Shield className="w-3.5 h-3.5" />
            Diagnóstico de proteção patrimonial
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 leading-[1.1]">
            Sucessão e seguro de vida: <span style={{ color: C.navy }}>quanto você precisa e como cobrir</span>?
          </h1>
          <p className="text-base max-w-2xl" style={{ color: C.textDim }}>
            Calcule o capital total que protege sua família e descubra o mix ideal entre seguro de vida e previdência pra cobrir o que falta — com plano de ação personalizado pela sua idade.
          </p>
        </div>

        {/* INPUTS */}
        <div className="space-y-5 mb-5">

          {/* Bloco 1 — Informações básicas */}
          <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                Informações básicas
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputCard label="Sua idade" hint="Usada pra calibrar o split sugerido entre seguro e previdência">
                <NumField value={idade} onChange={setIdade} min={0} max={100} suffix="anos" />
              </InputCard>
              <InputCard label="Renda mensal" hint="Quanto a família precisa por mês pra manter o padrão de vida">
                <NumField value={rendaMensal} onChange={setRendaMensal} min={0} max={1000000000} prefix="R$" />
              </InputCard>
              <InputCard label="Anos de proteção da renda" hint="Período em que o seguro vai sustentar a família. Comum: até os filhos terminarem a faculdade">
                <NumField value={anosProtecao} onChange={setAnosProtecao} min={0} max={50} suffix="anos" />
              </InputCard>
            </div>
          </div>

          {/* Bloco 2 — Despesas e compromissos */}
          <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                Despesas e compromissos
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputCard label="Outras despesas" hint="Valor total — funeral, mudança, ajustes financeiros etc.">
                <NumField value={outrasDespesas} onChange={setOutrasDespesas} min={0} max={1000000000} prefix="R$" />
              </InputCard>
              <InputCard label="Total de dívidas" hint="Financiamentos, empréstimos, cartão. Saldo devedor hoje">
                <NumField value={dividas} onChange={setDividas} min={0} max={1000000000} prefix="R$" />
              </InputCard>
              <InputCard label="Custos com educação" hint="Valor total reservado pra educação dos filhos (faculdade, intercâmbio etc.)">
                <NumField value={custoEducacao} onChange={setCustoEducacao} min={0} max={1000000000} prefix="R$" />
              </InputCard>
            </div>
          </div>

          {/* Bloco 3 — Sucessão */}
          <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                  Sucessão
                </div>
              </div>
              <button onClick={() => setMostrarConfig(!mostrarConfig)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:opacity-70"
                style={{ color: C.textDim }}>
                <Settings2 className="w-3.5 h-3.5" />
                Ajustar alíquotas e premissas
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider font-bold block mb-2" style={{ color: C.dark }}>
                  Estado do registro dos bens
                </label>
                <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                  <select
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    className="w-full bg-transparent text-base font-bold outline-none cursor-pointer"
                    style={{ color: C.dark }}
                  >
                    {ITCMD_ESTADOS.map(e => (
                      <option key={e.uf} value={e.uf}>
                        {e.uf} — {e.nome} ({e.min === e.max ? `${e.min}% fixo` : `${e.min}% a ${e.max}% ${e.tipo === 'Progressivo' ? 'progressivo' : 'diferenciado'}`})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                  {estadoAtual && estadoAtual.min !== estadoAtual.max
                    ? `${estadoAtual.tipo} de ${estadoAtual.min}% a ${estadoAtual.max}%. Usamos a alíquota máxima como referência conservadora — na progressividade marginal a alíquota efetiva fica entre o piso e o teto.`
                    : `Alíquota ${estadoAtual?.tipo.toLowerCase()} de ${estadoAtual?.max}%.${uf === 'SP' || uf === 'MG' || uf === 'PR' || uf === 'ES' || uf === 'RR' ? ' Estado em transição obrigatória pra progressividade até 2027 (EC 132/2023).' : ''}`}
                </div>
              </div>
              <InputCard label="Valor patrimonial total" hint="Imóveis, veículos, investimentos, participações — tudo que vai entrar no inventário">
                <NumField value={patrimonio} onChange={setPatrimonio} min={0} max={10000000000} prefix="R$" />
              </InputCard>
            </div>

            {mostrarConfig && (
              <div className="mt-4 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                <InputCard label="Inflação anual" hint="Só pra ilustrar a renda equivalente daqui a alguns anos. Não muda a cobertura.">
                  <NumFieldDecimal value={inflacao} onChange={setInflacao} min={0} max={30} suffix="% a.a." />
                </InputCard>
                <InputCard label="Alíquota ITCMD" hint="Alíquota efetiva esperada no estado. Pode ser progressiva.">
                  <NumFieldDecimal value={itcmd} onChange={setItcmd} min={0} max={20} suffix="%" />
                </InputCard>
                <InputCard label="Custos do inventário" hint="Advogado, cartório, certidões, ITBI residual. Tipicamente 5–10% do patrimônio.">
                  <NumFieldDecimal value={custoProc} onChange={setCustoProc} min={0} max={20} suffix="%" />
                </InputCard>
              </div>
            )}
          </div>

          {/* Bloco 4 — O que você já tem */}
          <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                O que você já tem hoje
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: C.textDim }}>
              Opcional. Se você já tem seguro contratado ou previdência acumulada, vamos descontar do que ainda precisa cobrir.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputCard label="Seguro de vida atual" hint="Capital segurado das apólices que você já tem (somando todas)">
                <NumField value={seguroAtual} onChange={setSeguroAtual} min={0} max={1000000000} prefix="R$" />
              </InputCard>
              <InputCard label="Previdência VGBL/PGBL acumulada" hint="Saldo total acumulado em planos de previdência privada">
                <NumField value={prevAtual} onChange={setPrevAtual} min={0} max={1000000000} prefix="R$" />
              </InputCard>
            </div>
          </div>
        </div>

        {/* RESULTADO */}
        {!podeCalcular ? (
          <div className="rounded-2xl p-12 md:p-16 text-center" style={{ backgroundColor: '#f8fafc', border: `1px dashed ${C.border}` }}>
            <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: C.textMore }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: C.dark }}>Preencha idade, renda e período pra começar</h3>
            <p className="text-sm" style={{ color: C.textDim }}>São os três campos essenciais. O resto vem depois.</p>
          </div>
        ) : (
          <>
            {/* Card 1 - Necessidade total */}
            <div className="rounded-2xl p-5 md:p-8 mb-5 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.blueBgSoft} 0%, #ffffff 100%)`, border: `1px solid ${C.blueBg}` }}>
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4" style={{ color: C.orange }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                  Capital total necessário
                </div>
              </div>
              <div className="text-4xl md:text-6xl font-bold tracking-tight mb-2 tabular-nums" style={{ color: C.navy }}>
                {fmtCents(resultado.necessidadeTotal)}
              </div>
              <p className="text-sm max-w-2xl" style={{ color: C.textDim }}>
                Valor que protege sua família por <strong>{anosProtecao} anos</strong> de renda, mais quita dívidas, garante educação dos filhos e cobre os custos da sucessão. A apólice corrige automaticamente pela inflação ao longo do tempo.
              </p>
            </div>

            {/* Cards 2 e 3 - Já tem + Gap (lado a lado) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4" style={{ color: C.green }} />
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                    O que você já tem
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight mb-1 tabular-nums" style={{ color: C.green }}>
                  {fmt(resultado.jaTem)}
                </div>
                <div className="text-xs space-y-0.5" style={{ color: C.textDim }}>
                  <div className="flex justify-between"><span>Seguro de vida atual:</span><strong className="tabular-nums">{fmt(seguroAtual)}</strong></div>
                  <div className="flex justify-between"><span>Previdência acumulada:</span><strong className="tabular-nums">{fmt(prevAtual)}</strong></div>
                </div>
              </div>

              <div className="rounded-2xl p-5 md:p-6" style={{
                backgroundColor: resultado.gap > 0 ? C.orangeBgSoft : C.greenBg,
                border: `1px solid ${resultado.gap > 0 ? '#fed7aa' : '#bbf7d0'}`
              }}>
                <div className="flex items-center gap-2 mb-1">
                  {resultado.gap > 0 ? (
                    <AlertCircle className="w-4 h-4" style={{ color: C.orange }} />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" style={{ color: C.green }} />
                  )}
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: resultado.gap > 0 ? C.orangeDark : C.green }}>
                    {resultado.gap > 0 ? 'Falta cobrir' : 'Você está protegido'}
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight mb-1 tabular-nums" style={{ color: resultado.gap > 0 ? C.orange : C.green }}>
                  {fmt(resultado.gap)}
                </div>
                <p className="text-xs" style={{ color: resultado.gap > 0 ? '#7c2d12' : '#14532d' }}>
                  {resultado.gap > 0
                    ? `Sua proteção atual cobre ${(((resultado.jaTem) / resultado.necessidadeTotal) * 100).toFixed(0)}% do necessário. Veja abaixo como cobrir o restante.`
                    : `Sua proteção atual cobre todo o capital necessário — e ainda sobram ${fmt(resultado.sobra)}. Vale revisar se faz sentido manter tudo ativo.`}
                </p>
              </div>
            </div>

            {/* PLANO DE AÇÃO (só se gap > 0) */}
            {resultado.gap > 0 && (
              <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `2px solid ${C.navy}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4" style={{ color: C.navy }} />
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.navy }}>
                    Plano de ação personalizado
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: C.dark }}>
                  Como cobrir os {fmt(resultado.gap)} que faltam
                </h3>
                <p className="text-sm mb-5" style={{ color: C.textDim }}>
                  Com {idade} anos, você está na fase <strong>{resultado.split.label}</strong>. Sugerimos um mix de <strong>{(resultado.split.seguro * 100).toFixed(0)}% seguro + {(resultado.split.prev * 100).toFixed(0)}% previdência</strong>:
                </p>

                {/* Mix recomendado — só metas, sem precificação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {/* Seguro */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: C.orangeBgSoft, border: `1px solid #fed7aa` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4" style={{ color: C.orange }} />
                      <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.orangeDark }}>
                        Seguro de vida ({(resultado.split.seguro * 100).toFixed(0)}%)
                      </div>
                    </div>
                    <div className="text-3xl font-bold mb-1 tabular-nums" style={{ color: C.orangeDark }}>
                      {fmt(resultado.seguroAdicional)}
                    </div>
                    <div className="text-xs mb-3" style={{ color: '#7c2d12' }}>de capital segurado adicional</div>
                    <p className="text-[11px]" style={{ color: '#7c2d12' }}>
                      Protege sua família <strong>desde o dia 1</strong>. Se algo acontecer amanhã, o capital total já está garantido — sem inventário, sem ITCMD, em dias.
                    </p>
                  </div>

                  {/* Previdência */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <PiggyBank className="w-4 h-4" style={{ color: C.blue }} />
                      <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.navy }}>
                        Previdência ({(resultado.split.prev * 100).toFixed(0)}%)
                      </div>
                    </div>
                    <div className="text-3xl font-bold mb-1 tabular-nums" style={{ color: C.navy }}>
                      {fmt(resultado.prevAdicional)}
                    </div>
                    <div className="text-xs mb-3" style={{ color: C.navy }}>de meta de acumulação em {anosProtecao} anos</div>
                    <p className="text-[11px]" style={{ color: C.navy }}>
                      Constrói patrimônio em vida. <strong>Não entra no inventário</strong> e vai direto pro beneficiário, sem ITCMD. Ainda tem benefício fiscal no IR.
                    </p>
                  </div>
                </div>

                {/* Alternativas — só capital/meta, sem precificação */}
                <div className="pt-5 mb-5" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: C.textDim }}>
                    Outras formas de cobrir o gap
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg p-3.5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shield className="w-3.5 h-3.5" style={{ color: C.orange }} />
                        <div className="text-xs font-semibold" style={{ color: C.dark }}>100% em seguro</div>
                      </div>
                      <div className="text-lg font-bold tabular-nums mb-0.5" style={{ color: C.orangeDark }}>
                        {fmt(resultado.gap)}
                      </div>
                      <div className="text-[10px] mb-2" style={{ color: C.textDim }}>de capital em seguro de vida</div>
                      <div className="text-[11px]" style={{ color: '#7c2d12' }}>
                        <strong>A favor:</strong> proteção máxima desde o dia 1.<br/>
                        <strong>Contra:</strong> não constrói patrimônio, e o prêmio sobe forte com a idade nas renovações.
                      </div>
                    </div>
                    <div className="rounded-lg p-3.5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <PiggyBank className="w-3.5 h-3.5" style={{ color: C.blue }} />
                        <div className="text-xs font-semibold" style={{ color: C.dark }}>100% em previdência</div>
                      </div>
                      <div className="text-lg font-bold tabular-nums mb-0.5" style={{ color: C.navy }}>
                        {fmt(resultado.gap)}
                      </div>
                      <div className="text-[10px] mb-2" style={{ color: C.textDim }}>de meta acumulada em {anosProtecao} anos</div>
                      <div className="text-[11px]" style={{ color: C.navy }}>
                        <strong>A favor:</strong> constrói patrimônio em vida com vantagem fiscal.<br/>
                        <strong>Contra:</strong> não cobre morte precoce — se acontecer no ano 2, só tem o que acumulou.
                      </div>
                    </div>
                    <div className="rounded-lg p-3.5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Wallet className="w-3.5 h-3.5" style={{ color: C.green }} />
                        <div className="text-xs font-semibold" style={{ color: C.dark }}>Caixa direto pra prev</div>
                      </div>
                      <div className="text-lg font-bold tabular-nums mb-0.5" style={{ color: C.green }}>
                        {fmt(resultado.gap)}
                      </div>
                      <div className="text-[10px] mb-2" style={{ color: C.textDim }}>aportado de uma vez na prev</div>
                      <div className="text-[11px]" style={{ color: '#14532d' }}>
                        <strong>A favor:</strong> dispensa seguro, capital já protege desde o dia 1.<br/>
                        <strong>Contra:</strong> exige caixa disponível hoje. Funciona se você já tem o valor líquido.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chamada pra especialista */}
                <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.navy }} />
                  <div className="text-xs" style={{ color: C.dark }}>
                    <strong>Quer saber quanto cada caminho custaria por mês?</strong>
                    <div className="mt-1" style={{ color: C.textDim }}>
                      Prêmio de seguro varia com idade, saúde, prazo, tipo de apólice (temporário, vitalício, resgatável) e seguradora. Aporte de previdência depende do produto (VGBL/PGBL), tabela tributária e taxa de carregamento. Fazemos a cotação personalizada e fechamos os números reais.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Composição */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                  Composição da necessidade
                </div>
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>Como os {fmt(resultado.necessidadeTotal)} se dividem</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={1}
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2.5">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 py-2"
                      style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-sm truncate" style={{ color: C.dark }}>{item.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold tabular-nums" style={{ color: C.dark }}>{fmt(item.value)}</div>
                        <div className="text-[11px] tabular-nums" style={{ color: C.textDim }}>{pct(item.value)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detalhamento — dois grupos: "vida" e "custo da sucessão" */}
              <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${C.borderSoft}` }}>

                {/* Grupo 1: Pra família continuar a vida */}
                <div className="mb-5">
                  <div className="flex items-baseline justify-between gap-2 mb-2.5 flex-wrap">
                    <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.navy }}>
                      Pra família continuar a vida
                    </div>
                    <div className="text-sm font-bold tabular-nums" style={{ color: C.navy }}>
                      {fmt(resultado.coberturaRenda + resultado.custoEducacao + resultado.dividas + resultado.outrasDespesas)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Users className="w-3 h-3" style={{ color: C.navy }} />
                        <div className="font-semibold" style={{ color: C.navy }}>Renda da família</div>
                      </div>
                      <div className="text-base font-bold tabular-nums" style={{ color: C.dark }}>{fmt(resultado.coberturaRenda)}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.textDim }}>
                        {fmt(rendaMensal)}/mês × {anosProtecao * 12} meses. Em {anosProtecao} anos, equivaleria a {fmt(resultado.rendaFutura)}/mês com inflação de {inflacao.toString().replace('.', ',')}% a.a.
                      </div>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <GraduationCap className="w-3 h-3" style={{ color: C.green }} />
                        <div className="font-semibold" style={{ color: C.green }}>Educação</div>
                      </div>
                      <div className="text-base font-bold tabular-nums" style={{ color: C.dark }}>{fmt(resultado.custoEducacao)}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.textDim }}>Valor reservado pra educação dos filhos</div>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Banknote className="w-3 h-3" style={{ color: C.blue }} />
                        <div className="font-semibold" style={{ color: C.blue }}>Dívidas</div>
                      </div>
                      <div className="text-base font-bold tabular-nums" style={{ color: C.dark }}>{fmt(resultado.dividas)}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.textDim }}>Quitação imediata dos passivos</div>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <FileText className="w-3 h-3" style={{ color: '#7c3aed' }} />
                        <div className="font-semibold" style={{ color: '#7c3aed' }}>Outras despesas</div>
                      </div>
                      <div className="text-base font-bold tabular-nums" style={{ color: C.dark }}>{fmt(resultado.outrasDespesas)}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.textDim }}>Funeral, mudança, ajustes</div>
                    </div>
                  </div>
                </div>

                {/* Grupo 2: Custo da sucessão — destacado em laranja */}
                <div className="rounded-xl p-4" style={{ backgroundColor: C.orangeBgSoft, border: `1px solid #fed7aa` }}>
                  <div className="flex items-baseline justify-between gap-2 mb-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" style={{ color: C.orangeDark }} />
                      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.orangeDark }}>
                        Custo da sucessão
                      </div>
                    </div>
                    <div className="text-lg font-bold tabular-nums" style={{ color: C.orangeDark }}>
                      {fmt(resultado.valorItcmd + resultado.valorProc)}
                    </div>
                  </div>
                  <p className="text-[11px] mb-3" style={{ color: '#7c2d12' }}>
                    Esse é o valor que a sua família precisaria desembolsar pra abrir o inventário e receber o patrimônio. Sem caixa pra cobrir, vendem bens correndo ou pegam empréstimo pra pagar.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff', border: `1px solid #fed7aa` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <FileText className="w-3 h-3" style={{ color: C.orange }} />
                        <div className="font-semibold" style={{ color: C.orange }}>ITCMD ({uf})</div>
                      </div>
                      <div className="text-base font-bold tabular-nums" style={{ color: C.dark }}>{fmt(resultado.valorItcmd)}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.textDim }}>
                        Imposto estadual de transmissão. {itcmd.toString().replace('.', ',')}% sobre o patrimônio total. Pago antes da partilha — sem isso, o inventário não anda.
                      </div>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff', border: `1px solid #fed7aa` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Briefcase className="w-3 h-3" style={{ color: C.orangeDark }} />
                        <div className="font-semibold" style={{ color: C.orangeDark }}>Custos jurídicos e cartorários</div>
                      </div>
                      <div className="text-base font-bold tabular-nums" style={{ color: C.dark }}>{fmt(resultado.valorProc)}</div>
                      <div className="text-[10px] mt-0.5 space-y-0.5" style={{ color: C.textDim }}>
                        <div className="flex justify-between gap-2">
                          <span>Honorários advocatícios (~5%)</span>
                          <strong className="tabular-nums">{fmt(resultado.valorProc * 5/7)}</strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span>Custas processuais e cartorárias (~2%)</span>
                          <strong className="tabular-nums">{fmt(resultado.valorProc * 2/7)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Insight box */}
            <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: C.orangeBgSoft, border: `1px solid #fed7aa` }}>
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.orange }} />
                <div className="text-xs" style={{ color: '#7c2d12' }}>
                  <strong style={{ color: C.dark }}>
                    Sem seguro, sua família precisaria de {fmt(resultado.valorItcmd + resultado.valorProc)} em caixa imediato só pra abrir o inventário.
                  </strong>
                  {' '}E ainda viver {anosProtecao} anos sem a sua renda. O seguro de vida e a previdência VGBL resolvem os dois problemas — e o valor pago pra família <strong>não entra no inventário e é isento de ITCMD</strong>.
                </div>
              </div>
            </div>

            {/* RESSALVAS */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.navy }}>
                  Como ler esses números
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs" style={{ color: C.navy }}>
                <div>
                  <div className="font-semibold mb-1" style={{ color: C.dark }}>Apólice corrige a inflação</div>
                  Cobertura de renda = {fmt(rendaMensal)}/mês × {anosProtecao * 12} meses. A apólice é corrigida pelo IPCA e o capital pago rende em CDI/Tesouro IPCA — os dois crescem juntos.
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: C.dark }}>Mix por idade é regra de bolso</div>
                  O split {(resultado.split.seguro * 100).toFixed(0)}/{(resultado.split.prev * 100).toFixed(0)} é heurística baseada na fase de vida ({resultado.split.label}). Quanto mais jovem, mais seguro; quanto mais maduro, mais previdência (que acumula em vida e não entra no inventário).
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: C.orangeDark }}>⚠ Custos vêm na cotação</div>
                  Prêmio do seguro varia por idade, saúde, sexo, prazo e seguradora. Aporte de previdência depende do produto (VGBL/PGBL), tabela tributária e taxa de carregamento. Falamos contigo pra fechar os valores reais.
                </div>
              </div>
            </div>

            {/* BLOCO EDUCATIVO — correção patrimonial e mudanças futuras */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#fefce8', border: `1px solid #fde047` }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4" style={{ color: '#a16207' }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#a16207' }}>
                  E daqui a 10, 20 anos?
                </div>
              </div>
              <p className="text-sm mb-4" style={{ color: '#713f12' }}>
                O cálculo acima usa <strong>os valores e alíquotas de hoje</strong>. Mas seguro de vida é proteção pra um evento que pode acontecer daqui a décadas — e quatro coisas tendem a piorar a conta com o tempo:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs" style={{ color: '#713f12' }}>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff', border: `1px solid #fde047` }}>
                  <div className="font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#a16207' }}>
                    <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#fde047', color: '#713f12' }}>1</span>
                    Patrimônio cresce
                  </div>
                  Imóveis valorizam, investimentos rendem, empresa cresce. Patrimônio de R$ 1M hoje pode virar R$ 2M em 10–15 anos. O ITCMD incide sobre o valor de mercado no momento do óbito.
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff', border: `1px solid #fde047` }}>
                  <div className="font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#a16207' }}>
                    <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#fde047', color: '#713f12' }}>2</span>
                    Alíquotas podem subir
                  </div>
                  Estados como SP, MG e PR ainda têm alíquota fixa de 4–5%, mas vão migrar pra progressividade (até 8%) até 2027. Patrimônios maiores podem ver a tributação <strong>dobrar</strong>.
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff', border: `1px solid #fde047` }}>
                  <div className="font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#a16207' }}>
                    <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#fde047', color: '#713f12' }}>3</span>
                    Custos do inventário sobem
                  </div>
                  Cartórios, advogados e certidões acompanham a inflação. Inventário judicial custa mais que extrajudicial — e a base é o patrimônio futuro, não o atual.
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#ffffff', border: `1px solid #fde047` }}>
                  <div className="font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#a16207' }}>
                    <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#fde047', color: '#713f12' }}>4</span>
                    Vida e padrão mudam
                  </div>
                  Filhos novos, casamento, separação, troca de carreira, padrão de vida que sobe. A renda de R$ 10k hoje pode virar R$ 15k de necessidade em poucos anos — e a apólice precisa acompanhar.
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl p-6 md:p-10 mt-2 relative overflow-hidden" style={{
              background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyDeep} 100%)`,
              color: '#ffffff',
            }}>
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none"
                style={{ backgroundColor: 'rgba(255,87,19,0.15)' }} />
              <div className="relative max-w-3xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Shield className="w-3.5 h-3.5" />
                  Próximo passo
                </div>
                <h3 className="text-2xl md:text-4xl font-bold mb-3 leading-tight">
                  Quer saber <span style={{ color: '#FF5713' }}>quanto custa</span> proteger sua família?
                </h3>
                <p className="text-sm md:text-base mb-6" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  Estruturamos seguro de vida e previdência personalizados pra atingir as metas calculadas aqui. Comparamos seguradoras e fundos pra você ter o melhor custo-benefício — sem pagar a mais do que precisa.
                </p>
                <button className="px-6 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: C.orange, color: '#ffffff', boxShadow: '0 8px 24px rgba(255,87,19,0.35)' }}>
                  Falar com um especialista
                  <span aria-hidden>→</span>
                </button>
                <div className="text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Sem compromisso. Análise das melhores opções pra sua família.
                </div>
              </div>
            </div>
          </>
        )}

        <div className="text-center text-[11px] mt-8 pb-4 px-4 leading-relaxed" style={{ color: C.textDim }}>
          Simulação meramente ilustrativa. Cobertura de renda calculada como renda × meses, assumindo apólice corrigida pela inflação. ITCMD de {itcmd.toString().replace('.', ',')}% (topo da faixa do {uf}) e custos de inventário em {custoProc.toString().replace('.', ',')}%. Mix entre seguro e previdência é heurística pela idade — caso real considera caixa, perfil tributário, saúde e objetivos específicos. Alíquotas pós EC 132/2023 e LC 227/2026 em transição até 2027. Não substitui orientação tributária, jurídica ou de planejamento financeiro especializada.
        </div>
      </div>
    </div>
  );
}
