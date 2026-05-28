"use client";

import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { formatPct, formatMes, ultimaObs } from "@/lib/painel-visao-geral";

function KpiCard({
  titulo,
  tecnico,
  valor,
  subtitulo,
  variacao,
  cor,
  mes,
  destaque,
}: {
  titulo: string;
  tecnico: string;
  valor: string;
  subtitulo?: string;
  variacao?: string;
  cor: "verde" | "amarelo" | "vermelho" | "neutro";
  mes?: string | null;
  destaque?: boolean;
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
  const valorSize = destaque ? "text-4xl md:text-5xl" : "text-3xl";
  const padding = destaque ? "p-6" : "p-5";
  const ringExtra = destaque ? "ring-2 ring-[#132960]/10" : "";
  return (
    <div className={`rounded-2xl border ${corClass} ${padding} shadow-sm ${ringExtra}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{titulo}</div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">{tecnico}</div>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      </div>
      <div className={`mt-3 ${valorSize} font-bold text-zinc-900`}>{valor}</div>
      {subtitulo && <div className="mt-1 text-xs text-zinc-600">{subtitulo}</div>}
      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{mes ? `Ref. ${formatMes(mes)}` : ""}</span>
        {variacao && <span className="font-medium">{variacao}</span>}
      </div>
    </div>
  );
}

export function HeroKpis({ payload }: { payload: VisaoGeralPayload }) {
  // KPI 1 - Atividade mensal (IBC-Br m/m dessaz)
  const ibc = ultimaObs(payload.ibcbr?.serie);
  const kpi1 = ibc?.var_mom ?? null;
  const kpi1Cor: "verde" | "amarelo" | "vermelho" | "neutro" =
    kpi1 === null ? "neutro" : kpi1 > 0 ? "verde" : kpi1 < -0.3 ? "vermelho" : "amarelo";

  // KPI 2 - Probabilidade de recessão (mediana dos modelos, com tratamento de amostra insuficiente)
  const rec = ultimaObs(payload.recessao?.serie);
  const sensiveisPresentes = rec?.sensiveis_presentes ?? 0;
  const amostraInsuficiente = !!rec && sensiveisPresentes === 0;
  const kpi2 = rec?.mediana ?? rec?.mediana_parcial ?? null;
  const kpi2Cor: "verde" | "amarelo" | "vermelho" | "neutro" =
    !rec ? "neutro" : amostraInsuficiente || rec.sinalizacao === "indeterminado" ? "neutro" : sinalizacaoToCor(rec.sinalizacao as any);

  // KPI 3 - Confiança Empresarial FGV (ICE) - antes era OECD CLI (stale dez/2023)
  const ice = ultimaObs(payload.fgvConfianca?.ice);
  const kpi3 = ice?.valor ?? null;
  const kpi3Cor: "verde" | "amarelo" | "vermelho" | "neutro" =
    kpi3 === null ? "neutro" : kpi3 > 100 ? "verde" : kpi3 < 90 ? "vermelho" : "amarelo";

  // KPI 4 - ICF (z-score) -> regime
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

  // Tecnico e subtitulo do KPI Recessao - tratamento explicito de amostra insuficiente
  const kpi2Tecnico = amostraInsuficiente
    ? "Amostra insuficiente"
    : rec && rec.n_modelos < 4
      ? `Cobertura ${rec.n_modelos}/4 modelos`
      : "Mediana 4 modelos prob.";
  const kpi2Valor = amostraInsuficiente
    ? "n/d"
    : kpi2 === null
      ? "—"
      : `${kpi2.toFixed(0)}%`;
  const kpi2Subtitulo = amostraInsuficiente
    ? `Modelos sensíveis (Probit + Diffusion) ausentes · ${rec?.n_modelos ?? 0}/4 rodaram`
    : rec
      ? `${rec.n_acima_50} dispararam alerta · ${rec.n_modelos}/4 rodaram${rec.sinalizacao === "indeterminado" ? " (sinal incompleto)" : ""}`
      : "MS-DFM, probit, gap HP, diffusion (probabilísticos).";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
      <div className="md:col-span-2">
        <KpiCard
          titulo="Atividade mensal"
          tecnico="IBC-Br dessaz, var. m/m"
          valor={formatPct(kpi1)}
          subtitulo="Proxy mensal do PIB calculada pelo BCB."
          variacao={ibc?.var_yoy !== null && ibc?.var_yoy !== undefined ? `12m: ${formatPct(ibc.var_yoy)}` : undefined}
          cor={kpi1Cor}
          mes={ibc?.mes}
        />
      </div>
      <div className="md:col-span-2 md:row-span-1">
        <KpiCard
          titulo="Probabilidade de recessão"
          tecnico={kpi2Tecnico}
          valor={kpi2Valor}
          subtitulo={kpi2Subtitulo}
          cor={kpi2Cor}
          mes={rec?.mes}
          destaque
        />
      </div>
      <div className="md:col-span-2">
        <KpiCard
          titulo="Confiança Empresarial FGV"
          tecnico="ICE (FGV-IBRE via SGS)"
          valor={kpi3 === null ? "—" : kpi3.toFixed(1)}
          subtitulo="100 = neutro. Acima = otimismo, abaixo = pessimismo."
          cor={kpi3Cor}
          mes={ice?.mes}
        />
      </div>
      <div className="md:col-span-3">
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
      <div className="md:col-span-3">
        <KpiCard
          titulo="Hiato do produto"
          tecnico="Mediana HP+Hamilton"
          valor={(() => {
            const h = ultimaObs(payload.hiato?.serie);
            if (!h) return "—";
            const m = ((h.gap_hp_pct ?? 0) + (h.gap_hamilton_pct ?? 0)) / 2;
            return `${m.toFixed(2)}%`;
          })()}
          subtitulo="Acima de 0 = aquecimento; abaixo = ociosidade."
          cor="neutro"
          mes={payload.hiato?.mes_recente}
        />
      </div>
    </div>
  );
}

function sinalizacaoToCor(s: "verde" | "amarelo" | "vermelho"): "verde" | "amarelo" | "vermelho" {
  return s;
}
