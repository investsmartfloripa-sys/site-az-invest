"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PnadData } from "@/lib/painel-emprego";

const CORES = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
];

const FMT_NUM_BR = new Intl.NumberFormat("pt-BR");

function fmtTrim(s: string): string {
  if (!s) return "";
  const [y, t] = s.split("-T");
  return `${t}T${y.slice(2)}`;
}

type Vista = "taxas" | "composicao" | "setor";

export function PnadDashboard({ data }: { data: PnadData }) {
  const [vista, setVista] = useState<Vista>("taxas");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const trimRecente = data.taxas.serie[data.taxas.serie.length - 1];
  const indicadores = data.taxas.indicadores;

  const toggleHide = (k: string) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setHidden(next);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#132960]">PNAD — Mercado de Trabalho</h1>
            <p className="mt-1 text-xs text-zinc-500">
              IBGE / PNAD Contínua Trimestral · Trimestre de referência:{" "}
              <strong className="text-zinc-700">{fmtTrim(trimRecente.trim as string)}</strong>
            </p>
          </div>
          <Toggle
            value={vista}
            onChange={(v) => setVista(v as Vista)}
            options={[
              { value: "taxas", label: "Taxas" },
              { value: "composicao", label: "Composição" },
              { value: "setor", label: "Setor" },
            ]}
          />
        </div>
        {vista === "taxas" && (
          <p className="mt-3 text-xs text-zinc-500">
            Desocupação:{" "}
            <strong className="text-zinc-900">
              {(trimRecente["Taxa de desocupação"] as number)?.toFixed(1)}%
            </strong>
            <span className="mx-2 text-zinc-300">·</span>
            Participação:{" "}
            <strong className="text-zinc-900">
              {(trimRecente["Taxa de participação na força de trabalho"] as number)?.toFixed(1)}%
            </strong>
            <span className="mx-2 text-zinc-300">·</span>
            Informalidade:{" "}
            <strong className="text-zinc-900">
              {(trimRecente["Taxa de informalidade"] as number)?.toFixed(1)}%
            </strong>
          </p>
        )}
      </header>

      <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
        {vista === "taxas" && (
          <TaxasChart
            data={data.taxas.serie}
            indicadores={indicadores}
            hidden={hidden}
            onToggle={toggleHide}
          />
        )}
        {vista === "composicao" && (
          <ComposicaoChart data={data.composicao.serie} categorias={data.composicao.categorias} />
        )}
        {vista === "setor" && (
          <SetorChart data={data.setor.serie} categorias={data.setor.categorias} />
        )}
      </div>

      <footer className="text-xs text-zinc-500 border-t pt-3">
        {data.metadata.fonte}
        <br />
        <span className="text-zinc-400">Gerado em {data.gerado_em.slice(0, 19).replace("T", " ")} UTC</span>
      </footer>
    </div>
  );
}

function Toggle({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 font-medium transition ${
            value === o.value ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  label, color, ativo, onClick,
}: {
  label: string;
  color: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        ativo
          ? "border-zinc-900 bg-white text-zinc-900"
          : "border-zinc-200 bg-zinc-50 text-zinc-400"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ativo ? color : "#d1d5db" }} />
      {label}
    </button>
  );
}

function TaxasChart({
  data, indicadores, hidden, onToggle,
}: {
  data: PnadData["taxas"]["serie"];
  indicadores: string[];
  hidden: Set<string>;
  onToggle: (k: string) => void;
}) {
  const visiveis = indicadores.filter((i) => !hidden.has(i));
  return (
    <>
      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="trim" tickFormatter={fmtTrim} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, "auto"]} />
            <Tooltip
              labelFormatter={(label) => fmtTrim(String(label ?? ""))}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : Number(value);
                const nm = String(name ?? "");
                return Number.isFinite(v) ? [v.toFixed(1) + "%", nm] : ["—", nm];
              }}
            />
            {visiveis.map((ind) => (
              <Line
                key={ind}
                dataKey={ind}
                stroke={CORES[indicadores.indexOf(ind) % CORES.length]}
                strokeWidth={ind.startsWith("Taxa de desocupação") ? 2.5 : 1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {indicadores.map((ind) => (
          <Chip
            key={ind}
            label={ind}
            color={CORES[indicadores.indexOf(ind) % CORES.length]}
            ativo={!hidden.has(ind)}
            onClick={() => onToggle(ind)}
          />
        ))}
      </div>
    </>
  );
}

function ComposicaoChart({
  data, categorias,
}: {
  data: PnadData["composicao"]["serie"];
  categorias: string[];
}) {
  return (
    <div style={{ width: "100%", height: 360 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis dataKey="trim" tickFormatter={fmtTrim} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
          <Tooltip
            labelFormatter={(label) => fmtTrim(String(label ?? ""))}
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : Number(value);
              const nm = String(name ?? "");
              return Number.isFinite(v) ? [v.toFixed(1) + "%", nm] : ["—", nm];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {categorias.map((cat, i) => (
            <Bar key={cat} dataKey={cat} stackId="comp" fill={CORES[i % CORES.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SetorChart({
  data, categorias,
}: {
  data: PnadData["setor"]["serie"];
  categorias: string[];
}) {
  return (
    <div style={{ width: "100%", height: 360 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis dataKey="trim" tickFormatter={fmtTrim} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + "M"} />
          <Tooltip
            labelFormatter={(label) => fmtTrim(String(label ?? ""))}
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : Number(value);
              const nm = String(name ?? "");
              return Number.isFinite(v) ? [(v / 1000).toFixed(2) + " mi", nm] : ["—", nm];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {categorias.map((cat, i) => (
            <Bar key={cat} dataKey={cat} stackId="setor" fill={CORES[i % CORES.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
