"use client";

import { useState, type ReactNode } from "react";

type TabId = "visao" | "analitico";

/**
 * Abas da página de FIIs (Visão geral / Analítico) — mesmo visual das abas da página de Ações
 * (RendaVariavelClient). Só a aba ativa é montada: Recharts dentro de container escondido mede
 * largura zero e o gráfico some (docs/ARMADILHAS.md).
 */
export function FiiAbas({ visao, analitico }: { visao: ReactNode; analitico: ReactNode }) {
  const [tab, setTab] = useState<TabId>("visao");
  const tabBtn = (id: TabId, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        tab === id ? "bg-white text-[#132960] shadow-sm" : "text-zinc-500 hover:text-[#132960]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-[#132960]/15 bg-zinc-100/70 p-1">
        {tabBtn("visao", "Visão geral")}
        {tabBtn("analitico", "Analítico")}
      </div>
      {tab === "visao" ? <div className="space-y-6">{visao}</div> : <div className="space-y-6">{analitico}</div>}
    </div>
  );
}
