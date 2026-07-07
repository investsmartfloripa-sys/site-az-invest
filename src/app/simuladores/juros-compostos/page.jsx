"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calculator, Info, TrendingUp } from "lucide-react";
import { CATEGORIAS } from "@/data/simuladores";
import { SIM, SIM_CHART } from "@/lib/simulador-theme";
import { NumField, NumFieldDecimal, fmtBRL as fmt, fmtCompacto as fmtCompact } from "@/components/simuladores/ui";

// Categoria do simulador (accent visual — não altera nenhum cálculo)
const CAT = CATEGORIAS.investir;

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

  // ===== Evolução mês a mês (nominal + real deflacionado) =====
  // saldoReal = saldo nominal deflacionado por (1+infl)^m → poder de compra de hoje.
  // aportadoReal = soma de cada aporte trazido a valor presente (deflacionado no mês em que foi feito).
  // Por construção, saldoReal = aportadoReal + rendimentoReal, tudo em moeda de hoje.
  const dadosMensais = useMemo(() => {
    const arr = [{ mes: 0, saldo: aporteInicial, aportado: aporteInicial, saldoReal: aporteInicial, aportadoReal: aporteInicial }];
    let saldo = aporteInicial;
    let aportado = aporteInicial;
    let aportadoReal = aporteInicial;
    for (let m = 1; m <= periodoMeses; m++) {
      saldo = saldo * (1 + taxaMensal) + aporteMensal;
      aportado += aporteMensal;
      const fator = Math.pow(1 + inflacaoMensal, m);
      aportadoReal += aporteMensal / fator;
      arr.push({ mes: m, saldo, aportado, saldoReal: saldo / fator, aportadoReal });
    }
    return arr;
  }, [aporteInicial, aporteMensal, periodoMeses, taxaMensal, inflacaoMensal]);

  // ===== Dados pro gráfico de linhas =====
  // Três séries honestas: total nominal, total real (poder de compra de hoje) e o aportado.
  // A distância entre a linha nominal e a real é, visualmente, a corrosão da inflação.
  const dadosGrafico = useMemo(() =>
    dadosMensais.map((d) => ({
      mes: d.mes,
      aportado: Math.round(d.aportado),
      totalNominal: Math.round(d.saldo),
      totalReal: Math.round(d.saldoReal),
    })), [dadosMensais]);

  // Domínio do eixo Y: não força zero. Começa um pouco abaixo do menor valor
  // (tipicamente o aporte inicial) pra curva não ficar espremida no topo quando
  // o crescimento é pequeno em relação ao valor inicial. Só cai a zero quando o
  // aporte inicial já é pequeno perto do total (aí o zero é natural).
  const yDomain = useMemo(() => {
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const d of dadosGrafico) {
      const vals = temInflacao ? [d.aportado, d.totalNominal, d.totalReal] : [d.aportado, d.totalNominal];
      for (const v of vals) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    if (!isFinite(minVal)) return [0, 'auto'];
    const span = (maxVal - minVal) || maxVal || 1;
    const piso = Math.max(0, Math.floor(minVal - span * 0.08));
    return [piso, 'auto'];
  }, [dadosGrafico, temInflacao]);

  // ===== Tabela ano a ano =====
  // Consolidada: nominais + a coluna de Saldo real (quando há inflação). Sem marcos/destaques.
  const dadosAnuais = useMemo(() => {
    const totalAnos = Math.ceil(periodoMeses / 12);
    const arr = [];
    for (let a = 1; a <= totalAnos; a++) {
      const mes = Math.min(a * 12, periodoMeses);
      const mesPrev = Math.min((a - 1) * 12, periodoMeses);
      const d = dadosMensais[mes];
      const dPrev = dadosMensais[mesPrev];
      if (!d || !dPrev) continue;

      const aporteAno = d.aportado - dPrev.aportado;
      const jurosAno = (d.saldo - dPrev.saldo) - aporteAno;
      const rendaMensal = d.saldo * taxaMensal;

      arr.push({ ano: a, aporteAno, jurosAno, saldo: d.saldo, saldoReal: d.saldoReal, rendaMensal });
    }
    return arr;
  }, [dadosMensais, taxaMensal, periodoMeses]);

  const ult = dadosMensais[dadosMensais.length - 1] || { saldo: 0, aportado: 0, saldoReal: 0, aportadoReal: 0 };
  const rendimentoNominal = ult.saldo - ult.aportado;
  const rendimentoReal = ult.saldoReal - ult.aportadoReal;
  const pctRendimento = ult.saldo > 0 ? (rendimentoNominal / ult.saldo) * 100 : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff', color: SIM.dark, borderTop: `4px solid ${CAT.cor}` }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* HEADER */}
        <div className="mb-8">
          <div className="mb-4">
            <Link href="/simuladores" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: SIM.textDim }}>
              <span aria-hidden>←</span> Todos os simuladores
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ backgroundColor: `${CAT.cor}14`, color: CAT.cor, border: `1px solid ${CAT.cor}33` }}>
            <Calculator className="w-3.5 h-3.5" />
            {CAT.nome}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 leading-[1.1]">
            Veja seu dinheiro <span style={{ color: SIM.navy }}>se multiplicar no tempo</span>.
          </h1>
          <p className="text-base max-w-2xl" style={{ color: SIM.textDim }}>
            Simule aportes mensais, juros compostos e o impacto da inflação ao longo dos anos.
          </p>
        </div>

        {/* INPUTS */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${SIM.border}` }}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: SIM.textDim }}>
                Aporte Inicial
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
                <NumField value={aporteInicial} onChange={setAporteInicial} min={0} max={1000000000} prefix="R$" />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: SIM.textDim }}>
                Aporte Mensal
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
                <NumField value={aporteMensal} onChange={setAporteMensal} min={0} max={10000000} prefix="R$" />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: SIM.textDim }}>
                Período em Meses
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
                <NumField value={periodoMeses} onChange={setPeriodoMeses} min={0} max={1200} suffix="meses" />
              </div>
              <div className="text-[11px] mt-1" style={{ color: SIM.textDim }}>
                {(periodoMeses / 12).toFixed(periodoMeses % 12 === 0 ? 0 : 1).replace('.', ',')} {periodoMeses === 0 || periodoMeses >= 24 ? 'anos' : 'ano'}
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: SIM.textDim }}>
                Taxa de Juros ao Ano
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
                <NumFieldDecimal value={taxaJurosAno} onChange={setTaxaJurosAno} min={0} max={100} suffix="%" />
              </div>
              <div className="text-[11px] mt-1" style={{ color: SIM.textDim }}>
                {(taxaMensal * 100).toFixed(2).replace('.', ',')}% ao mês
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: SIM.textDim }}>
                Inflação ao Ano
              </label>
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
                <NumFieldDecimal value={inflacaoAno} onChange={setInflacaoAno} min={0} max={50} suffix="%" />
              </div>
              <div className="text-[11px] mt-1" style={{ color: SIM.textDim }}>
                {(inflacaoMensal * 100).toFixed(2).replace('.', ',')}% ao mês
              </div>
            </div>
          </div>
        </div>

        {periodoMeses === 0 ? (
          <div className="rounded-2xl p-12 md:p-16 text-center" style={{ backgroundColor: '#f8fafc', border: `1px dashed ${SIM.border}` }}>
            <Calculator className="w-12 h-12 mx-auto mb-4" style={{ color: SIM.textMore }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: SIM.dark }}>Preencha os valores acima</h3>
            <p className="text-sm" style={{ color: SIM.textDim }}>Insira ao menos o período em meses e a taxa de juros para ver a simulação.</p>
          </div>
        ) : (
        <>
        {/* EXPLICAÇÃO NOMINAL x REAL — sempre visível quando há inflação */}
        {temInflacao && (
          <div className="flex items-start gap-1.5 mb-5 text-xs" style={{ color: SIM.textDim }}>
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: SIM.navy }} />
            <span>
              Mostramos os valores <strong style={{ color: SIM.dark }}>nominais</strong> (de face, o número que aparece na conta lá na frente) e, ao lado, os <strong style={{ color: SIM.dark }}>reais</strong> — o mesmo patrimônio em poder de compra de hoje, já descontada a inflação de {inflacaoAno.toString().replace('.', ',')}% ao ano.
            </span>
          </div>
        )}

        {/* RESUMO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{
            backgroundColor: '#ffffff', border: `1px solid ${SIM.border}`, borderLeft: `6px solid ${SIM.orange}`,
          }}>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: 'rgba(255,87,19,0.06)' }} />
            <div className="relative">
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: SIM.textDim }}>
                Total Acumulado
              </div>
              <div className="text-3xl md:text-4xl font-bold tabular-nums leading-none" style={{ color: SIM.orange }}>
                {fmt(ult.saldo)}
              </div>
              <div className="text-[11px] mt-2" style={{ color: SIM.textDim }}>
                {temInflacao ? <><strong style={{ color: SIM.dark }}>{fmt(ult.saldoReal)}</strong> em poder de compra de hoje</> : `em ${periodoMeses} meses`}
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: SIM.textDim }}>
              Total Aportado
            </div>
            <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: SIM.dark }}>
              {fmt(ult.aportado)}
            </div>
            <div className="text-[11px] mt-2" style={{ color: SIM.textDim }}>
              {temInflacao ? <><strong style={{ color: SIM.dark }}>{fmt(ult.aportadoReal)}</strong> a valor de hoje</> : 'do seu bolso'}
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: SIM.blueBgSoft, border: `1px solid ${SIM.blueBg}` }}>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: SIM.navy }}>
              Rendimento
            </div>
            <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: SIM.navy }}>
              {fmt(rendimentoNominal)}
            </div>
            <div className="text-[11px] mt-2" style={{ color: SIM.navy }}>
              {pctRendimento.toFixed(1).replace('.', ',')}% do total{temInflacao ? <> · <strong>{fmt(rendimentoReal)}</strong> a valor de hoje</> : ''}
            </div>
          </div>
        </div>

        {/* GRÁFICO */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${SIM.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4" style={{ color: SIM.navy }} />
            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>
              Evolução do patrimônio
            </div>
          </div>
          <h3 className="text-xl font-bold mb-4" style={{ color: SIM.dark }}>
            {temInflacao ? 'Nominal vs. real ao longo do tempo' : 'Mês a mês'}
          </h3>

          <div className="flex items-center justify-center flex-wrap gap-4 mb-3 text-xs" style={{ color: '#475569' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: SIM.navy }} />
              <span>Total nominal</span>
            </div>
            {temInflacao && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0" style={{ borderTop: `2px dashed ${SIM.blue}` }} />
                <span>Total real</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: SIM.textMore }} />
              <span>Aportado</span>
            </div>
          </div>

          <div className="rounded-xl p-3 md:p-4 h-80 md:h-96" style={{ backgroundColor: '#f8fafc' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosGrafico} margin={{ top: 10, right: 12, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={SIM_CHART.grid} vertical={false} />
                <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }}
                  label={{ value: 'Meses', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} width={54} domain={yDomain} allowDataOverflow />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: `1px solid ${SIM.border}`, borderRadius: '8px' }}
                  formatter={(value, name) => [fmt(value), name]}
                  labelFormatter={(v) => `Mês ${v}`}
                />
                <Line type="monotone" dataKey="totalNominal" name="Total nominal" stroke={SIM.navy}
                  strokeWidth={3} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                {temInflacao && (
                  <Line type="monotone" dataKey="totalReal" name="Total real" stroke={SIM.blue}
                    strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                )}
                <Line type="monotone" dataKey="aportado" name="Aportado" stroke={SIM.textMore}
                  strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {temInflacao && (
            <div className="mt-3 text-[11px] flex items-start gap-1.5" style={{ color: SIM.textDim }}>
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>A linha tracejada é o <strong>total real</strong> — o mesmo patrimônio em poder de compra de hoje. A distância dela até a linha nominal é exatamente o quanto a <strong>inflação corrói</strong> ao longo do tempo.</span>
            </div>
          )}
        </div>

        {/* TABELA ANUAL */}
        <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: '#ffffff', border: `1px solid ${SIM.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-4 h-4" style={{ color: SIM.navy }} />
            <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>
              Evolução ano a ano
            </div>
          </div>
          <h3 className="text-xl font-bold mb-1" style={{ color: SIM.dark }}>Quando os juros passam a trabalhar por você</h3>
          <p className="text-sm mb-4" style={{ color: SIM.textDim }}>
            {temInflacao ? 'Aportes e juros em valores nominais, com o saldo real (poder de compra de hoje) ao lado.' : 'Valores nominais.'}
          </p>

          <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr style={{ borderBottom: `2px solid ${SIM.border}` }}>
                  <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>Ano</th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>Aporte no ano</th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>Juros no ano</th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>Saldo</th>
                  {temInflacao && (
                    <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>Saldo Real</th>
                  )}
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>Renda Mensal</th>
                </tr>
              </thead>
              <tbody>
                {dadosAnuais.map((d) => (
                  <tr key={d.ano} style={{ borderBottom: `1px solid ${SIM.borderSoft}` }}>
                    <td className="py-3 px-3 font-bold tabular-nums" style={{ color: SIM.dark }}>{d.ano}</td>
                    <td className="py-3 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.aporteAno)}</td>
                    <td className="py-3 px-3 text-right tabular-nums" style={{ color: SIM.navy }}>{fmt(d.jurosAno)}</td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: SIM.dark }}>{fmt(d.saldo)}</td>
                    {temInflacao && (
                      <td className="py-3 px-3 text-right tabular-nums" style={{ color: SIM.blue }}>{fmt(d.saldoReal)}</td>
                    )}
                    <td className="py-3 px-3 text-right tabular-nums" style={{ color: '#475569' }}>{fmt(d.rendaMensal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-[11px] flex items-start gap-1.5" style={{ color: SIM.textDim }}>
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              {temInflacao ? <><strong>Saldo Real</strong> é o patrimônio em poder de compra de hoje (descontada a inflação). </> : null}
              <strong>Renda Mensal</strong> é quanto o saldo renderia por mês só de juros, sem consumir o principal.
            </span>
          </div>
        </div>
        </>
        )}

        <div className="text-center text-[11px] mt-8 pb-4 px-4 leading-relaxed" style={{ color: SIM.textDim }}>
          Simulação meramente ilustrativa. Rentabilidade passada não garante rentabilidade futura. Considere taxas, impostos e perfil de investimento real.
        </div>
      </div>
    </div>
  );
}
