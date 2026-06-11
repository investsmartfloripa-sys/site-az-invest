"use client";

import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calculator, Trophy, Sparkles, Info, TrendingUp } from "lucide-react";

// ===== Helpers =====
const fmt = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtCompact = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')}M`;
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
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  textDim: '#64748b',
  textMore: '#94a3b8',
};

// ===== Componente: input numérico inteiro com máscara BR =====
const NumField = ({ value, onChange, min, max, prefix, suffix, width = 'w-full', size = 'text-base' }) => (
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
      className={`${size} font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right ${width}`}
      style={{ color: C.dark, borderColor: 'transparent' }}
      onFocusCapture={(e) => { e.target.style.borderColor = C.blue; e.target.style.backgroundColor = '#f8fafc'; }}
      onBlurCapture={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
    />
    {suffix && <span className="text-sm shrink-0" style={{ color: C.textDim }}>{suffix}</span>}
  </div>
);

// ===== Componente: input numérico com decimais (BR usa vírgula) =====
const NumFieldDecimal = ({ value, onChange, min, max, prefix, suffix, width = 'w-full', size = 'text-base' }) => {
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
        className={`${size} font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right ${width}`}
        style={{ color: C.dark, borderColor: 'transparent' }}
        onFocusCapture={(e) => { e.target.style.borderColor = C.blue; e.target.style.backgroundColor = '#f8fafc'; }}
        onBlurCapture={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
      />
      {suffix && <span className="text-sm shrink-0" style={{ color: C.textDim }}>{suffix}</span>}
    </div>
  );
};

// ===== Componente principal =====
export default function CalculadoraJurosCompostos() {
  const [aporteInicial, setAporteInicial] = useState(0);
  const [aporteMensal, setAporteMensal] = useState(0);
  const [periodoMeses, setPeriodoMeses] = useState(0);
  const [taxaJurosAno, setTaxaJurosAno] = useState(0);
  const [inflacaoAno, setInflacaoAno] = useState(0);

  const taxaMensal = Math.pow(1 + taxaJurosAno / 100, 1 / 12) - 1;
  const inflacaoMensal = Math.pow(1 + inflacaoAno / 100, 1 / 12) - 1;
  const temInflacao = inflacaoAno > 0;

  // ===== Evolução mês a mês =====
  const dadosMensais = useMemo(() => {
    const arr = [{ mes: 0, saldo: aporteInicial, aportado: aporteInicial }];
    let saldo = aporteInicial;
    let aportado = aporteInicial;
    for (let m = 1; m <= periodoMeses; m++) {
      saldo = saldo * (1 + taxaMensal) + aporteMensal;
      aportado += aporteMensal;
      arr.push({ mes: m, saldo, aportado });
    }
    return arr;
  }, [aporteInicial, aporteMensal, periodoMeses, taxaMensal]);

  // ===== Dados pro gráfico =====
  // Empilhamento (de baixo pra cima): Impacto da Inflação | Aportado | Rendimento (visual ajustado)
  // Total da pilha = saldo nominal. A inflação corrói visualmente da base, "comendo" o patrimônio.
  // No tooltip, mostramos os valores NOMINAIS de Aportado e Rendimento (cheios), não os visuais.
  const dadosGrafico = useMemo(() =>
    dadosMensais.map(d => {
      const fatorInfl = Math.pow(1 + inflacaoMensal, d.mes);
      const saldoReal = d.saldo / fatorInfl;
      const impactoInflacao = Math.max(0, d.saldo - saldoReal);
      const rendimentoNominal = d.saldo - d.aportado;
      // Visual: precisa caber na altura nominal, então rendimento e/ou aportado "cedem espaço" pro impacto
      let rendimentoVisual = rendimentoNominal - impactoInflacao;
      let aportadoVisual = d.aportado;
      if (rendimentoVisual < 0) {
        aportadoVisual = Math.max(0, d.aportado + rendimentoVisual);
        rendimentoVisual = 0;
      }
      return {
        mes: d.mes,
        'Impacto da Inflação': Math.round(impactoInflacao),
        Aportado: Math.round(aportadoVisual),
        Rendimento: Math.round(Math.max(0, rendimentoVisual)),
        _aportadoNominal: Math.round(d.aportado),
        _rendimentoNominal: Math.round(rendimentoNominal),
      };
    }), [dadosMensais, inflacaoMensal]);

  // ===== Tabela ano a ano com conquistas =====
  // Apenas 2 marcos: rendimento ultrapassa aportado, e primeiro milhão.
  const dadosAnuais = useMemo(() => {
    const totalAnos = Math.ceil(periodoMeses / 12);
    const arr = [];
    let superouCapital = false;
    let primeiroMilhao = false;

    for (let a = 1; a <= totalAnos; a++) {
      const mes = Math.min(a * 12, periodoMeses);
      const d = dadosMensais[mes];
      if (!d) continue;
      const aportado = d.aportado;
      const rendimento = d.saldo - aportado;
      const total = d.saldo;
      const rendaMensal = total * taxaMensal;
      const fatorInfl = Math.pow(1 + inflacaoMensal, mes);
      const totalReal = total / fatorInfl;
      // Renda real sustentável: taxa REAL de juros (equação de Fisher) aplicada ao patrimônio
      // deflacionado — quanto se pode sacar por mês preservando o poder de compra do patrimônio.
      const taxaRealMensal = (1 + taxaMensal) / (1 + inflacaoMensal) - 1;
      const rendaMensalReal = totalReal * taxaRealMensal;

      const conquistas = [];
      if (!superouCapital && rendimento > aportado) {
        conquistas.push('Seus rendimentos superaram o capital aportado!');
        superouCapital = true;
      }
      if (!primeiroMilhao && total >= 1000000) {
        conquistas.push('Você conquistou o primeiro milhão!');
        primeiroMilhao = true;
      }

      arr.push({ ano: a, aportado, rendimento, total, rendaMensal, totalReal, rendaMensalReal, conquistas });
    }
    return arr;
  }, [dadosMensais, taxaMensal, inflacaoMensal, periodoMeses]);

  const totalFinal = dadosMensais[dadosMensais.length - 1] || { saldo: 0, aportado: 0 };
  const rendimentoFinal = totalFinal.saldo - totalFinal.aportado;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff', color: C.dark }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* HEADER */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: C.blueBgSoft, color: C.navy, border: `1px solid ${C.blueBg}` }}>
            <Calculator className="w-3.5 h-3.5" />
            Calculadora de Juros Compostos
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 leading-[1.1]">
            Veja seu dinheiro <span style={{ color: C.navy }}>se multiplicar no tempo</span>.
          </h1>
          <p className="text-base max-w-2xl" style={{ color: C.textDim }}>
            Simule aportes mensais, juros compostos e o impacto da inflação ao longo dos anos.
          </p>
        </div>

        {/* INPUTS */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: C.textDim }}>
                Aporte Inicial
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                <NumField value={aporteInicial} onChange={setAporteInicial} min={0} max={1000000000} prefix="R$" />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: C.textDim }}>
                Aporte Mensal
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                <NumField value={aporteMensal} onChange={setAporteMensal} min={0} max={10000000} prefix="R$" />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: C.textDim }}>
                Período em Meses
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                <NumField value={periodoMeses} onChange={setPeriodoMeses} min={0} max={1200} suffix="meses" />
              </div>
              <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                {(periodoMeses / 12).toFixed(periodoMeses % 12 === 0 ? 0 : 1).replace('.', ',')} {periodoMeses === 0 || periodoMeses >= 24 ? 'anos' : 'ano'}
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: C.textDim }}>
                Taxa de Juros ao Ano
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                <NumFieldDecimal value={taxaJurosAno} onChange={setTaxaJurosAno} min={0} max={100} suffix="%" />
              </div>
              <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                {(taxaMensal * 100).toFixed(2).replace('.', ',')}% ao mês
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: C.textDim }}>
                Inflação ao Ano
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
                <NumFieldDecimal value={inflacaoAno} onChange={setInflacaoAno} min={0} max={50} suffix="%" />
              </div>
              <div className="text-[11px] mt-1" style={{ color: C.textDim }}>
                {(inflacaoMensal * 100).toFixed(2).replace('.', ',')}% ao mês
              </div>
            </div>
          </div>
        </div>

        {periodoMeses === 0 ? (
          <div className="rounded-2xl p-12 md:p-16 text-center" style={{ backgroundColor: '#f8fafc', border: `1px dashed ${C.border}` }}>
            <Calculator className="w-12 h-12 mx-auto mb-4" style={{ color: C.textMore }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: C.dark }}>Preencha os valores acima</h3>
            <p className="text-sm" style={{ color: C.textDim }}>Insira ao menos o período em meses e a taxa de juros para ver a simulação.</p>
          </div>
        ) : (
        <>
        {/* RESUMO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{
            backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderLeft: `6px solid ${C.orange}`,
          }}>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: 'rgba(255,87,19,0.06)' }} />
            <div className="relative">
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>
                Total Acumulado
              </div>
              <div className="text-3xl md:text-4xl font-bold tabular-nums leading-none" style={{ color: C.orange }}>
                {fmt(totalFinal.saldo)}
              </div>
              <div className="text-[11px] mt-2" style={{ color: C.textDim }}>
                em {periodoMeses} meses
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${C.border}` }}>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.textDim }}>
              Total Aportado
            </div>
            <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: C.dark }}>
              {fmt(totalFinal.aportado)}
            </div>
            <div className="text-[11px] mt-2" style={{ color: C.textDim }}>
              do seu bolso
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.navy }}>
              Rendimento
            </div>
            <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: C.navy }}>
              {fmt(rendimentoFinal)}
            </div>
            <div className="text-[11px] mt-2" style={{ color: C.navy }}>
              {totalFinal.saldo > 0 ? ((rendimentoFinal / totalFinal.saldo) * 100).toFixed(1) : 0}% do total
            </div>
          </div>
        </div>

        {/* GRÁFICO */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4" style={{ color: C.navy }} />
            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
              Evolução do patrimônio
            </div>
          </div>
          <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>Mês a mês</h3>

          <div className="flex items-center justify-center flex-wrap gap-4 mb-3 text-xs" style={{ color: '#475569' }}>
            {temInflacao && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: C.orange }} />
                <span>Impacto da Inflação</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: C.textMore }} />
              <span>Valor Aportado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: C.navy }} />
              <span>Rendimento</span>
            </div>
          </div>

          <div className="rounded-xl p-3 md:p-4 h-80 md:h-96" style={{ backgroundColor: '#f8fafc' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }}
                  label={{ value: 'Meses', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px' }}
                  formatter={(value, name, props) => {
                    if (name === 'Rendimento' && props.payload?._rendimentoNominal !== undefined) {
                      return [fmt(props.payload._rendimentoNominal), 'Rendimento'];
                    }
                    if (name === 'Aportado' && props.payload?._aportadoNominal !== undefined) {
                      return [fmt(props.payload._aportadoNominal), 'Aportado'];
                    }
                    return [fmt(value), name];
                  }}
                  labelFormatter={(v) => `Mês ${v}`}
                />
                {temInflacao && <Bar dataKey="Impacto da Inflação" stackId="a" fill={C.orange} />}
                <Bar dataKey="Aportado" stackId="a" fill={C.textMore} />
                <Bar dataKey="Rendimento" stackId="a" fill={C.navy} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {temInflacao && (
            <div className="mt-3 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>A barra laranja na base mostra quanto do seu patrimônio nominal foi <strong>corroído pela inflação</strong>. Aportado e Rendimento na caixa de detalhes (ao passar o mouse) aparecem em valores nominais — o que de fato entrou e o que de fato rendeu.</span>
            </div>
          )}
        </div>

        {/* TABELA ANUAL */}
        <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4" style={{ color: C.navy }} />
            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>
              Evolução ano a ano
            </div>
          </div>
          <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>Sua jornada de patrimônio</h3>

          <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Ano</th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Aportado</th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Rendimento</th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Total</th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Renda Mensal</th>
                  <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Conquistas</th>
                  {temInflacao && (
                    <>
                      <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Total Real</th>
                      <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.textDim }}>Renda Real</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {dadosAnuais.map((d) => {
                  const tem = d.conquistas.length > 0;
                  return (
                    <tr key={d.ano} style={{
                      borderBottom: `1px solid ${C.borderSoft}`,
                      backgroundColor: tem ? C.orangeBgSoft : 'transparent',
                    }}>
                      <td className="py-3 px-3 font-bold tabular-nums" style={{ color: tem ? C.orangeDark : C.dark }}>
                        {d.ano}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.aportado)}</td>
                      <td className="py-3 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.rendimento)}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: tem ? C.orangeDark : C.dark }}>
                        {fmt(d.total)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.rendaMensal)}</td>
                      <td className="py-3 px-3" style={{ color: C.orangeDark }}>
                        {tem && (
                          <div className="text-xs font-semibold flex items-start gap-1.5">
                            <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{d.conquistas.join(' • ')}</span>
                          </div>
                        )}
                      </td>
                      {temInflacao && (
                        <>
                          <td className="py-3 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.totalReal)}</td>
                          <td className="py-3 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.rendaMensalReal)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {temInflacao && (
            <div className="mt-4 text-[11px] flex items-start gap-1.5" style={{ color: C.textDim }}>
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span><strong>Total Real</strong> é o patrimônio descontada a inflação informada (poder de compra de hoje). <strong>Renda Real</strong> é a renda mensal que você poderia sacar preservando o poder de compra do patrimônio — calculada com a taxa real de juros (juros descontada a inflação) sobre o Total Real.</span>
            </div>
          )}
        </div>
        </>
        )}

        <div className="text-center text-[11px] mt-8 pb-4 px-4 leading-relaxed" style={{ color: C.textDim }}>
          Simulação meramente ilustrativa. Rentabilidade passada não garante rentabilidade futura. Considere taxas, impostos e perfil de investimento real.
        </div>
      </div>
    </div>
  );
}
