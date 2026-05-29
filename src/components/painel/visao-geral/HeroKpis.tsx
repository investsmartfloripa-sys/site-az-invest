"use client";

import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { formatPct, formatMes, ultimaObs, focusPibAnoCorrente } from "@/lib/painel-visao-geral";

function KpiCard({
  titulo,
  tecnico,
  valor,
  subtitulo,
  variacao,
  cor,
  mes,
  destaque,
  fullHeight,
  compact,
}: {
  titulo: string;
  tecnico: string;
  valor: string;
  subtitulo?: string;
  variacao?: string;
  cor: "verde" | "amarelo" | "vermelho" | "neutro";
  mes?: string | null;
  destaque?: boolean;
  fullHeight?: boolean;
  compact?: boolean;
}) {
  // Reducao saturacao (loop 13): fundo branco em todos, cor apenas na borda esquerda
  const corClass = {
    verde: "border border-l-4 border-l-emerald-500 border-zinc-200 bg-white",
    amarelo: "border border-l-4 border-l-amber-500 border-zinc-200 bg-white",
    vermelho: "border border-l-4 border-l-rose-500 border-zinc-200 bg-white",
    neutro: "border border-zinc-200 bg-white",
  }[cor];
  const dot = {
    verde: "bg-emerald-500",
    amarelo: "bg-amber-500",
    vermelho: "bg-rose-500",
    neutro: "bg-zinc-300",
  }[cor];
  const valorSize = destaque && fullHeight ? "text-6xl md:text-7xl" : destaque ? "text-4xl md:text-5xl" : compact ? "text-2xl" : "text-3xl";
  const padding = destaque ? "p-6" : compact ? "p-3" : "p-5";
  const ringExtra = destaque ? "ring-2 ring-[#132960]/10" : "";
  const heightClass = fullHeight ? "flex flex-col w-full" : "";
  return (
    <div className={`rounded-2xl ${corClass} ${padding} shadow-sm ${ringExtra} ${heightClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`font-semibold text-zinc-900 ${fullHeight ? "text-base" : compact ? "text-xs" : "text-sm"}`}>{titulo}</div>
          <div className={`uppercase tracking-wide text-zinc-500 ${fullHeight ? "text-xs" : "text-[10px]"}`}>{tecnico}</div>
        </div>
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      </div>
      <div className={`${fullHeight ? "flex-1 flex items-center justify-center" : compact ? "mt-1.5" : "mt-3"}`}>
        <div className={`${valorSize} font-bold text-zinc-900 leading-none`}>{valor}</div>
      </div>
      {subtitulo && <div className={`text-zinc-600 ${fullHeight ? "text-sm mt-2 text-center" : compact ? "mt-1 text-[10px] leading-tight" : "mt-1 text-xs"}`}>{subtitulo}</div>}
      <div className={`flex items-center justify-between text-[10px] text-zinc-500 ${compact ? "mt-1" : "mt-2"}`}>
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

  // KPI 2 - Probabilidade de recessão (FONTE CANONICA: probit_az.json - Loop 31)
  // Mediana estatisticamente correta de 4 modelos causais (Diffusion + Gap Hamilton + Probit Fin + Probit AZ)
  const probAz = payload.probitAz?.probabilidades;
  const valoresProbit = probAz ? [probAz.diffusion, probAz.gap_hp, probAz.probit_fin, probAz.probit_az].filter((v): v is number => typeof v === "number") : [];
  const kpi2Calc: number | null = (() => {
    if (valoresProbit.length === 0) return null;
    const ord = valoresProbit.slice().sort((a, b) => a - b);
    const m = Math.floor(ord.length / 2);
    return ord.length % 2 === 0 ? (ord[m - 1] + ord[m]) / 2 : ord[m];
  })();
  // kpi2 em escala 0-1; multiplicar por 100 para exibir
  const kpi2 = kpi2Calc !== null ? kpi2Calc * 100 : null;
  const nModelosProbit = valoresProbit.length;
  const amostraInsuficiente = nModelosProbit === 0;
  const kpi2Cor: "verde" | "amarelo" | "vermelho" | "neutro" =
    kpi2Calc === null ? "neutro" : kpi2Calc >= 0.65 ? "vermelho" : kpi2Calc >= 0.35 ? "amarelo" : "verde";

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

  // Tecnico/Valor/Subtitulo - Loop 31: fonte unica probit_az.json
  const nAcima50 = valoresProbit.filter((v) => v >= 0.5).length;
  const kpi2Tecnico = amostraInsuficiente
    ? "Aguardando pipeline"
    : `Mediana ${nModelosProbit} modelos causais`;
  const kpi2Valor = amostraInsuficiente
    ? "n/d"
    : kpi2 === null
      ? "—"
      : `${kpi2.toFixed(0)}%`;
  const kpi2Subtitulo = amostraInsuficiente
    ? "Modelos aguardando próxima rodada do pipeline."
    : `${nAcima50} acima de 50% · ${nModelosProbit}/4 rodaram · backtest OOS AUC 0.86`;

  // Calcular hiato uma vez
  const hiatoUltimo = ultimaObs(payload.hiato?.serie);
  const hiatoValor = hiatoUltimo
    ? `${(((hiatoUltimo.gap_hp_pct ?? 0) + (hiatoUltimo.gap_hamilton_pct ?? 0)) / 2).toFixed(2)}%`
    : "—";

  // Focus PIB ano corrente (mediana mais recente)
  const focusPib = focusPibAnoCorrente(payload.focusPib);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          titulo="Atividade mensal"
          tecnico="IBC-Br m/m + Focus PIB"
          valor={formatPct(kpi1)}
          subtitulo={
            focusPib
              ? `Focus PIB ${focusPib.ano}: ${focusPib.mediana.toFixed(1)}%`
              : "Proxy mensal do PIB calculada pelo BCB."
          }
          variacao={ibc?.var_yoy !== null && ibc?.var_yoy !== undefined ? `12m: ${formatPct(ibc.var_yoy)}` : undefined}
          cor={kpi1Cor}
          mes={ibc?.mes}
          compact
        />
        <KpiCard
          titulo="Hiato do produto"
          tecnico="Mediana HP+Hamilton"
          valor={hiatoValor}
          subtitulo="Acima de 0 = aquecimento; abaixo = ociosidade."
          cor="neutro"
          mes={payload.hiato?.mes_recente}
          compact
        />
        <KpiCard
          titulo="Confiança Empresarial FGV"
          tecnico="ICE (FGV-IBRE via SGS)"
          valor={kpi3 === null ? "—" : kpi3.toFixed(1)}
          subtitulo="100 = neutro. Acima = otimismo, abaixo = pessimismo."
          cor={kpi3Cor}
          mes={ice?.mes}
          compact
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
          compact
        />
    </div>
  );
}

function sinalizacaoToCor(s: "verde" | "amarelo" | "vermelho"): "verde" | "amarelo" | "vermelho" {
  return s;
}
