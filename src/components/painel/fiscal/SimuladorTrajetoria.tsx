"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { Section } from "./FiscalShell";

type Defaults = {
  debt_pct_receita: number;       // % (ex: 435)
  debt_pct_pib: number;           // % (ex: 80)
  custo_medio_aa: number;         // % a.a. (ex: 9.33)
  pib_real_yoy: number;           // % a.a. (ex: 1.83)
  ipca_12m: number;               // % a.a. (ex: 4.39)
  primario_pct_pib: number;       // % PIB (ex: -1.0). + = superavit
  receita_pct_pib: number;        // % PIB (ex: 18.4)
};

// 5 presets de polit ica fiscal
const PRESETS = [
  {
    nome: "Brasil hoje",
    cor: "#0369a1",
    desc: "Valores atuais dos dados via API.",
    delta: (_: Defaults): Partial<Defaults> => ({}),
  },
  {
    nome: "Cenario otimista",
    cor: "#16a34a",
    desc: "Juros caem 2pp, primario zera, crescimento real +1pp.",
    delta: (d: Defaults): Partial<Defaults> => ({
      custo_medio_aa: d.custo_medio_aa - 2,
      primario_pct_pib: Math.max(d.primario_pct_pib, 0),
      pib_real_yoy: d.pib_real_yoy + 1,
    }),
  },
  {
    nome: "Cenario estresse",
    cor: "#dc2626",
    desc: "Juros sobem 3pp, primario piora 1pp, crescimento real cai 1pp.",
    delta: (d: Defaults): Partial<Defaults> => ({
      custo_medio_aa: d.custo_medio_aa + 3,
      primario_pct_pib: d.primario_pct_pib - 1,
      pib_real_yoy: d.pib_real_yoy - 1,
    }),
  },
  {
    nome: "BC compra divida (Dalio cap. 5)",
    cor: "#7c3aed",
    desc: "BC absorve emissoes; inflacao sobe 3pp via expansao monetaria; juros caem 2pp pelo afrouxamento.",
    delta: (d: Defaults): Partial<Defaults> => ({
      ipca_12m: d.ipca_12m + 3,
      custo_medio_aa: d.custo_medio_aa - 2,
    }),
  },
  {
    nome: "Selic spiral (Dalio cap. 4)",
    cor: "#b91c1c",
    desc: "Mercado exige premio; juros sobem 5pp ao longo da projecao.",
    delta: (d: Defaults): Partial<Defaults> => ({
      custo_medio_aa: d.custo_medio_aa + 5,
    }),
  },
];

function fmtPct(v: number, casas = 2): string {
  return `${v.toFixed(casas)}%`;
}
function fmtPP(v: number, casas = 2): string {
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(casas)} pp`;
}

function projetar(d: {
  debt_pct_receita: number;
  custo_medio_aa: number;
  pib_real_yoy: number;
  ipca_12m: number;
  primario_pct_pib: number;
  receita_pct_pib: number;
  anos?: number;
}): number[] {
  const anos = d.anos ?? 10;
  const i = d.custo_medio_aa / 100;
  const g = (d.pib_real_yoy + d.ipca_12m) / 100;
  // Convencao Dalio: primary_deficit positivo = deficit
  // primary_deficit_pct_receita = -(primario_pct_pib) / (receita_pct_pib) * 100
  const pd = (-d.primario_pct_pib / d.receita_pct_pib) * 100;
  const mult = (1 + i) / (1 + g);
  const traj: number[] = [d.debt_pct_receita];
  let r = d.debt_pct_receita;
  for (let k = 0; k < anos; k++) {
    r = r * mult + pd;
    traj.push(r);
  }
  return traj;
}

// Calcula primario que estabiliza divida (Blanchard)
function primarioEstabilizador(d: Defaults): number {
  const i = d.custo_medio_aa / 100;
  const g = (d.pib_real_yoy + d.ipca_12m) / 100;
  const debt_pct_pib = d.debt_pct_pib;
  // pd_pct_pib = (g - i) * debt_pct_pib / (1 + g)
  return ((g - i) * debt_pct_pib) / (1 + g);
}

function Slider({ label, value, onChange, min, max, step, unit, hint, defaultValue }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint?: string;
  defaultValue: number;
}) {
  const alterado = Math.abs(value - defaultValue) > 0.001;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">{label}</span>
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          className={`text-[10px] underline-offset-2 ${alterado ? "text-[#027DFC] hover:underline" : "invisible"}`}
          title="Voltar ao valor atual (API)"
        >
          Resetar ({defaultValue.toFixed(2)}{unit})
        </button>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-[#132960]">{value.toFixed(2)}</span>
        <span className="text-sm text-zinc-500">{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-2 w-full accent-[#027DFC]"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-zinc-400">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
      {hint && <p className="mt-1 text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export function SimuladorTrajetoria({ defaults }: { defaults: Defaults }) {
  const [custo, setCusto] = useState(defaults.custo_medio_aa);
  const [pib_real, setPibReal] = useState(defaults.pib_real_yoy);
  const [ipca, setIpca] = useState(defaults.ipca_12m);
  const [primario, setPrimario] = useState(defaults.primario_pct_pib);

  function aplicarPreset(preset: typeof PRESETS[0]) {
    const delta = preset.delta(defaults);
    setCusto(delta.custo_medio_aa ?? defaults.custo_medio_aa);
    setPibReal(delta.pib_real_yoy ?? defaults.pib_real_yoy);
    setIpca(delta.ipca_12m ?? defaults.ipca_12m);
    setPrimario(delta.primario_pct_pib ?? defaults.primario_pct_pib);
  }

  const trajetoriaBase = useMemo(() => projetar({
    ...defaults,
  }), [defaults]);

  const trajetoriaSim = useMemo(() => projetar({
    debt_pct_receita: defaults.debt_pct_receita,
    receita_pct_pib: defaults.receita_pct_pib,
    custo_medio_aa: custo,
    pib_real_yoy: pib_real,
    ipca_12m: ipca,
    primario_pct_pib: primario,
  }), [defaults, custo, pib_real, ipca, primario]);

  const chartData = trajetoriaBase.map((v, i) => ({
    ano: i,
    "Brasil hoje (linha de base)": v,
    "Cenario simulado": trajetoriaSim[i],
  }));

  const g_nominal = pib_real + ipca;
  const r_menos_g = custo - g_nominal;
  const primario_estab = primarioEstabilizador({
    ...defaults,
    custo_medio_aa: custo,
    pib_real_yoy: pib_real,
    ipca_12m: ipca,
    primario_pct_pib: primario,
  });
  const gap_primario = primario - primario_estab;
  const final_base = trajetoriaBase[trajetoriaBase.length - 1];
  const final_sim = trajetoriaSim[trajetoriaSim.length - 1];
  const delta_final = final_sim - final_base;

  return (
    <Section
      titulo="Simulador interativo: trajetoria da divida em 10 anos"
      hint="Sliders comecam com valores atuais (API). Arraste para simular cenarios. Equacao iterativa do livro (Dalio): Divida(t+1)/Receita(t+1) = [Divida(t)*(1+i) + Deficit Primario(t)] / [Receita(t)*(1+g_nominal)]."
    >
      {/* Presets */}
      <div className="mb-4">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Presets</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.nome}
              type="button"
              onClick={() => aplicarPreset(p)}
              className="rounded-full border border-[#132960]/20 bg-white px-3 py-1 text-xs font-medium text-[#132960] hover:bg-[#132960] hover:text-white transition"
              title={p.desc}
            >
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Sliders */}
        <div className="space-y-3">
          <Slider
            label="Custo medio da divida"
            value={custo}
            onChange={setCusto}
            min={4} max={16} step={0.1} unit="% a.a."
            defaultValue={defaults.custo_medio_aa}
            hint="Juros nominais 12m / DBGG. Atual: dados live do Tesouro + BCB."
          />
          <Slider
            label="Crescimento real do PIB"
            value={pib_real}
            onChange={setPibReal}
            min={-2} max={5} step={0.1} unit="% a.a."
            defaultValue={defaults.pib_real_yoy}
            hint="PIB real YoY. Atual: BCB SGS 22099."
          />
          <Slider
            label="Inflacao (IPCA)"
            value={ipca}
            onChange={setIpca}
            min={1} max={12} step={0.1} unit="% a.a."
            defaultValue={defaults.ipca_12m}
            hint="IPCA 12m. Erode divida via crescimento nominal."
          />
          <Slider
            label="Primario gov central"
            value={primario}
            onChange={setPrimario}
            min={-4} max={4} step={0.1} unit="% PIB"
            defaultValue={defaults.primario_pct_pib}
            hint="Positivo = superavit. Atual: derivado RTN. + = melhor para divida."
          />
        </div>

        {/* Grafico e KPIs */}
        <div className="space-y-3">
          <div className="h-64 rounded-lg border border-zinc-200 bg-white p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 0, right: 24, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ano" tick={{ fontSize: 10 }} label={{ value: "anos a partir de hoje", fontSize: 9, position: "insideBottom", offset: -2 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={(v: unknown) => typeof v === "number" ? `${v.toFixed(0)}% da receita` : "-"} />
                <ReferenceLine y={trajetoriaBase[0]} stroke="#94a3b8" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="Brasil hoje (linha de base)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="Cenario simulado" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-zinc-50 p-2">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">g nominal (derivado)</div>
              <div className="text-lg font-bold tabular-nums text-zinc-800">{fmtPct(g_nominal)}</div>
              <div className="text-[10px] text-zinc-500">{fmtPct(pib_real, 2)} + {fmtPct(ipca, 2)}</div>
            </div>
            <div className={`rounded-lg p-2 ${r_menos_g > 0 ? "bg-rose-50" : "bg-emerald-50"}`}>
              <div className={`text-[10px] uppercase tracking-wide ${r_menos_g > 0 ? "text-rose-700" : "text-emerald-700"}`}>r &minus; g</div>
              <div className={`text-lg font-bold tabular-nums ${r_menos_g > 0 ? "text-rose-900" : "text-emerald-900"}`}>{fmtPP(r_menos_g)}</div>
              <div className={`text-[10px] ${r_menos_g > 0 ? "text-rose-700" : "text-emerald-700"}`}>{r_menos_g > 0 ? "divida cresce sozinha" : "favoravel"}</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-2">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Primario p/ estabilizar</div>
              <div className="text-lg font-bold tabular-nums text-zinc-800">{fmtPct(primario_estab)}</div>
              <div className="text-[10px] text-zinc-500">Blanchard (% PIB)</div>
            </div>
            <div className={`rounded-lg p-2 ${gap_primario < 0 ? "bg-rose-50" : "bg-emerald-50"}`}>
              <div className={`text-[10px] uppercase tracking-wide ${gap_primario < 0 ? "text-rose-700" : "text-emerald-700"}`}>Gap primario</div>
              <div className={`text-lg font-bold tabular-nums ${gap_primario < 0 ? "text-rose-900" : "text-emerald-900"}`}>{fmtPP(gap_primario)}</div>
              <div className={`text-[10px] ${gap_primario < 0 ? "text-rose-700" : "text-emerald-700"}`}>realizado vs necessario</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-2 col-span-2">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Divida/Receita em 10 anos</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-rose-900">{fmtPct(final_sim, 0)}</span>
                <span className="text-xs text-zinc-500">vs base {fmtPct(final_base, 0)}</span>
                <span className={`text-xs font-bold ${delta_final > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmtPP(delta_final, 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
