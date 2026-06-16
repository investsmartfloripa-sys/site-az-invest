"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, LayoutGrid, type LucideIcon } from "lucide-react";
import {
  CATEGORIAS,
  ORDEM_CATEGORIAS,
  simuladores,
  type CategoriaSlug,
} from "@/data/simuladores";

type Filtro = CategoriaSlug | "todos";

const COR_TODOS = "#132960";

/**
 * Hub de simuladores com filtro por categoria. Os chips (Todos + uma categoria
 * cada) substituem o antigo subtítulo abaixo do título e filtram as seções
 * exibidas. "Todos" mostra a jornada completa (acumular → aposentar → comprar
 * → proteger); um chip de categoria isola só aquela seção.
 */
export function SimuladoresExplorer() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const categorias = filtro === "todos" ? ORDEM_CATEGORIAS : [filtro];

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
          Ferramentas de decisão financeira
        </p>
        <h1 className="text-4xl text-[#132960] md:text-5xl">Simuladores</h1>

        {/* Filtro por categoria (substitui o subtítulo). */}
        <div
          role="tablist"
          aria-label="Filtrar simuladores por categoria"
          className="flex flex-wrap gap-2 pt-1"
        >
          <FiltroChip
            ativo={filtro === "todos"}
            cor={COR_TODOS}
            icone={LayoutGrid}
            label="Todos"
            onClick={() => setFiltro("todos")}
          />
          {ORDEM_CATEGORIAS.map((slug) => {
            const cat = CATEGORIAS[slug];
            return (
              <FiltroChip
                key={slug}
                ativo={filtro === slug}
                cor={cat.cor}
                icone={cat.icone}
                label={cat.nome}
                onClick={() => setFiltro(slug)}
              />
            );
          })}
        </div>
      </header>

      {categorias.map((slug) => {
        const cat = CATEGORIAS[slug];
        const sims = simuladores.filter((sim) => sim.categoria === slug);
        if (sims.length === 0) return null;
        const CatIcon = cat.icone;

        return (
          <section key={slug} className="space-y-4">
            <div className="space-y-1.5">
              <p
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: cat.cor }}
              >
                <CatIcon className="h-4 w-4" aria-hidden />
                {cat.nome}
              </p>
              <p className="text-sm text-zinc-600">{cat.descricao}</p>
              <div
                className="h-0.5 w-full rounded-full"
                style={{ backgroundColor: `${cat.cor}33` }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {sims.map((sim) => {
                const SimIcon = sim.icone;
                return (
                  <Link
                    key={sim.slug}
                    href={`/simuladores/${sim.slug}`}
                    className="az-hover-lift group flex h-full flex-col gap-3 rounded-2xl border border-[#132960]/10 bg-white p-6 shadow-sm"
                    style={{ borderTopWidth: 3, borderTopColor: `${cat.cor}99` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${cat.cor}1A` }}
                      >
                        <SimIcon
                          className="h-5 w-5"
                          style={{ color: cat.cor }}
                          aria-hidden
                        />
                      </span>
                      {sim.popular && (
                        <span className="rounded-full bg-[#FF5713]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#FF5713]">
                          Mais usado
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-semibold text-[#132960]">
                      {sim.title}
                    </h2>
                    <p className="text-sm text-zinc-600">
                      Responde: <span className="italic">{sim.pergunta}</span>
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden />~
                        {sim.tempoMin} min
                      </span>
                      <span
                        className="text-xs font-semibold group-hover:underline"
                        style={{ color: cat.cor }}
                      >
                        Abrir simulador <span aria-hidden>→</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FiltroChip({
  ativo,
  cor,
  icone: Icone,
  label,
  onClick,
}: {
  ativo: boolean;
  cor: string;
  icone: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      style={
        ativo
          ? { backgroundColor: cor, borderColor: cor, color: "#fff" }
          : { borderColor: `${cor}40`, color: cor }
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
        ativo ? "shadow-sm" : "bg-white hover:bg-[#132960]/[0.03]"
      }`}
    >
      <Icone className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
