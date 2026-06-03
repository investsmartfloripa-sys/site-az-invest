"use client";

import { useState, useMemo, useEffect } from "react";
import { Wallet, Briefcase, TrendingDown, Info, AlertCircle, PiggyBank, FileText, Trophy } from "lucide-react";

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

// ===== Constantes fiscais (vigentes em 2026) =====
// Atualize aqui se a Receita reajustar os valores
const TABELA_IR_ANUAL = [
  { ate: 24511.92, aliquota: 0, deducao: 0 },
  { ate: 33919.80, aliquota: 0.075, deducao: 1838.39 },
  { ate: 45012.60, aliquota: 0.15, deducao: 4382.38 },
  { ate: 55976.16, aliquota: 0.225, deducao: 7758.32 },
  { ate: Infinity, aliquota: 0.275, deducao: 10557.13 },
];
const DEDUCAO_DEPENDENTE = 2275.08;
const LIMITE_EDUCACAO_PESSOA = 3561.50;
const LIMITE_DEDUCAO_SIMPLIFICADA = 16754.34;
const PCT_DEDUCAO_SIMPLIFICADA = 0.20;
const LIMITE_PGBL_PCT = 0.12;
const ALIQUOTA_PGBL_REGRESSIVA_MIN = 0.10; // 10% pra prazos > 10 anos

// Tabela INSS 2026 (CLT) — faixas atualizadas pelo salário mínimo R$ 1.621,00
function calcINSSAnual(rendaAnual) {
  if (rendaAnual <= 0) return 0;
  const rm = rendaAnual / 12;
  let inssMes = 0;
  if (rm <= 1621.00) {
    inssMes = rm * 0.075;
  } else if (rm <= 2902.84) {
    inssMes = 1621.00 * 0.075 + (rm - 1621.00) * 0.09;
  } else if (rm <= 4354.27) {
    inssMes = 1621.00 * 0.075 + (2902.84 - 1621.00) * 0.09 + (rm - 2902.84) * 0.12;
  } else if (rm <= 8475.55) {
    inssMes = 1621.00 * 0.075 + (2902.84 - 1621.00) * 0.09 + (4354.27 - 2902.84) * 0.12 + (rm - 4354.27) * 0.14;
  } else {
    inssMes = 988.09; // teto contribuição CLT 2026
  }
  return inssMes * 12;
}

function calcIR(base) {
  if (base <= 0) return 0;
  for (const f of TABELA_IR_ANUAL) {
    if (base <= f.ate) return Math.max(0, base * f.aliquota - f.deducao);
  }
  return 0;
}

// Estima IRRF anual: IR sobre a renda considerando só as deduções aplicadas na folha (INSS + dependentes).
// Usa a tabela ANUAL pra evitar distorções de arredondamento entre tabela mensal × 12 e anual.
// Saúde/educação/PGBL são apurados só no ajuste anual e geram restituição.
function calcIRRFAnual(rendaAnual, inssAnual, dependentes) {
  if (rendaAnual <= 0) return 0;
  const base = Math.max(0, rendaAnual - inssAnual - dependentes * DEDUCAO_DEPENDENTE);
  return calcIR(base);
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

const InputCard = ({ label, hint, hintColor, children }) => (
  <div>
    <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: C.textDim }}>
      {label}
    </label>
    <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
      {children}
    </div>
    {hint && <div className="text-[11px] mt-1" style={{ color: hintColor || C.textDim }}>{hint}</div>}
  </div>
);

// ===== Componente principal =====
export default function SimuladorPGBL() {
  const [periodo, setPeriodo] = useState('anual'); // 'anual' | 'mensal'
  const fator = periodo === 'mensal' ? 12 : 1;

  // Valores armazenados sempre como inputs do usuário (no período escolhido)
  const [rendaInput, setRendaInput] = useState(0);
  const [inssInput, setInssInput] = useState(0);
  const [inssAutomatico, setInssAutomatico] = useState(true);
  const [irrfInput, setIrrfInput] = useState(0);
  const [irrfAutomatico, setIrrfAutomatico] = useState(true);
  const [saudeInput, setSaudeInput] = useState(0);
  const [dependentes, setDependentes] = useState(0);
  const [educPropriaInput, setEducPropriaInput] = useState(0);
  const [educDepInput, setEducDepInput] = useState(0);
  const [pgblInput, setPgblInput] = useState(0);

  // Valores convertidos pra ANUAL (todos os cálculos usam anual internamente)
  const renda = rendaInput * fator;
  const inss = inssInput * fator;
  const irrfManual = irrfInput * fator;
  const saude = saudeInput * fator;
  const educPropria = educPropriaInput * fator;
  const educDep = educDepInput * fator;
  const pgbl = pgblInput * fator;

  // Setters que respeitam o input (sem conversão)
  const setRenda = setRendaInput;
  const setInss = setInssInput;
  const setIrrf = setIrrfInput;
  const setSaude = setSaudeInput;
  const setEducPropria = setEducPropriaInput;
  const setEducDep = setEducDepInput;
  const setPgbl = setPgblInput;

  // Projeção do efeito multiplicador
  const [anosProjecao, setAnosProjecao] = useState(10);
  const [rentabAno, setRentabAno] = useState(10);

  // INSS automático baseado na renda anual (assumindo CLT)
  useEffect(() => {
    if (inssAutomatico) {
      const inssAnual = calcINSSAnual(renda);
      // Armazena no período escolhido pelo usuário
      setInssInput(Math.round(inssAnual / fator));
    }
  }, [renda, inssAutomatico, fator]);

  // IRRF automático: IR sobre (renda - INSS - dependentes) usando tabela anual
  useEffect(() => {
    if (irrfAutomatico) {
      const irrfAnual = calcIRRFAnual(renda, inss, dependentes);
      setIrrfInput(Math.round(irrfAnual / fator));
    }
  }, [renda, inss, dependentes, irrfAutomatico, fator]);

  // Cálculos
  const limitePGBL = renda * LIMITE_PGBL_PCT;
  const pgblDedutivel = Math.min(pgbl, limitePGBL);
  const pgblExcedente = Math.max(0, pgbl - limitePGBL);

  const limiteEducPropria = LIMITE_EDUCACAO_PESSOA;
  const limiteEducDep = LIMITE_EDUCACAO_PESSOA * dependentes;
  const deducEducPropria = Math.min(educPropria, limiteEducPropria);
  const deducEducDep = Math.min(educDep, limiteEducDep);
  const deducDependentes = dependentes * DEDUCAO_DEPENDENTE;

  const educPropriaExcedente = Math.max(0, educPropria - limiteEducPropria);
  const educDepExcedente = Math.max(0, educDep - limiteEducDep);

  // Cenário 1: Simplificada
  const deducaoSimpl = Math.min(renda * PCT_DEDUCAO_SIMPLIFICADA, LIMITE_DEDUCAO_SIMPLIFICADA);
  const baseSimpl = Math.max(0, renda - deducaoSimpl);
  const irSimpl = calcIR(baseSimpl);

  // Cenário 2: Completa sem PGBL
  const deducoesSemPGBL = inss + saude + deducDependentes + deducEducPropria + deducEducDep;
  const baseSemPGBL = Math.max(0, renda - deducoesSemPGBL);
  const irSemPGBL = calcIR(baseSemPGBL);

  // Cenário 3: Completa com PGBL
  const deducoesComPGBL = deducoesSemPGBL + pgblDedutivel;
  const baseComPGBL = Math.max(0, renda - deducoesComPGBL);
  const irComPGBL = calcIR(baseComPGBL);

  // IR retido na fonte: usa o valor editável (com cálculo automático no useEffect)
  const irrf = irrfManual;

  // Restituição (ou imposto a pagar) = IRRF - IR devido
  const restitSimpl = irrf - irSimpl;
  const restitSemPGBL = irrf - irSemPGBL;
  const restitComPGBL = irrf - irComPGBL;

  // Economia REAL: comparamos com a SIMPLIFICADA (ponto de partida default da maioria das pessoas).
  // Assim a economia inclui tanto "destravar a Completa" quanto o benefício do PGBL em si.
  const economia = Math.max(0, irSimpl - irComPGBL);
  // Decomposição: quanto vem só de migrar pra Completa, quanto vem do PGBL em si
  const economiaCompleta = Math.max(0, irSimpl - irSemPGBL);
  const economiaPGBL = Math.max(0, irSemPGBL - irComPGBL);

  // Validações pra exibir resultado
  const podeCalcular = renda > 0;
  const pgblFazSentido = pgbl > 0 && economia > 0;

  // Projeção: economia anual reinvestida no PRÓPRIO PGBL via juros compostos
  // Como é PGBL, no resgate o IR incide sobre o TOTAL (capital + rendimento), não só sobre o rendimento.
  // Usamos alíquota de 10% (tabela regressiva, mínimo pra prazos > 10 anos).
  const projecao = useMemo(() => {
    if (!pgblFazSentido || anosProjecao <= 0 || rentabAno <= 0) return null;
    const i = rentabAno / 100;
    const n = anosProjecao;
    // VF = PMT × ((1+i)^n - 1) / i
    const vf = economia * ((Math.pow(1 + i, n) - 1) / i);
    const aportado = economia * n;
    const rendimento = vf - aportado;
    // IR no resgate do PGBL: incide sobre o TOTAL acumulado (não só sobre o rendimento).
    // Alíquota da tabela regressiva: 10% pra prazos > 10 anos, sobe pra prazos menores.
    const aliquota = n >= 10 ? 0.10 : (n >= 8 ? 0.15 : (n >= 6 ? 0.20 : (n >= 4 ? 0.25 : (n >= 2 ? 0.30 : 0.35))));
    const irResgate = vf * aliquota;
    const liquido = vf - irResgate;
    return { vf, aportado, rendimento, irResgate, liquido, aliquota };
  }, [pgblFazSentido, economia, anosProjecao, rentabAno]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff', color: C.dark }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* HEADER */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: C.blueBgSoft, color: C.navy, border: `1px solid ${C.blueBg}` }}>
            <PiggyBank className="w-3.5 h-3.5" />
            Simulador de PGBL
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 leading-[1.1]">
            Quanto você economiza de IR <span style={{ color: C.navy }}>investindo em PGBL?</span>
          </h1>
          <p className="text-base max-w-2xl" style={{ color: C.textDim }}>
            Veja o impacto da contribuição na declaração completa. Comparamos os 3 cenários — Simplificada, Completa e Completa com PGBL — pra mostrar a economia real.
          </p>
        </div>

        {/* INPUTS */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: C.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                Sua situação fiscal
              </div>
            </div>
            <div className="inline-flex gap-1 p-1 rounded-lg" style={{ backgroundColor: '#f1f5f9' }}>
              <button onClick={() => setPeriodo('anual')}
                style={{
                  backgroundColor: periodo === 'anual' ? C.navy : 'transparent',
                  color: periodo === 'anual' ? '#ffffff' : '#475569',
                  transition: 'all 0.15s',
                }}
                className="px-4 py-1.5 rounded-md text-xs font-semibold">
                Valores anuais
              </button>
              <button onClick={() => setPeriodo('mensal')}
                style={{
                  backgroundColor: periodo === 'mensal' ? C.navy : 'transparent',
                  color: periodo === 'mensal' ? '#ffffff' : '#475569',
                  transition: 'all 0.15s',
                }}
                className="px-4 py-1.5 rounded-md text-xs font-semibold">
                Valores mensais
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputCard
              label={`Renda bruta tributável (${periodo === 'mensal' ? 'mensal' : 'anual'})`}
              hint={rendaInput > 0 ? `Equivale a ${fmt(renda)}/ano` : 'Salário, aluguéis, outros rendimentos tributáveis'}
            >
              <NumField value={rendaInput} onChange={setRenda} min={0} max={100000000} prefix="R$" />
            </InputCard>

            <InputCard
              label={`INSS pago (${periodo === 'mensal' ? 'mensal' : 'anual'})`}
              hint={inssAutomatico
                ? <span>Calculado automático pela tabela CLT. <button onClick={() => setInssAutomatico(false)} className="underline" style={{ color: C.navy }}>Editar manual</button></span>
                : <button onClick={() => { setInssAutomatico(true); }} className="underline" style={{ color: C.navy }}>Voltar ao automático</button>
              }
            >
              <NumField
                value={inssInput}
                onChange={(v) => { setInssAutomatico(false); setInss(v); }}
                min={0}
                max={50000}
                prefix="R$"
              />
            </InputCard>

            <InputCard
              label={`IR já retido na fonte (${periodo === 'mensal' ? 'mensal' : 'anual'})`}
              hint={irrfAutomatico
                ? <span>Estimado pela renda e INSS. <button onClick={() => setIrrfAutomatico(false)} className="underline" style={{ color: C.navy }}>Editar manual</button></span>
                : <span>Use o valor do seu informe de rendimentos. <button onClick={() => setIrrfAutomatico(true)} className="underline" style={{ color: C.navy }}>Voltar ao automático</button></span>
              }
            >
              <NumField
                value={irrfInput}
                onChange={(v) => { setIrrfAutomatico(false); setIrrf(v); }}
                min={0}
                max={1000000}
                prefix="R$"
              />
            </InputCard>

            <InputCard
              label={`Gastos com saúde (${periodo === 'mensal' ? 'mensal' : 'anual'})`}
              hint="Planos, consultas, exames, dentista — sem limite, mas precisa comprovar"
            >
              <NumField value={saudeInput} onChange={setSaude} min={0} max={1000000} prefix="R$" />
            </InputCard>

            <InputCard
              label="Número de dependentes"
              hint={dependentes > 0 ? `Dedução de ${fmt(deducDependentes)}/ano (${fmtCents(DEDUCAO_DEPENDENTE)}/pessoa)` : `Cada um dá ${fmtCents(DEDUCAO_DEPENDENTE)}/ano de dedução`}
            >
              <NumField value={dependentes} onChange={setDependentes} min={0} max={20} suffix="pessoas" />
            </InputCard>

            <InputCard
              label={`Educação própria (${periodo === 'mensal' ? 'mensal' : 'anual'})`}
              hint={educPropriaExcedente > 0
                ? <span style={{ color: C.orangeDark }}>Limite anual: {fmtCents(limiteEducPropria)}. Excedente: {fmt(educPropriaExcedente)} (não dedutível).</span>
                : `Limite anual: ${fmtCents(limiteEducPropria)}`}
            >
              <NumField value={educPropriaInput} onChange={setEducPropria} min={0} max={1000000} prefix="R$" />
            </InputCard>

            <InputCard
              label={`Educação dos dependentes (${periodo === 'mensal' ? 'mensal' : 'anual'})`}
              hint={educDepExcedente > 0
                ? <span style={{ color: C.orangeDark }}>Limite anual: {fmt(limiteEducDep)} ({fmtCents(LIMITE_EDUCACAO_PESSOA)}/pessoa). Excedente: {fmt(educDepExcedente)}.</span>
                : dependentes > 0
                  ? `Limite anual: ${fmt(limiteEducDep)} (${fmtCents(LIMITE_EDUCACAO_PESSOA)} por dependente)`
                  : 'Adicione dependentes pra liberar a dedução'}
            >
              <NumField value={educDepInput} onChange={setEducDep} min={0} max={1000000} prefix="R$" disabled={dependentes === 0} />
            </InputCard>
          </div>

          {/* PGBL — destaque separado */}
          <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3">
              <PiggyBank className="w-4 h-4" style={{ color: C.orange }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.dark }}>
                Sua contribuição ao PGBL
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputCard
                label={`Contribuição PGBL (${periodo === 'mensal' ? 'mensal' : 'anual'})`}
                hint={renda > 0
                  ? <span>Limite dedutível anual: <strong>{fmt(limitePGBL)}</strong> (12% da renda bruta)</span>
                  : 'Quanto você contribui ou pretende contribuir'}
              >
                <NumField value={pgblInput} onChange={setPgbl} min={0} max={10000000} prefix="R$" />
              </InputCard>
              {pgblExcedente > 0 && (
                <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: C.orangeBgSoft, border: `1px solid #fed7aa` }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.orangeDark }} />
                  <div className="text-xs" style={{ color: '#7c2d12' }}>
                    Você contribuiu <strong>{fmt(pgbl)}</strong>, mas o limite dedutível é <strong>{fmt(limitePGBL)}</strong>. O excedente de {fmt(pgblExcedente)} continua investido, mas <strong>não gera economia de IR</strong>. Considere realocar pra VGBL ou outro investimento.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RESULTADO */}
        {!podeCalcular ? (
          <div className="rounded-2xl p-12 md:p-16 text-center" style={{ backgroundColor: '#f8fafc', border: `1px dashed ${C.border}` }}>
            <Wallet className="w-12 h-12 mx-auto mb-4" style={{ color: C.textMore }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: C.dark }}>Preencha sua renda anual</h3>
            <p className="text-sm" style={{ color: C.textDim }}>
              Informe ao menos a renda bruta tributável anual pra ver o cálculo dos 3 cenários.
            </p>
          </div>
        ) : (
          <>
            {/* HERO: economia */}
            <div className="rounded-2xl p-6 md:p-8 mb-5 relative overflow-hidden" style={{
              backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderLeft: `6px solid ${C.orange}`,
            }}>
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
                style={{ backgroundColor: 'rgba(255,87,19,0.06)' }} />
              <div className="relative">
                {pgblFazSentido ? (
                  <>
                    <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.textDim }}>
                      Sua economia anual de IR
                    </div>
                    <div className="text-5xl md:text-6xl font-bold tabular-nums leading-none mb-2" style={{ color: C.orange }}>
                      {fmt(economia)}
                    </div>
                    <div className="text-sm md:text-base" style={{ color: C.textDim }}>
                      é o que você deixa de pagar (ou recebe a mais de restituição) ao contribuir <strong style={{ color: C.dark }}>{fmt(pgblDedutivel)}</strong> no PGBL, comparado com a declaração <strong style={{ color: C.dark }}>Simplificada</strong> — o que a maioria das pessoas faz por padrão.
                    </div>
                    {economiaCompleta > 0 && (
                      <div className="mt-3 text-xs" style={{ color: '#475569' }}>
                        Dessa economia: <strong style={{ color: C.dark }}>{fmt(economiaCompleta)}</strong> já vem só de migrar pra declaração Completa, e <strong style={{ color: C.orange }}>{fmt(economiaPGBL)}</strong> vem do PGBL em si.
                      </div>
                    )}
                  </>
                ) : pgbl === 0 ? (
                  <>
                    <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.textDim }}>
                      Pra calcular a economia
                    </div>
                    <div className="text-xl md:text-2xl font-bold mb-2" style={{ color: C.navy }}>
                      Informe quanto pretende contribuir no PGBL
                    </div>
                    <p className="text-sm" style={{ color: C.textDim }}>
                      Limite dedutível pra você: <strong style={{ color: C.dark }}>{fmt(limitePGBL)}/ano</strong> (12% da renda).
                      Vamos calcular automaticamente quanto isso reduz seu IR.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.textDim }}>
                      Resultado
                    </div>
                    <div className="text-xl md:text-2xl font-bold mb-2" style={{ color: C.navy }}>
                      O PGBL não gera economia adicional pra você
                    </div>
                    <p className="text-sm" style={{ color: C.textDim }}>
                      Sua renda atual já fica abaixo da faixa de tributação na Simplificada. PGBL faz mais sentido pra quem tem IR a pagar.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* COMPARATIVO */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
                  Comparativo
                </div>
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>Os 3 cenários, lado a lado</h3>

              <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Item</th>
                      <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Simplificada</th>
                      <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Completa sem PGBL</th>
                      <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.orange }}>Completa com PGBL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 font-medium" style={{ color: C.dark }}>Renda bruta tributável</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(renda)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(renda)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(renda)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 text-xs" style={{ color: C.textDim }}>(−) INSS</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.textDim }}>—</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(inss)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(inss)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 text-xs" style={{ color: C.textDim }}>(−) Saúde</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.textDim }}>—</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(saude)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(saude)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 text-xs" style={{ color: C.textDim }}>(−) Dependentes</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.textDim }}>—</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(deducDependentes)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(deducDependentes)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 text-xs" style={{ color: C.textDim }}>(−) Educação</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.textDim }}>—</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(deducEducPropria + deducEducDep)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(deducEducPropria + deducEducDep)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 text-xs font-semibold" style={{ color: C.orange }}>(−) PGBL</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.textDim }}>—</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.textDim }}>—</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold" style={{ color: C.orange }}>{fmt(pgblDedutivel)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 text-xs" style={{ color: C.textDim }}>(−) Dedução Simplificada</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(deducaoSimpl)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.textDim }}>—</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.textDim }}>—</td>
                    </tr>
                    <tr style={{ borderBottom: `2px solid ${C.border}`, backgroundColor: '#f8fafc' }}>
                      <td className="py-2.5 px-3 font-semibold" style={{ color: C.dark }}>Base de cálculo</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold" style={{ color: C.dark }}>{fmt(baseSimpl)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold" style={{ color: C.dark }}>{fmt(baseSemPGBL)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold" style={{ color: C.dark }}>{fmt(baseComPGBL)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 text-sm" style={{ color: '#475569' }}>IR devido</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.dark }}>{fmt(irSimpl)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: C.dark }}>{fmt(irSemPGBL)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold" style={{ color: C.orangeDark }}>{fmt(irComPGBL)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2.5 px-3 text-sm" style={{ color: '#475569' }}>IR retido na fonte</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(irrf)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(irrf)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(irrf)}</td>
                    </tr>
                    <tr style={{ backgroundColor: C.orangeBgSoft }}>
                      <td className="py-3 px-3 font-bold text-sm" style={{ color: C.orangeDark }}>
                        Restituição {restitComPGBL < 0 && '(IR a pagar)'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-base font-bold" style={{ color: restitSimpl >= 0 ? C.dark : C.orangeDark, opacity: 0.75 }}>
                        {restitSimpl >= 0 ? fmt(restitSimpl) : `-${fmt(Math.abs(restitSimpl))}`}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-base font-bold" style={{ color: restitSemPGBL >= 0 ? C.dark : C.orangeDark, opacity: 0.75 }}>
                        {restitSemPGBL >= 0 ? fmt(restitSemPGBL) : `-${fmt(Math.abs(restitSemPGBL))}`}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-base font-bold" style={{ color: restitComPGBL >= 0 ? C.green : C.orangeDark }}>
                        {restitComPGBL >= 0 ? fmt(restitComPGBL) : `-${fmt(Math.abs(restitComPGBL))}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  Comparamos com a <strong>Simplificada</strong>, que é o ponto de partida da maioria das pessoas. O <strong>IR retido na fonte</strong> é estimado pelo simulador, mas você pode editar manualmente pelo valor exato do seu informe de rendimentos. Restituição = IRRF − IR devido. Saúde, educação e PGBL não entram no IRRF — só no ajuste anual, gerando restituição.
                </span>
              </div>
            </div>

            {/* EFEITO MULTIPLICADOR — REINVESTINDO A ECONOMIA NO PGBL */}
            {pgblFazSentido && projecao && (
              <div className="rounded-2xl p-5 md:p-6 mb-5 relative overflow-hidden" style={{
                backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderLeft: `6px solid ${C.green}`,
              }}>
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
                  style={{ backgroundColor: 'rgba(22,163,74,0.06)' }} />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4" style={{ color: C.green }} />
                    <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.green }}>
                      O que muita gente não percebe
                    </div>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold mb-2" style={{ color: C.dark }}>
                    {fmt(economia)}/ano não parece muito. Mas reinvestido vira patrimônio.
                  </h3>
                  <p className="text-sm mb-4" style={{ color: '#475569' }}>
                    Se você pegar essa economia anual e aplicar no próprio PGBL (ou em qualquer investimento de longo prazo), veja o que acontece ao longo dos anos:
                  </p>

                  {/* Controles */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <InputCard label="Por quantos anos vai reinvestir" hint="O tempo trabalha a seu favor — quanto mais, melhor">
                      <NumField value={anosProjecao} onChange={setAnosProjecao} min={1} max={50} suffix="anos" />
                    </InputCard>
                    <InputCard label="Rentabilidade esperada (a.a.)" hint="Default 10% — média da renda fixa brasileira">
                      <NumField value={rentabAno} onChange={setRentabAno} min={1} max={30} suffix="% a.a." />
                    </InputCard>
                  </div>

                  {/* Resultado */}
                  <div className="rounded-xl p-5 mb-3" style={{ backgroundColor: C.greenBg, border: `1px solid #bbf7d0` }}>
                    <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.green }}>
                      Patrimônio acumulado em {anosProjecao} anos
                    </div>
                    <div className="text-3xl md:text-5xl font-bold tabular-nums leading-none mb-2" style={{ color: C.green }}>
                      {fmt(projecao.vf)}
                    </div>
                    <div className="text-sm" style={{ color: '#15803d' }}>
                      reinvestindo só a economia anual de IR ({fmt(economia)}/ano) a {rentabAno.toString().replace('.', ',')}% a.a.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>Total aportado</div>
                      <div className="text-lg font-bold tabular-nums" style={{ color: C.dark }}>{fmt(projecao.aportado)}</div>
                      <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                        {fmt(economia)} × {anosProjecao} anos
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>Rendimento</div>
                      <div className="text-lg font-bold tabular-nums" style={{ color: C.navy }}>{fmt(projecao.rendimento)}</div>
                      <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                        dos juros compostos
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>
                        Líquido após IR no resgate ({(projecao.aliquota * 100).toFixed(0)}%)
                      </div>
                      <div className="text-lg font-bold tabular-nums" style={{ color: C.green }}>{fmt(projecao.liquido)}</div>
                      <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                        IR sobre o total: {fmt(projecao.irResgate)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
                    <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.navy }} />
                    <div className="text-xs" style={{ color: C.navy }}>
                      <strong>Importante:</strong> no PGBL, o IR no resgate incide sobre o <strong>total acumulado</strong> (capital + rendimento), não só sobre o rendimento. Usamos a tabela regressiva: <strong>10% se {'>'} 10 anos</strong>, sobe até 35% pra prazos curtos. Por isso o PGBL faz sentido pra longo prazo. Se reinvestir em outro produto (CDB, Tesouro, fundo), o IR é só sobre o rendimento (~15%), o que muda os números.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RESSALVAS IMPORTANTES */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4" style={{ color: C.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.navy }}>
                  Pra você decidir bem
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs" style={{ color: C.navy }}>
                <div>
                  <div className="font-semibold mb-1" style={{ color: C.dark }}>Limite de 12% da renda</div>
                  Só dá pra deduzir até 12% da renda bruta tributável anual. Acima disso, o valor continua investido mas não gera benefício fiscal.
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: C.dark }}>Só vale na Completa</div>
                  O PGBL só reduz IR pra quem declara pela Completa. Quem usa a Simplificada (ou é isento) deveria considerar o VGBL.
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: C.dark }}>IR no resgate</div>
                  No futuro, quando resgatar o PGBL, o IR incide sobre o <strong>total acumulado</strong> (capital + rendimento). A alíquota varia conforme a tabela escolhida (regressiva começa em 35% e cai pra 10% após 10 anos; progressiva acompanha a tabela do IR vigente no resgate).
                </div>
              </div>
            </div>
          </>
        )}

        <div className="text-center text-[11px] mt-8 pb-4 px-4 leading-relaxed" style={{ color: C.textDim }}>
          Simulação baseada na tabela do IRPF e do INSS vigentes em 2026 (salário mínimo R$ 1.621,00, teto INSS R$ 8.475,55). A Lei 15.270/2025 criou redutor adicional pra rendas até R$ 88.200/ano que não está modelado aqui — pode reduzir ainda mais o IR pra rendas baixas. Não considera outras deduções específicas (pensão alimentícia judicial, livro-caixa, etc.) nem taxas de carregamento/administração do plano de previdência. Consulte seu contador antes de decisões fiscais relevantes.
        </div>
      </div>
    </div>
  );
}
