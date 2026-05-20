"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  agrupa5,
  buildIpcaIndex,
  CagedQuebrasData,
  CagedTotalData,
  deflaciona,
  FAIXAS_11_NOMES,
  FAIXAS_11_ORDEM,
  FAIXAS_5_ORDEM,
  IpcaForEmprego,
  SETORES_IBGE_ORDEM,
} from "@/lib/painel-emprego";
import {
  DataTable,
  FMT_NUM_BR,
  Heatmap,
  KPICard,
  PieDistribution,
  RankingTable,
  Toggle,
  deltaPct,
  divergingSaldoScale,
  findSameMesAnoAnterior,
  fmtBRL,
  fmtMes,
  fmtSaldo,
  sequentialScale,
} from "./shared";

const CORES_SETOR: Record<string, string> = {
  Agropecuária: "#84cc16",
  "Indústria geral": "#3b82f6",
  Construção: "#f97316",
  Comércio: "#a855f7",
  Serviços: "#06b6d4",
};
const CORES_FAIXA_5_MAP: Record<string, string> = {
  "≤ 1 SM": "#dc2626",
  "1-2 SM": "#f59e0b",
  "2-3 SM": "#10b981",
  "3-5 SM": "#3b82f6",
  "> 5 SM": "#7c3aed",
};
const CORES_FAIXA_11 = [
  "#7f1d1d", "#dc2626", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#7c3aed",
];

type Vista = "total" | "faixa" | "setor" | "cruzamentos" | "serie";

export function CagedDashboard({
  total,
  quebras,
  ipca,
}: {
  total: CagedTotalData;
  quebras: CagedQuebrasData | null;
  ipca: IpcaForEmprego | null;
}) {
  const [vista, setVista] = useState<Vista>("total");

  const ipcaIndex = useMemo(() => buildIpcaIndex(ipca), [ipca]);

  const ultimoMes = total.serie[total.serie.length - 1];
  const mesAnoAnterior = findSameMesAnoAnterior(total.serie, ultimoMes.mes);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#132960]">CAGED — Mercado Formal</h1>
            <p className="mt-1 text-xs text-zinc-500">
              MTE / Novo CAGED · Mês de referência:{" "}
              <strong className="text-zinc-700">{fmtMes(ultimoMes.mes)}</strong>
            </p>
          </div>
          <Toggle
            value={vista}
            onChange={(v) => setVista(v as Vista)}
            options={[
              { value: "total", label: "Saldo total" },
              { value: "faixa", label: "Faixa salarial", disabled: !quebras },
              { value: "setor", label: "Setor", disabled: !quebras },
              { value: "cruzamentos", label: "Cruzamentos" },
              { value: "serie", label: "Série completa" },
            ]}
          />
        </div>

        {/* KPIs sempre visíveis */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPICard
            label="Saldo do mês"
            value={fmtSaldo(ultimoMes.saldo)}
            delta={deltaPct(ultimoMes.saldo, mesAnoAnterior?.saldo)}
            deltaUnit="%"
            hint={`vs ${fmtMes(mesAnoAnterior?.mes ?? "")}`}
            size="lg"
          />
          <KPICard
            label="Admissões"
            value={FMT_NUM_BR.format(ultimoMes.admissoes ?? 0)}
            delta={deltaPct(ultimoMes.admissoes, mesAnoAnterior?.admissoes)}
            deltaUnit="%"
          />
          <KPICard
            label="Demissões"
            value={FMT_NUM_BR.format(ultimoMes.demissoes ?? 0)}
            delta={deltaPct(ultimoMes.demissoes, mesAnoAnterior?.demissoes)}
            deltaUnit="%"
            invertColor
          />
          <KPICard
            label="Média móvel 12m"
            value={fmtSaldo(ultimoMes.saldo_mm12)}
            hint="suaviza sazonalidade"
          />
        </div>
      </header>

      <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        {vista === "total" && <TotalView total={total} />}
        {vista === "faixa" && quebras && <FaixaView quebras={quebras} ipcaIndex={ipcaIndex} ipcaDisponivel={!!ipca} />}
        {vista === "setor" && quebras && <SetorView quebras={quebras} />}
        {vista === "cruzamentos" && <CruzamentosView total={total} quebras={quebras} />}
        {vista === "serie" && <SerieCompletaView total={total} quebras={quebras} />}
        {(vista === "faixa" || vista === "setor") && !quebras && (
          <p className="text-sm text-zinc-500">Dados de quebras indisponíveis no momento.</p>
        )}
        {(vista === "faixa" || vista === "setor") && quebras && <NotaCobertura />}
      </div>

      <footer className="text-xs text-zinc-500 border-t pt-3 space-y-1">
        <div>{total.metadata.fonte}</div>
        {quebras && <div>{quebras.metadata.fonte}</div>}
        <div className="text-zinc-400">
          Gerado em {total.gerado_em.slice(0, 19).replace("T", " ")} UTC
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Vista: Saldo total
// ============================================================
function TotalView({ total }: { total: CagedTotalData }) {
  const serie24m = total.serie.slice(-24);

  // Ranking top/bottom meses
  const rankingData = useMemo(() => {
    return total.serie.map((s) => ({
      label: fmtMes(s.mes),
      value: s.saldo ?? 0,
    }));
  }, [total.serie]);

  return (
    <div className="space-y-4">
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <ComposedChart data={serie24m} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + "k"} />
            <Tooltip
              labelFormatter={(label) => fmtMes(String(label ?? ""))}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : Number(value);
                const nm = String(name ?? "");
                return Number.isFinite(v) ? [fmtSaldo(v), nm] : ["—", nm];
              }}
            />
            <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
            <Bar dataKey="saldo" name="Saldo do mês">
              {serie24m.map((d, i) => (
                <Cell key={i} fill={(d.saldo ?? 0) >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
            <Line dataKey="saldo_mm12" name="Média móvel 12m" stroke="#1f2937" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingTable
          title="Top 5 melhores meses (histórico)"
          data={rankingData}
          valueLabel="Saldo"
          valueFmt={fmtSaldo}
          topN={5}
          bottomN={0}
          colorAccent={() => "#10b981"}
        />
        <RankingTable
          title="Top 5 piores meses (histórico)"
          data={rankingData.map((r) => ({ ...r, value: -r.value }))}
          valueLabel="Saldo (invertido)"
          valueFmt={(v) => fmtSaldo(-v)}
          topN={5}
          bottomN={0}
          colorAccent={() => "#ef4444"}
        />
      </div>
    </div>
  );
}

// ============================================================
// Vista: Faixa salarial (com toggle nominal/real)
// ============================================================
function FaixaView({
  quebras,
  ipcaIndex,
  ipcaDisponivel,
}: {
  quebras: CagedQuebrasData;
  ipcaIndex: Map<string, number>;
  ipcaDisponivel: boolean;
}) {
  const [faixas11, setFaixas11] = useState(false);
  const [salarioReal, setSalarioReal] = useState(false);

  const ultima = quebras.serie[quebras.serie.length - 1];
  const mesBase = ultima.mes;
  const ordem = faixas11 ? [...FAIXAS_11_ORDEM] : [...FAIXAS_5_ORDEM];
  const cores = faixas11 ? CORES_FAIXA_11 : ordem.map((f) => CORES_FAIXA_5_MAP[f] ?? "#9ca3af");

  // Série stacked de faixa salarial
  const dataChart = quebras.serie.map((item) => {
    const o: Record<string, number | string> = { mes: item.mes };
    if (faixas11) {
      for (const f of FAIXAS_11_ORDEM) o[f] = item.saldo_por_faixa_salario[f] ?? 0;
    } else {
      const ag = agrupa5(item.saldo_por_faixa_salario);
      for (const f of FAIXAS_5_ORDEM) o[f] = ag[f] ?? 0;
    }
    return o;
  });

  // Série de salário médio (com toggle nominal/real)
  const dataSalario = quebras.serie.map((item) => {
    const adm = item.salario_medio_admissao;
    const dem = item.salario_medio_demissao;
    if (salarioReal && ipcaDisponivel) {
      return {
        mes: item.mes,
        Admissão: deflaciona(adm, item.mes, mesBase, ipcaIndex),
        Demissão: deflaciona(dem, item.mes, mesBase, ipcaIndex),
      };
    }
    return { mes: item.mes, Admissão: adm, Demissão: dem };
  });

  // Pizza do último mês
  const pieData = ordem.map((f) => ({
    name: faixas11 ? `${f} (${FAIXAS_11_NOMES[f]})` : f,
    value: faixas11
      ? (ultima.saldo_por_faixa_salario[f] ?? 0)
      : (agrupa5(ultima.saldo_por_faixa_salario)[f] ?? 0),
  }));

  // Tabela de faixa com variação YoY
  const ultimaAnoAnt = findSameMesAnoAnterior(quebras.serie, ultima.mes);
  const rankingFaixa = ordem.map((f) => {
    const curr = faixas11
      ? (ultima.saldo_por_faixa_salario[f] ?? 0)
      : (agrupa5(ultima.saldo_por_faixa_salario)[f] ?? 0);
    const prev = ultimaAnoAnt
      ? faixas11
        ? (ultimaAnoAnt.saldo_por_faixa_salario[f] ?? 0)
        : (agrupa5(ultimaAnoAnt.saldo_por_faixa_salario)[f] ?? 0)
      : 0;
    return {
      label: faixas11 ? `${f} (${FAIXAS_11_NOMES[f]})` : f,
      value: curr,
      delta: prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null,
    };
  });

  const labelFaixa = (f: string) => (faixas11 ? `${f} (${FAIXAS_11_NOMES[f]})` : f);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">
            Salário médio em {fmtMes(ultima.mes)}{" "}
            {salarioReal && ipcaDisponivel && (
              <span className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                em R$ de {fmtMes(mesBase)} (deflator IPCA)
              </span>
            )}
          </p>
          <p className="text-sm font-medium text-zinc-900">
            Adm {fmtBRL(ultima.salario_medio_admissao)} · Dem {fmtBRL(ultima.salario_medio_demissao)} ·{" "}
            <span className={(ultima.diferencial ?? 0) < 0 ? "text-red-700" : "text-emerald-700"}>
              {(ultima.diferencial ?? 0) >= 0 ? "+" : ""}
              {ultima.diferencial?.toFixed(2)}
            </span>
          </p>
          <p className="text-xs text-zinc-400">SM vigente: {fmtBRL(ultima.salario_minimo_aplicado)}</p>
        </div>
        <div className="flex gap-2">
          <Toggle
            value={faixas11 ? "11" : "5"}
            onChange={(v) => setFaixas11(v === "11")}
            options={[
              { value: "5", label: "5 grupos" },
              { value: "11", label: "11 faixas" },
            ]}
          />
          <Toggle
            value={salarioReal ? "real" : "nominal"}
            onChange={(v) => setSalarioReal(v === "real")}
            options={[
              { value: "nominal", label: "Nominal" },
              { value: "real", label: "Real (IPCA)", disabled: !ipcaDisponivel },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={dataChart} margin={{ top: 5, right: 24, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip
                  labelFormatter={(label) => fmtMes(String(label ?? ""))}
                  formatter={(value, name) => {
                    const v = typeof value === "number" ? value : Number(value);
                    const nm = labelFaixa(String(name ?? ""));
                    return Number.isFinite(v) ? [fmtSaldo(v), nm] : ["—", nm];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value: string) => labelFaixa(value)} />
                <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
                {ordem.map((f, i) => (
                  <Bar key={f} dataKey={f} stackId="fx" fill={cores[i % cores.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-2 text-xs text-zinc-500">
              Salário médio {salarioReal ? "real" : "nominal"} (R${" "}
              {salarioReal ? `de ${fmtMes(mesBase)}` : "nominais"})
            </p>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={dataSalario} margin={{ top: 5, right: 24, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => "R$" + (v / 1000).toFixed(1) + "k"}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    labelFormatter={(label) => fmtMes(String(label ?? ""))}
                    formatter={(value, name) => {
                      const v = typeof value === "number" ? value : Number(value);
                      const nm = String(name ?? "");
                      return Number.isFinite(v) ? [fmtBRL(v), nm] : ["—", nm];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="Admissão" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line dataKey="Demissão" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <PieDistribution
            data={pieData}
            colors={faixas11 ? CORES_FAIXA_11 : CORES_FAIXA_5_MAP}
            title={`Distribuição em ${fmtMes(ultima.mes)}`}
            totalLabel="Saldo total (microdado)"
            valueFmt={fmtSaldo}
            height={200}
          />
          <RankingTable
            title="Variação YoY por faixa"
            data={rankingFaixa}
            valueLabel="Saldo"
            valueFmt={fmtSaldo}
            deltaLabel="% YoY"
            deltaUnit="%"
            topN={ordem.length}
          />
        </div>
      </div>
    </>
  );
}

// ============================================================
// Vista: Setor
// ============================================================
function SetorView({ quebras }: { quebras: CagedQuebrasData }) {
  const setoresOrdem = [...SETORES_IBGE_ORDEM];
  const ultima = quebras.serie[quebras.serie.length - 1];
  const ultimaAnoAnt = findSameMesAnoAnterior(quebras.serie, ultima.mes);

  const dataChart = quebras.serie.map((item) => {
    const o: Record<string, number | string> = { mes: item.mes };
    for (const s of setoresOrdem) o[s] = item.saldo_por_setor_ibge[s] ?? 0;
    return o;
  });

  const pieData = setoresOrdem.map((s) => ({
    name: s,
    value: ultima.saldo_por_setor_ibge[s] ?? 0,
  }));

  const ranking = setoresOrdem.map((s) => {
    const curr = ultima.saldo_por_setor_ibge[s] ?? 0;
    const prev = ultimaAnoAnt?.saldo_por_setor_ibge[s] ?? 0;
    return {
      label: s,
      value: curr,
      delta: prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <BarChart data={dataChart} margin={{ top: 5, right: 24, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + "k"} />
              <Tooltip
                labelFormatter={(label) => fmtMes(String(label ?? ""))}
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const nm = String(name ?? "");
                  return Number.isFinite(v) ? [fmtSaldo(v), nm] : ["—", nm];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
              {setoresOrdem.map((s) => (
                <Bar key={s} dataKey={s} stackId="st" fill={CORES_SETOR[s] ?? "#999"} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="space-y-4">
        <PieDistribution
          data={pieData}
          colors={CORES_SETOR}
          title={`Distribuição em ${fmtMes(ultima.mes)}`}
          totalLabel="Saldo total (microdado)"
          valueFmt={fmtSaldo}
          height={200}
        />
        <RankingTable
          title="Variação YoY por setor"
          data={ranking}
          valueLabel="Saldo"
          valueFmt={fmtSaldo}
          deltaLabel="% YoY"
          deltaUnit="%"
          topN={5}
          colorAccent={(r) => CORES_SETOR[r.label] ?? "#9ca3af"}
        />
      </div>
    </div>
  );
}

// ============================================================
// Vista: Cruzamentos (heatmap + decomposição YoY)
// ============================================================
function CruzamentosView({
  total,
  quebras,
}: {
  total: CagedTotalData;
  quebras: CagedQuebrasData | null;
}) {
  // Heatmap: linhas = anos, colunas = meses, valores = saldo
  const { rows, cols, heatData, minV, maxV } = useMemo(() => {
    const heat: Record<string, Record<string, number | null>> = {};
    const yearsSet = new Set<string>();
    const colNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    let mn = Infinity;
    let mx = -Infinity;
    for (const item of total.serie) {
      const [y, m] = item.mes.split("-");
      const col = colNames[parseInt(m, 10) - 1];
      yearsSet.add(y);
      heat[y] = heat[y] ?? {};
      heat[y][col] = item.saldo ?? null;
      if (item.saldo != null) {
        if (item.saldo < mn) mn = item.saldo;
        if (item.saldo > mx) mx = item.saldo;
      }
    }
    return { rows: Array.from(yearsSet).sort(), cols: colNames, heatData: heat, minV: mn, maxV: mx };
  }, [total.serie]);

  const scale = useMemo(() => divergingSaldoScale(minV, maxV), [minV, maxV]);

  // Decomposição YoY por setor (se quebras disponível)
  const decompData = useMemo(() => {
    if (!quebras) return [];
    const ult = quebras.serie[quebras.serie.length - 1];
    const ant = findSameMesAnoAnterior(quebras.serie, ult.mes);
    if (!ant) return [];
    return [...SETORES_IBGE_ORDEM]
      .map((s) => ({
        setor: s,
        delta: (ult.saldo_por_setor_ibge[s] ?? 0) - (ant.saldo_por_setor_ibge[s] ?? 0),
      }))
      .sort((a, b) => b.delta - a.delta);
  }, [quebras]);

  const ultMes = quebras?.serie[quebras.serie.length - 1];
  const antMes = ultMes ? findSameMesAnoAnterior(quebras.serie, ultMes.mes) : null;

  return (
    <div className="space-y-4">
      <Heatmap
        rows={rows}
        cols={cols}
        data={heatData}
        valueFmt={(v) => (v >= 0 ? "+" : "") + (v / 1000).toFixed(0) + "k"}
        colorScale={scale}
        title="Sazonalidade — Saldo CAGED (mil postos por mês × ano)"
        caption="Verde = saldo positivo (criação líquida), vermelho = saldo negativo (demissões líquidas). Dezembro tipicamente vermelho (demissões de fim de ano), fevereiro-abril verdes (safra de admissões)."
      />

      {decompData.length > 0 && ultMes && antMes && (
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold text-zinc-700">
            Decomposição YoY do saldo por setor — {fmtMes(ultMes.mes)} vs {fmtMes(antMes.mes)}
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={decompData} layout="vertical" margin={{ top: 10, right: 60, bottom: 10, left: 120 }}>
                <CartesianGrid stroke="#eee" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => (v >= 0 ? "+" : "") + (v / 1000).toFixed(0) + "k"}
                />
                <YAxis type="category" dataKey="setor" tick={{ fontSize: 10 }} width={120} />
                <Tooltip
                  formatter={(value) => {
                    const v = typeof value === "number" ? value : Number(value);
                    const sign = v >= 0 ? "+" : "";
                    return [`${sign}${FMT_NUM_BR.format(Math.round(v))}`, "Variação YoY"];
                  }}
                />
                <Bar dataKey="delta">
                  {decompData.map((d) => (
                    <Cell key={d.setor} fill={d.delta >= 0 ? "#10b981" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] italic text-zinc-500">
            Variação líquida em postos formais por setor entre o mês atual e o mesmo mês do ano anterior.
            Reflete apenas as declarações no prazo (microdado MOV).
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Vista: Série completa
// ============================================================
function SerieCompletaView({
  total,
  quebras,
}: {
  total: CagedTotalData;
  quebras: CagedQuebrasData | null;
}) {
  // Junta total + quebras por mês
  const linhas = useMemo(() => {
    const qmap = new Map<string, CagedQuebrasData["serie"][number]>();
    if (quebras) {
      for (const q of quebras.serie) qmap.set(q.mes, q);
    }
    return total.serie
      .map((t) => {
        const q = qmap.get(t.mes);
        return {
          mes: t.mes,
          saldo: t.saldo,
          admissoes: t.admissoes,
          demissoes: t.demissoes,
          saldo_mm12: t.saldo_mm12,
          sal_adm: q?.salario_medio_admissao ?? null,
          sal_dem: q?.salario_medio_demissao ?? null,
          diferencial: q?.diferencial ?? null,
        };
      })
      .sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
  }, [total, quebras]);

  return (
    <DataTable
      title={`Série completa CAGED — ${linhas.length} meses`}
      data={linhas}
      exportFilename="caged_serie_completa.csv"
      initialSortKey="mes"
      initialSortDir="desc"
      columns={[
        {
          key: "mes",
          label: "Mês",
          align: "left",
          fmt: (v) => fmtMes(String(v)),
          numericValue: (r) => {
            const [y, m] = String(r.mes).split("-");
            return parseInt(y, 10) * 100 + parseInt(m, 10);
          },
        },
        {
          key: "saldo",
          label: "Saldo",
          fmt: (v) => fmtSaldo(typeof v === "number" ? v : null),
        },
        {
          key: "admissoes",
          label: "Admissões",
          fmt: (v) => (typeof v === "number" ? FMT_NUM_BR.format(Math.round(v)) : "—"),
        },
        {
          key: "demissoes",
          label: "Demissões",
          fmt: (v) => (typeof v === "number" ? FMT_NUM_BR.format(Math.round(v)) : "—"),
        },
        {
          key: "saldo_mm12",
          label: "MM12",
          fmt: (v) => fmtSaldo(typeof v === "number" ? v : null),
        },
        {
          key: "sal_adm",
          label: "Sal. adm",
          fmt: (v) => fmtBRL(typeof v === "number" ? v : null),
        },
        {
          key: "sal_dem",
          label: "Sal. dem",
          fmt: (v) => fmtBRL(typeof v === "number" ? v : null),
        },
        {
          key: "diferencial",
          label: "Diferencial",
          fmt: (v) => (typeof v === "number" ? (v >= 0 ? "+" : "") + v.toFixed(2) : "—"),
        },
      ]}
      maxHeight={460}
    />
  );
}

// ============================================================
// Nota de cobertura
// ============================================================
function NotaCobertura() {
  return (
    <p className="mt-3 text-xs italic text-zinc-400">
      ⓘ Distribuições por faixa salarial/setor e salário médio refletem APENAS declarações no prazo
      (~40-50% do saldo oficial). Saldo absoluto e admissões/demissões nos KPIs e na aba "Saldo total"
      vêm do consolidado oficial MTE (via IPEADATA).
    </p>
  );
}
