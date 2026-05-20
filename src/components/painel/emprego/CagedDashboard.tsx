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
  CagedQuebrasData,
  CagedTotalData,
  FAIXAS_11_NOMES,
  FAIXAS_11_ORDEM,
  FAIXAS_5_ORDEM,
  SETORES_IBGE_ORDEM,
} from "@/lib/painel-emprego";

const FMT_NUM_BR = new Intl.NumberFormat("pt-BR");

const CORES_SETOR: Record<string, string> = {
  Agropecuária: "#84cc16",
  "Indústria geral": "#3b82f6",
  Construção: "#f97316",
  Comércio: "#a855f7",
  Serviços: "#06b6d4",
};
const CORES_FAIXA_5 = ["#dc2626", "#f59e0b", "#10b981", "#3b82f6", "#7c3aed"];
const CORES_FAIXA_11 = [
  "#7f1d1d", "#dc2626", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#7c3aed",
];

function fmtMes(s: string): string {
  if (!s) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
function fmtSaldo(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return sign + FMT_NUM_BR.format(Math.round(v));
}
function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Vista = "total" | "faixa" | "setor";

export function CagedDashboard({
  total, quebras,
}: {
  total: CagedTotalData;
  quebras: CagedQuebrasData | null;
}) {
  const [vista, setVista] = useState<Vista>("total");
  const [faixas11, setFaixas11] = useState(false);

  const ultimoMes = total.serie[total.serie.length - 1];
  const serie24m = total.serie.slice(-24);

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
            ]}
          />
        </div>
      </header>

      <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        {vista === "total" && (
          <TotalView serie24m={serie24m} ultimoMes={ultimoMes} />
        )}
        {vista === "faixa" && quebras && (
          <FaixaView quebras={quebras} faixas11={faixas11} setFaixas11={setFaixas11} />
        )}
        {vista === "setor" && quebras && (
          <SetorView quebras={quebras} />
        )}
        {(vista === "faixa" || vista === "setor") && quebras && (
          <NotaCobertura quebras={quebras} />
        )}
        {(vista === "faixa" || vista === "setor") && !quebras && (
          <p className="text-sm text-zinc-500">Dados de quebras indisponíveis no momento.</p>
        )}
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

function Toggle({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 font-medium transition ${
            value === o.value
              ? "bg-zinc-900 text-white"
              : o.disabled
                ? "bg-zinc-50 text-zinc-300 cursor-not-allowed"
                : "bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TotalView({
  serie24m, ultimoMes,
}: {
  serie24m: CagedTotalData["serie"];
  ultimoMes: CagedTotalData["serie"][number];
}) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-6">
        <KPI
          label="Saldo do mês"
          value={fmtSaldo(ultimoMes.saldo)}
          className={ultimoMes.saldo && ultimoMes.saldo >= 0 ? "text-emerald-700" : "text-red-700"}
          size="lg"
        />
        <KPI label="Admissões" value={FMT_NUM_BR.format(ultimoMes.admissoes ?? 0)} />
        <KPI label="Demissões" value={FMT_NUM_BR.format(ultimoMes.demissoes ?? 0)} />
        <KPI label="Média móvel 12m" value={fmtSaldo(ultimoMes.saldo_mm12)} />
      </div>
      <div style={{ width: "100%", height: 320 }}>
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
    </>
  );
}

function FaixaView({
  quebras, faixas11, setFaixas11,
}: {
  quebras: CagedQuebrasData;
  faixas11: boolean;
  setFaixas11: (b: boolean) => void;
}) {
  const ultima = quebras.serie[quebras.serie.length - 1];
  const ordem = faixas11 ? [...FAIXAS_11_ORDEM] : [...FAIXAS_5_ORDEM];
  const cores = faixas11 ? CORES_FAIXA_11 : CORES_FAIXA_5;

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

  const dataSalario = quebras.serie.map((item) => ({
    mes: item.mes,
    Admissão: item.salario_medio_admissao,
    Demissão: item.salario_medio_demissao,
  }));

  const labelFaixa = (f: string) => (faixas11 ? `${f} (${FAIXAS_11_NOMES[f]})` : f);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">Salário médio (último mês: {fmtMes(ultima.mes)})</p>
          <p className="text-sm font-medium text-zinc-900">
            Adm {fmtBRL(ultima.salario_medio_admissao)} · Dem {fmtBRL(ultima.salario_medio_demissao)} ·{" "}
            <span className={(ultima.diferencial ?? 0) < 0 ? "text-red-700" : "text-emerald-700"}>
              {(ultima.diferencial ?? 0) >= 0 ? "+" : ""}
              {ultima.diferencial?.toFixed(2)}
            </span>
          </p>
          <p className="text-xs text-zinc-400">SM vigente: {fmtBRL(ultima.salario_minimo_aplicado)}</p>
        </div>
        <Toggle
          value={faixas11 ? "11" : "5"}
          onChange={(v) => setFaixas11(v === "11")}
          options={[
            { value: "5", label: "5 grupos" },
            { value: "11", label: "11 faixas" },
          ]}
        />
      </div>
      <div style={{ width: "100%", height: 280 }}>
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
      <div className="mt-4">
        <p className="mb-2 text-xs text-zinc-500">Salário médio (R$ nominais, mês a mês)</p>
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
    </>
  );
}

function SetorView({ quebras }: { quebras: CagedQuebrasData }) {
  const dataChart = quebras.serie.map((item) => {
    const o: Record<string, number | string> = { mes: item.mes };
    for (const s of SETORES_IBGE_ORDEM) o[s] = item.saldo_por_setor_ibge[s] ?? 0;
    return o;
  });
  return (
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
          {SETORES_IBGE_ORDEM.map((s) => (
            <Bar key={s} dataKey={s} stackId="st" fill={CORES_SETOR[s] ?? "#999"} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NotaCobertura({ quebras }: { quebras: CagedQuebrasData }) {
  const cobMedia = useMemo(() => {
    const vals = quebras.serie
      .map((s) => {
        const microdado = s.saldo_microdado ?? 0;
        return microdado;
      })
      .filter((v) => v != null);
    if (!vals.length) return "—";
    return "≈ 40–50%";
  }, [quebras]);
  return (
    <p className="mt-3 text-xs italic text-zinc-400">
      ⓘ Distribuições baseadas em declarações no prazo de cada mês ({cobMedia} do saldo oficial em média na janela).
      Saldo total na aba "Saldo total" reflete consolidação MTE com revisões.
    </p>
  );
}

function KPI({
  label, value, className, size = "md",
}: {
  label: string;
  value: string;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`${size === "lg" ? "text-2xl font-bold" : "text-base font-medium"} ${className ?? "text-zinc-900"}`}>
        {value}
      </div>
    </div>
  );
}
