"use client";

import { useMemo, useState } from "react";

import type { FiscalTermometroData, IndicadorDalio, Nivel } from "@/lib/painel-fiscal";

const NIVEL_BG: Record<Nivel, string> = {
  verde: "bg-emerald-100 text-emerald-900 border-emerald-300",
  amarelo: "bg-amber-100 text-amber-900 border-amber-300",
  vermelho: "bg-rose-100 text-rose-900 border-rose-300",
  break: "bg-red-200 text-red-950 border-red-400",
  sem_dado: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const NIVEL_DOT: Record<Nivel, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-rose-500",
  break: "bg-red-700",
  sem_dado: "bg-zinc-300",
};

const NIVEL_LABEL: Record<Nivel, string> = {
  verde: "Verde",
  amarelo: "Atenção",
  vermelho: "Crítico",
  break: "BREAK",
  sem_dado: "Sem dado",
};

function fmtValor(v: number | null, sufixo = ""): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (Math.abs(v) > 1000) return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + sufixo;
  return v.toFixed(2) + sufixo;
}

function IndicadorCard({ id, ind }: { id: string; ind: IndicadorDalio }) {
  const sufixo = id.includes("bps")
    ? " bps"
    : id.includes("anos")
      ? " anos"
      : id === "reer_index"
        ? ""
        : "%";

  const faixas = [
    { nome: "Verde", val: ind.verde, cor: "bg-emerald-100 text-emerald-900" },
    { nome: "Amarelo", val: ind.amarelo, cor: "bg-amber-100 text-amber-900" },
    { nome: "Vermelho", val: ind.vermelho, cor: "bg-rose-100 text-rose-900" },
    { nome: "Break", val: ind.break, cor: "bg-red-200 text-red-950 font-bold" },
  ];

  return (
    <div className={`rounded-xl border p-4 ${NIVEL_BG[ind.nivel]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold leading-tight">{ind.titulo}</h3>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-70">{ind.categoria}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${NIVEL_DOT[ind.nivel]}`} />
          <span className="text-xs font-bold uppercase">{NIVEL_LABEL[ind.nivel]}</span>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide opacity-60">Atual (Brasil)</div>
          <div className="text-2xl font-bold">{fmtValor(ind.valor, sufixo)}</div>
        </div>
        {ind.distancia_break != null && ind.valor != null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide opacity-60">Distância ao break</div>
            <div className="text-sm font-medium">
              {ind.distancia_break > 0 ? "+" : ""}
              {fmtValor(ind.distancia_break, sufixo)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 text-[10px]">
        {faixas.map((f) => (
          <div key={f.nome} className={`rounded px-1 py-0.5 text-center ${f.cor}`}>
            <div className="font-semibold">{f.nome}</div>
            <div className="opacity-80">
              {ind.direcao === "maior_pior" ? "<" : ">"}
              {fmtValor(f.val, sufixo)}
            </div>
          </div>
        ))}
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-medium opacity-90 hover:opacity-100">Por que importa</summary>
        <div className="mt-2 space-y-2">
          <p className="leading-relaxed">{ind.narrativa}</p>
          <p className="text-[11px] opacity-80">
            <span className="font-semibold">Marcos históricos: </span>
            {ind.marcos}
          </p>
          <p className="text-[10px] opacity-60">Fonte: {ind.fonte}</p>
        </div>
      </details>
    </div>
  );
}

const CATEGORIAS_ORDEM = [
  "Carga de dívida",
  "Capacidade de pagamento",
  "Estrutura da dívida",
  "Detentores",
  "Sinais de stress",
];

export function TermometroFiscalDashboard({ data }: { data: FiscalTermometroData }) {
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);

  const indicadoresPorCategoria = useMemo(() => {
    const grupos: Record<string, Array<[string, IndicadorDalio]>> = {};
    Object.entries(data.indicadores).forEach(([id, ind]) => {
      if (!grupos[ind.categoria]) grupos[ind.categoria] = [];
      grupos[ind.categoria].push([id, ind]);
    });
    return grupos;
  }, [data]);

  const categoriasVisiveis = filtroCategoria ? [filtroCategoria] : CATEGORIAS_ORDEM;

  const contagemNiveis = useMemo(() => {
    const c: Record<Nivel, number> = { verde: 0, amarelo: 0, vermelho: 0, break: 0, sem_dado: 0 };
    Object.values(data.indicadores).forEach((i) => {
      c[i.nivel] = (c[i.nivel] ?? 0) + 1;
    });
    return c;
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <a href="/painel-economico/economia/brasil/fiscal" className="text-[#027DFC] hover:underline">
            ← Voltar pro painel Fiscal
          </a>
        </div>
        <h1 className="text-2xl font-bold text-[#132960]">Termômetro Fiscal</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          18 indicadores adaptados de <strong>How Countries Go Broke</strong> (Ray Dalio, 2025) ao Brasil.
          Cada indicador tem faixas verde / amarelo / vermelho / break baseadas em casos históricos do livro.
          Quando o Brasil cruza o break, é onde governos historicamente quebraram.
        </p>
      </header>

      {/* Score hero */}
      <section className={`rounded-2xl border-2 p-6 ${NIVEL_BG[data.score.nivel_geral]}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">Score consolidado</div>
            <div className="mt-1 text-3xl font-bold">
              {data.score.score_medio != null ? data.score.score_medio.toFixed(2) : "—"}
              <span className="ml-2 text-base font-normal opacity-70">/ 4.0</span>
            </div>
            <div className="mt-1 text-sm font-semibold uppercase">
              {NIVEL_LABEL[data.score.nivel_geral]} ({data.score.n_indicadores} indicadores com dado)
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="rounded-lg bg-white/60 px-3 py-2">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Verde: <strong>{contagemNiveis.verde}</strong>
            </div>
            <div className="rounded-lg bg-white/60 px-3 py-2">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              Atenção: <strong>{contagemNiveis.amarelo}</strong>
            </div>
            <div className="rounded-lg bg-white/60 px-3 py-2">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
              Crítico: <strong>{contagemNiveis.vermelho}</strong>
            </div>
            <div className="rounded-lg bg-white/60 px-3 py-2">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-700" />
              Break: <strong>{contagemNiveis.break}</strong>
            </div>
            <div className="rounded-lg bg-white/60 px-3 py-2">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-zinc-300" />
              Sem dado: <strong>{contagemNiveis.sem_dado}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Filtros por categoria */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroCategoria(null)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            filtroCategoria == null
              ? "bg-[#132960] text-white"
              : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
          }`}
        >
          Todas categorias
        </button>
        {CATEGORIAS_ORDEM.map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltroCategoria(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filtroCategoria === cat
                ? "bg-[#132960] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
            }`}
          >
            {cat} ({(indicadoresPorCategoria[cat] ?? []).length})
          </button>
        ))}
      </div>

      {/* Indicadores por categoria */}
      {categoriasVisiveis.map((cat) => {
        const items = indicadoresPorCategoria[cat] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-lg font-semibold text-[#132960]">{cat}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map(([id, ind]) => (
                <IndicadorCard key={id} id={id} ind={ind} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Metodologia */}
      <section className="rounded-2xl border border-[#132960]/10 bg-zinc-50 p-5 text-xs text-zinc-700">
        <h3 className="text-sm font-semibold text-[#132960]">Metodologia</h3>
        <p className="mt-2 leading-relaxed">{data.metodologia}</p>
        <p className="mt-3 text-[11px] opacity-70">
          Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR")}.
        </p>
      </section>
    </div>
  );
}
