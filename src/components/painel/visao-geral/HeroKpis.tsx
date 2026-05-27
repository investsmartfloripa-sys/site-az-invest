"use client";

import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { formatPct, formatMes, ultimaObs, sinalizacaoCor } from "@/lib/painel-visao-geral";

function KpiCard({
  titulo,
  tecnico,
  valor,
  subtitulo,
  variacao,
  cor,
  mes,
}: {
  titulo: string;
  tecnico: string;
  valor: string;
  subtitulo?: string;
  variacao?: string;
  cor: "verde" | "amarelo" | "vermelho" | "neutro";
  mes?: string | null;
}) {
  const corClass = {
    verde: "border-emerald-300 bg-emerald-50",
    amarelo: "border-amber-300 bg-amber-50",
    vermelho: "border-rose-300 bg-rose-50",
    neutro: "border-zinc-200 bg-white",
  }[cor];
  const dot = {
    verde: "bg-emerald-500",
    amarelo: "bg-amber-500",
    vermelho: "bg-rose-500",
    neutro: "bg-zinc-300",
  }[cor];
  return (
    <div className={`rounded-2xl border ${corClass} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{titulo}</div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">{tecnico}</div>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      </div>
      <div className="mt-3 text-3xl font-bold text-zinc-900">{valor}</div>
      {subtitulo && <div className="mt-1 text-xs text-zinc-600">{subtitulo}</div>}
      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{mes ? `Ref. ${formatMes(mes)}` : ""}</span>
        {variacao && <span className="font-medium">{variacao}</span>}
      </div>
    </div>
  );
}

export function HeroKpis({ payload }: { payload: VisaoGeralPayload }) {
  // KPI 1 — Atividade mensal (IBC-Br m/m dessaz)
  const ibc = ultimaObs(payload.ibcbr?.serie);
  const kpi1 = ibc?.var_mom ?? null;
  const kpi1Cor: "verde" | "amarelo" | "vermelho" | "neutro" =
    kpi1 === null ? "neutro" : kpi1 > 0 ? "verde" : kpi1 < -0.3 ? "vermelho" : "amarelo";

  // KPI 2 — Probabilidade de recessão (mediana dos modelos)
  const rec = ultimaObs(payload.recessao?.serie);
  const kpi2 = rec?.mediana ?? null;
  const kpi2Cor: "verde" | "amarelo" | "vermelho" | "neutro" =
    rec === null ? "neutro" : sinalizacaoToCor(rec.sinalizacao);

  // KPI 3 — Antecedente OECD CLI variação 6m anualizada
  const oe = ultimaObs(payload.oecdCli?.serie);
  const kpi3 = oe?.var_6m_anualizada ?? null;
  const kpi3Cor: "verde" | "amarelo" | "vermelho" | "neutro" =
    kpi3 === null ? "neutro" : kpi3 > 0.5 ? "verde" : kpi3 < -0.5 ? "vermelho" : "amarelo";

  // KPI 4 — ICF (z-score) → regime
  const icf = ultimaObs(payload.icf?.serie);
  const kpi4 = icf?.icf_zscore ?? null;
  const kpi4Cor: "verde" | "amarelo" | "vermelho" | "neutro" =
    icf === null
      ? "neutro"
      : icf.regime === "estimulativo"
        ? "verde"
        : icf.regime === "restritivo"
          ? "vermelho"
          : "amarelo";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        titulo="Atividade mensal"
        tecnico="IBC-Br dessaz, var. m/m"
        valor={formatPct(kpi1)}
        subtitulo="Proxy mensal do PIB calculada pelo BCB."
        variacao={ibc?.var_yoy !== null && ibc?.var_yoy !== undefined ? `12m: ${formatPct(ibc.var_yoy)}` : undefined}
        cor={kpi1Cor}
        mes={ibc?.mes}
      />
      <KpiCard
        titulo="Probabilidade de recessão"
        tecnico="Mediana 5 modelos"
        valor={kpi2 === null ? "—" : `${kpi2.toFixed(0)}%`}
        subtitulo={
          rec
            ? `${rec.n_acima_50} de ${rec.n_modelos} modelos > 50%`
            : "MS-DFM, probit, gap HP, diffusion, Bry-Boschan."
        }
        cor={kpi2Cor}
        mes={rec?.mes}
      />
      <KpiCard
        titulo="Antecedente OECD CLI"
        tecnico="Var. 6m anualizada"
        valor={formatPct(kpi3)}
        subtitulo="Adianta viradas de ciclo em 6-9 meses."
        cor={kpi3Cor}
        mes={oe?.mes}
      />
      <KpiCard
        titulo="Condições financeiras"
        tecnico="ICF próprio (z-score)"
        valor={kpi4 === null ? "—" : kpi4.toFixed(2)}
        subtitulo={
          icf
            ? icf.regime === "estimulativo"
              ? "Estimulativas — facilitam atividade"
              : icf.regime === "restritivo"
                ? "Restritivas — apertam atividade"
                : "Neutras"
            : "Selic real + Ibov 6m + REER (z-scores)."
        }
        cor={kpi4Cor}
        mes={icf?.mes}
      />
    </div>
  );
}

function sinalizacaoToCor(s: "verde" | "amarelo" | "vermelho"): "verde" | "amarelo" | "vermelho" {
  return s;
}
