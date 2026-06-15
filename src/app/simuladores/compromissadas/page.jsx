"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, Info, Briefcase, Zap, PiggyBank, Settings2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { CATEGORIAS } from "@/data/simuladores";
import { SIM } from "@/lib/simulador-theme";
import { NumField, NumFieldDecimal, fmtBRL as fmt } from "@/components/simuladores/ui";

// Categoria do simulador (accent visual — não altera nenhum cálculo)
const CAT = CATEGORIAS.investir;

// ===== Helpers =====
const fmtCents = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

// Verde de sucesso — não faz parte da paleta de marca (SIM); mantido localmente.
const GREEN = '#16a34a';
const GREEN_BG = '#f0fdf4';

// ===== Tabela IOF regressiva (% sobre rendimento, por dia corrido) =====
const TABELA_IOF = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66,
  63, 60, 56, 53, 50, 46, 43, 40, 36, 33,
  30, 26, 23, 20, 16, 13, 10,  6,  3,  0,
];
function getIOFPercent(diasCorridos) {
  if (diasCorridos <= 0) return 0;
  if (diasCorridos >= 30) return 0;
  return TABELA_IOF[diasCorridos - 1] / 100;
}

function getIRPercent(diasCorridos) {
  if (diasCorridos <= 180) return 0.225;
  if (diasCorridos <= 360) return 0.20;
  if (diasCorridos <= 720) return 0.175;
  return 0.15;
}

// ===== Inputs =====
const InputCard = ({ label, hint, children }) => (
  <div>
    <label className="text-[11px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: SIM.textDim }}>
      {label}
    </label>
    <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
      {children}
    </div>
    {hint && <div className="text-[11px] mt-1" style={{ color: SIM.textDim }}>{hint}</div>}
  </div>
);

function calcDia(valor, dias, cdiAno, pctCDI, isentoIOF = false) {
  // Convenção B3/CDI: capitalização por dias ÚTEIS na base 252.
  // Aproximação dias corridos -> dias úteis pela proporção 252/365 (~21 DU em 30 corridos).
  const diasUteis = Math.max(1, Math.round(dias * (252 / 365)));
  // % do CDI aplicado sobre a taxa DIÁRIA (convenção de mercado), não sobre a anual.
  const taxaDiaria = (Math.pow(1 + cdiAno / 100, 1 / 252) - 1) * (pctCDI / 100);
  const montanteBruto = valor * Math.pow(1 + taxaDiaria, diasUteis);
  const rendimentoBruto = montanteBruto - valor;
  // IOF e IR seguem apurados por dias CORRIDOS (regra fiscal).
  const iof = isentoIOF ? 0 : rendimentoBruto * getIOFPercent(dias);
  const ir = Math.max(0, (rendimentoBruto - iof) * getIRPercent(dias));
  const liquido = rendimentoBruto - iof - ir;
  return { bruto: rendimentoBruto, iof, ir, liquido, valorFinal: valor + liquido };
}

export default function SimuladorCompromissadas() {
  const [valor, setValor] = useState(0);
  const [pctCompromissada, setPctCompromissada] = useState(95);
  const [pctCDB, setPctCDB] = useState(100);
  const [cdiAno, setCdiAno] = useState(13);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  // Regra geral (Decreto 6.306/2007, art. 32): compromissada PAGA IOF regressivo em resgates < 30 dias.
  // Isenção só para lastro em debêntures de emissor fora do grupo econômico do banco.
  const [isentaIOF, setIsentaIOF] = useState(false);

  // Conta remunerada fixa em 10% do CDI (padrão dos grandes bancos)
  const pctContaRem = 10;

  const podeCalcular = valor > 0 && cdiAno > 0;

  const HORIZONTE = 30;
  const serie = useMemo(() => {
    if (!podeCalcular) return [];
    const arr = [];
    for (let d = 1; d <= HORIZONTE; d++) {
      const compr = calcDia(valor, d, cdiAno, pctCompromissada, isentaIOF); // IOF conforme o lastro (regra geral: paga IOF)
      const cdb = calcDia(valor, d, cdiAno, pctCDB);
      const contaRem = calcDia(valor, d, cdiAno, pctContaRem, true); // conta remunerada isenta de IOF
      arr.push({
        dia: d,
        compromissada: Math.round(compr.liquido),
        cdb: Math.round(cdb.liquido),
        contaRem: Math.round(contaRem.liquido),
        diferenca: Math.round(cdb.liquido - compr.liquido),
        comprBruto: compr.bruto,
        comprIof: compr.iof,
        comprIr: compr.ir,
        comprLiq: compr.liquido,
        cdbBruto: cdb.bruto,
        cdbIof: cdb.iof,
        cdbIr: cdb.ir,
        cdbLiq: cdb.liquido,
        contaRemBruto: contaRem.bruto,
        contaRemIr: contaRem.ir,
        contaRemLiq: contaRem.liquido,
      });
    }
    return arr;
  }, [valor, cdiAno, pctCompromissada, pctCDB, pctContaRem, podeCalcular, isentaIOF]);

  const diasChave = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30];

  // Encontra o dia em que o CDB ultrapassa a compromissada (cruzamento)
  const diaCruzamento = useMemo(() => {
    if (!serie.length) return null;
    // Procura o primeiro dia em que CDB líquido > Compromissada líquido
    for (let i = 0; i < serie.length; i++) {
      if (serie[i].cdbLiq > serie[i].comprLiq) return serie[i].dia;
    }
    return null;
  }, [serie]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const labelMap = { compromissada: 'Compromissada', cdb: 'CDB', contaRem: 'Conta Remunerada' };
    return (
      <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#ffffff', border: `1px solid ${SIM.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div className="font-semibold mb-1" style={{ color: SIM.dark }}>Dia {label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3" style={{ color: p.color }}>
            <span>{labelMap[p.dataKey]}:</span>
            <span className="font-bold tabular-nums">{fmtCents(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

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
            <Zap className="w-3.5 h-3.5" />
            {CAT.nome}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 leading-[1.1]">
            Caixa parado de 1 a 30 dias? <span style={{ color: SIM.navy }}>Compare compromissada e CDB dia a dia.</span>
          </h1>
          <p className="text-base max-w-2xl" style={{ color: SIM.textDim }}>
            Para capital de giro que vai e volta em dias, compare compromissada e CDB já com IOF e IR descontados. Veja exatamente quanto rende cada dia.
          </p>
        </div>

        {/* INPUTS — 3 campos */}
        <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${SIM.border}` }}>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4" style={{ color: SIM.navy }} />
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: SIM.dark }}>
                Compare as duas opções
              </div>
            </div>
            <button onClick={() => setMostrarConfig(!mostrarConfig)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:opacity-70"
              style={{ color: SIM.textDim }}>
              <Settings2 className="w-3.5 h-3.5" />
              CDI: {cdiAno.toString().replace('.', ',')}% a.a.
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputCard label="Quanto você quer aplicar" hint="Valor do aporte na operação">
              <NumField value={valor} onChange={setValor} min={0} max={1000000000} prefix="R$" />
            </InputCard>
            <div>
              <InputCard label="Compromissada (% do CDI)" hint="Tipicamente 50% a 100% do CDI">
                <NumFieldDecimal value={pctCompromissada} onChange={setPctCompromissada} min={0} max={200} suffix="% CDI" />
              </InputCard>
              <label className="flex items-start gap-1.5 text-[11px] mt-1.5 cursor-pointer" style={{ color: SIM.textDim }}>
                <input
                  type="checkbox"
                  checked={isentaIOF}
                  onChange={(e) => setIsentaIOF(e.target.checked)}
                  className="mt-0.5 shrink-0"
                />
                <span>Isenta de IOF (lastro em debêntures de emissor fora do grupo do banco)</span>
              </label>
            </div>
            <InputCard label="CDB (% do CDI)" hint="Bancos médios chegam a 110%+. Grandes bancos 95–100%">
              <NumFieldDecimal value={pctCDB} onChange={setPctCDB} min={0} max={200} suffix="% CDI" />
            </InputCard>
          </div>

          {mostrarConfig && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${SIM.borderSoft}` }}>
              <div className="max-w-xs">
                <InputCard label="Taxa CDI anual" hint="Acompanha a Selic. Atualize se quiser projetar com outra premissa.">
                  <NumFieldDecimal value={cdiAno} onChange={setCdiAno} min={0} max={50} suffix="% a.a." />
                </InputCard>
              </div>
            </div>
          )}
        </div>

        {/* RESULTADO */}
        {!podeCalcular ? (
          <div className="rounded-2xl p-12 md:p-16 text-center" style={{ backgroundColor: '#f8fafc', border: `1px dashed ${SIM.border}` }}>
            <Wallet className="w-12 h-12 mx-auto mb-4" style={{ color: SIM.textMore }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: SIM.dark }}>Preencha o valor para começar</h3>
            <p className="text-sm" style={{ color: SIM.textDim }}>Informe quanto você quer aplicar.</p>
          </div>
        ) : (
          <>
            {/* GRÁFICO */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${SIM.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4" style={{ color: SIM.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>
                  Evolução do rendimento
                </div>
              </div>
              <h3 className="text-xl font-bold mb-1" style={{ color: SIM.dark }}>Quanto rende cada um nos primeiros 30 dias</h3>
              <p className="text-sm mb-4" style={{ color: SIM.textDim }}>
                {diaCruzamento === null
                  ? <>Para prazos curtos até 30 dias, sua compromissada ({pctCompromissada.toString().replace('.', ',')}% CDI{isentaIOF ? ', isenta de IOF' : ''}) <strong>vence o CDB ({pctCDB.toString().replace('.', ',')}% CDI) todos os dias</strong>. Para capital de giro de PJ, tende a ser a melhor escolha.</>
                  : diaCruzamento === 1
                    ? <>Seu CDB ({pctCDB.toString().replace('.', ',')}% CDI) já supera a compromissada ({pctCompromissada.toString().replace('.', ',')}% CDI) desde o dia 1{isentaIOF ? ' — a taxa do CDB é alta o suficiente para absorver o IOF desde o início' : ''}. Mas confira o FGC do banco emissor.</>
                    : <>A compromissada {isentaIOF ? '(isenta de IOF) ' : ''}vence nos primeiros dias. Mas como o CDB tem taxa maior, ele cresce mais rápido. <strong>A partir do dia {diaCruzamento}, o CDB ultrapassa</strong>. Se o caixa volta antes disso, fica na compromissada.</>}
              </p>

              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={serie} margin={{ top: 25, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={SIM.borderSoft} />
                    <XAxis
                      dataKey="dia"
                      stroke={SIM.textDim}
                      style={{ fontSize: '11px' }}
                      ticks={[1, 5, 10, 15, 20, 25, 30]}
                      label={{ value: 'Dias corridos', position: 'insideBottom', offset: -2, style: { fontSize: '11px', fill: SIM.textDim } }}
                    />
                    <YAxis
                      stroke={SIM.textDim}
                      style={{ fontSize: '11px' }}
                      tickFormatter={(v) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k` : `R$ ${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    {diaCruzamento && diaCruzamento > 1 && diaCruzamento <= 30 && (
                      <ReferenceLine
                        x={diaCruzamento}
                        stroke={GREEN}
                        strokeDasharray="4 4"
                        label={{
                          value: 'CDB ultrapassa',
                          fill: GREEN,
                          fontSize: 11,
                          fontWeight: 600,
                          position: 'insideTop',
                          offset: 8,
                          dx: diaCruzamento > 25 ? -50 : 5,
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="compromissada"
                      name="Compromissada"
                      stroke={SIM.orange}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cdb"
                      name="CDB"
                      stroke={SIM.navy}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="contaRem"
                      name="Conta Remunerada"
                      stroke={SIM.textMore}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
                  <div className="font-semibold mb-1" style={{ color: SIM.orange }}>Em 1 dia</div>
                  <div className="space-y-0.5" style={{ color: '#475569' }}>
                    <div className="flex justify-between gap-2"><span>Compromissada:</span><strong className="tabular-nums">{fmtCents(serie[0]?.comprLiq || 0)}</strong></div>
                    <div className="flex justify-between gap-2"><span>CDB:</span><strong className="tabular-nums">{fmtCents(serie[0]?.cdbLiq || 0)}</strong></div>
                    <div className="flex justify-between gap-2" style={{ color: SIM.textMore }}><span>Conta remun.:</span><strong className="tabular-nums">{fmtCents(serie[0]?.contaRemLiq || 0)}</strong></div>
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
                  <div className="font-semibold mb-1" style={{ color: SIM.navy }}>Em 7 dias</div>
                  <div className="space-y-0.5" style={{ color: '#475569' }}>
                    <div className="flex justify-between gap-2"><span>Compromissada:</span><strong className="tabular-nums">{fmtCents(serie[6]?.comprLiq || 0)}</strong></div>
                    <div className="flex justify-between gap-2"><span>CDB:</span><strong className="tabular-nums">{fmtCents(serie[6]?.cdbLiq || 0)}</strong></div>
                    <div className="flex justify-between gap-2" style={{ color: SIM.textMore }}><span>Conta remun.:</span><strong className="tabular-nums">{fmtCents(serie[6]?.contaRemLiq || 0)}</strong></div>
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#f8fafc', border: `1px solid ${SIM.border}` }}>
                  <div className="font-semibold mb-1" style={{ color: GREEN }}>Em 30 dias</div>
                  <div className="space-y-0.5" style={{ color: '#475569' }}>
                    <div className="flex justify-between gap-2"><span>Compromissada:</span><strong className="tabular-nums">{fmtCents(serie[29]?.comprLiq || 0)}</strong></div>
                    <div className="flex justify-between gap-2"><span>CDB:</span><strong className="tabular-nums">{fmtCents(serie[29]?.cdbLiq || 0)}</strong></div>
                    <div className="flex justify-between gap-2" style={{ color: SIM.textMore }}><span>Conta remun.:</span><strong className="tabular-nums">{fmtCents(serie[29]?.contaRemLiq || 0)}</strong></div>
                  </div>
                </div>
              </div>

              {/* Vantagem vs conta remunerada — call-out */}
              {serie[29] && serie[29].comprLiq > serie[29].contaRemLiq && (
                <div className="mt-3 rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: GREEN_BG, border: `1px solid #bbf7d0` }}>
                  <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GREEN }} />
                  <div className="text-xs" style={{ color: '#14532d' }}>
                    <strong>Em 30 dias, a compromissada rende {fmtCents(serie[29].comprLiq - serie[29].contaRemLiq)} a mais que a conta remunerada padrão dos grandes bancos.</strong> Rotacionando esse caixa ao longo de um ano, a diferença acumulada passa de {fmtCents((serie[29].comprLiq - serie[29].contaRemLiq) * 12)} — capital de giro extra.
                  </div>
                </div>
              )}
            </div>

            {/* TABELA DIA A DIA */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: '#ffffff', border: `1px solid ${SIM.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4" style={{ color: SIM.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: SIM.textDim }}>
                  Detalhamento
                </div>
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: SIM.dark }}>Tabela dia a dia</h3>

              <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${SIM.border}` }}>
                      <th rowSpan={2} className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider font-semibold align-bottom" style={{ color: SIM.textDim }}>Dia</th>
                      <th colSpan={3} className="text-center py-2 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.orange, borderLeft: `1px solid ${SIM.borderSoft}` }}>Compromissada</th>
                      <th colSpan={3} className="text-center py-2 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.navy, borderLeft: `1px solid ${SIM.borderSoft}` }}>CDB</th>
                      <th colSpan={2} className="text-center py-2 px-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SIM.textMore, borderLeft: `1px solid ${SIM.borderSoft}` }}>Conta Remun.</th>
                    </tr>
                    <tr style={{ borderBottom: `2px solid ${SIM.border}` }}>
                      <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: SIM.textDim, borderLeft: `1px solid ${SIM.borderSoft}` }}>Bruto</th>
                      <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: SIM.textDim }}>{isentaIOF ? 'IR' : 'IOF+IR'}</th>
                      <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: SIM.dark }}>Líquido</th>
                      <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: SIM.textDim, borderLeft: `1px solid ${SIM.borderSoft}` }}>Bruto</th>
                      <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: SIM.textDim }}>IOF+IR</th>
                      <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: SIM.dark }}>Líquido</th>
                      <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: SIM.textDim, borderLeft: `1px solid ${SIM.borderSoft}` }}>IR</th>
                      <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: SIM.dark }}>Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasChave.map((d) => {
                      const row = serie[d - 1];
                      if (!row) return null;
                      const isCruzamento = d === diaCruzamento || (diaCruzamento && d > diaCruzamento && !diasChave.some(x => x >= diaCruzamento && x < d));
                      const ganhador = row.cdbLiq > row.comprLiq ? 'cdb' : (row.comprLiq > row.cdbLiq ? 'compr' : 'tie');
                      return (
                        <tr key={d} style={{ borderBottom: `1px solid ${SIM.borderSoft}`, backgroundColor: isCruzamento ? GREEN_BG : 'transparent' }}>
                          <td className="py-2 px-3 font-semibold" style={{ color: isCruzamento ? GREEN : SIM.dark }}>
                            Dia {d} {isCruzamento && <span className="text-[10px] font-medium">(CDB ultrapassa)</span>}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-xs" style={{ color: '#475569', borderLeft: `1px solid ${SIM.borderSoft}` }}>{fmtCents(row.comprBruto)}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-xs" style={{ color: SIM.orangeDark }}>-{fmtCents(row.comprIof + row.comprIr)}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-xs font-bold" style={{ color: ganhador === 'compr' ? GREEN : SIM.dark }}>
                            {fmtCents(row.comprLiq)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-xs" style={{ color: '#475569', borderLeft: `1px solid ${SIM.borderSoft}` }}>{fmtCents(row.cdbBruto)}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-xs" style={{ color: SIM.orangeDark }}>-{fmtCents(row.cdbIof + row.cdbIr)}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-xs font-bold" style={{ color: ganhador === 'cdb' ? GREEN : SIM.dark }}>
                            {fmtCents(row.cdbLiq)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-xs" style={{ color: SIM.orangeDark, borderLeft: `1px solid ${SIM.borderSoft}` }}>-{fmtCents(row.contaRemIr)}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-xs font-bold" style={{ color: SIM.textMore }}>
                            {fmtCents(row.contaRemLiq)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-[11px] flex items-start gap-1.5" style={{ color: SIM.textDim }}>
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  Líquido do ganhador entre compromissada e CDB em cada dia fica em <span style={{ color: GREEN }}>verde</span>. A coluna da conta remunerada serve como referência — o que você ganharia deixando o dinheiro no grande banco.
                </span>
              </div>
            </div>

            {/* RESSALVAS */}
            <div className="rounded-2xl p-5 md:p-6 mb-5" style={{ backgroundColor: SIM.blueBgSoft, border: `1px solid ${SIM.blueBg}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4" style={{ color: SIM.navy }} />
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: SIM.navy }}>
                  Para você decidir bem
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs" style={{ color: SIM.navy }}>
                <div>
                  <div className="font-semibold mb-1" style={{ color: SIM.dark }}>IOF na compromissada</div>
                  Pela regra geral, a compromissada paga <strong>IOF regressivo</strong> em resgates antes de 30 dias, como o CDB. A exceção são as operações lastreadas em debêntures de emissor fora do grupo econômico do banco: essas são isentas e rendem sem desconto de IOF desde o primeiro dia.
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: SIM.dark }}>IR regressivo (ambos)</div>
                  22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima. Tanto compromissada quanto CDB pagam IR sobre o rendimento.
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: SIM.orangeDark }}>⚠ Compromissada não tem FGC</div>
                  CDB tem cobertura do FGC até R$ 250 mil por CPF/instituição. Compromissada não — a garantia vem dos títulos que lastreiam a operação. Leve isso em conta ao escolher instituições sólidas.
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl p-6 md:p-10 mt-2 relative overflow-hidden" style={{
              background: `linear-gradient(135deg, ${SIM.navy} 0%, ${SIM.navyDeep} 100%)`,
              color: '#ffffff',
            }}>
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none"
                style={{ backgroundColor: `${CAT.cor}26` }} />
              <div className="relative max-w-3xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <PiggyBank className="w-3.5 h-3.5" />
                  Pronto para aplicar?
                </div>
                <h3 className="text-2xl md:text-4xl font-bold mb-3 leading-tight">
                  Sua empresa está com caixa <span style={{ color: '#FF5713' }}>dormindo na conta</span>?
                </h3>
                <p className="text-sm md:text-base mb-6" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  Conectamos sua PJ aos bancos parceiros para você contratar compromissada com taxa negociada — capital de giro rendendo CDI todo dia, com liquidez D+0.
                </p>
                <button className="px-6 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: CAT.cor, color: '#ffffff', boxShadow: `0 8px 24px ${CAT.cor}59` }}>
                  Falar com um especialista
                  <span aria-hidden>→</span>
                </button>
                <div className="text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Sem compromisso. Análise das melhores opções para o seu caixa.
                </div>
              </div>
            </div>
          </>
        )}

        <div className="text-center text-[11px] mt-8 pb-4 px-4 leading-relaxed" style={{ color: SIM.textDim }}>
          Simulação meramente ilustrativa baseada em CDI de {cdiAno.toString().replace('.', ',')}% a.a. (ajustável no botão acima). Capitalização em dias úteis na base 252 (convenção do CDI), com o prazo em dias corridos convertido para dias úteis pela proporção 252/365; IOF e IR apurados por dias corridos. IOF da compromissada segue a regra geral, salvo se marcada a opção de isenção (lastro em debêntures de emissor fora do grupo do banco). Não considera taxas de administração ou spreads do banco. Valores reais variam conforme proposta da instituição.
        </div>
      </div>
    </div>
  );
}
