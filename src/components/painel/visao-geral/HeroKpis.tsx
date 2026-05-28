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
  fullHeight,
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
  const valorSize = destaque && fullHeight ? "text-6xl md:text-7xl" : destaque ? "text-4xl md:text-5xl" : "text-3xl";
  const padding = destaque ? "p-6" : "p-5";
  const ringExtra = destaque ? "ring-2 ring-[#132960]/10" : "";
  const heightClass = fullHeight ? "flex flex-col w-full" : "";
  return (
    <div className={`rounded-2xl ${corClass} ${padding} shadow-sm ${ringExtra} ${heightClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`font-semibold text-zinc-900 ${fullHeight ? "text-base" : "text-sm"}`}>{titulo}</div>
          <div className={`uppercase tracking-wide text-zinc-500 ${fullHeight ? "text-xs" : "text-[11px]"}`}>{tecnico}</div>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      </div>
      <div className={`${fullHeight ? "flex-1 flex items-center justify-center" : "mt-3"}`}>
        <div className={`${valorSize} font-bold text-zinc-900 leading-none`}>{valor}</div>
      </div>
      {subtitulo && <div className={`text-zinc-600 ${fullHeight ? "text-sm mt-2 text-center" : "mt-1 text-xs"}`}>{subtitulo}</div>}
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

  // Tecnico e subtitulo do KPI Recessao (loop 15): se ha mediana_parcial, mostrar X%* com asterisco
  const medParcial = rec?.mediana_parcial;
  const kpi2Tecnico = amostraInsuficiente
    ? `Parcial — ${rec?.n_modelos ?? 0} de 4 modelos`
    : rec && rec.n_modelos < 4
      ? `Cobertura ${rec.n_modelos}/4 modelos`
      : "Mediana 4 modelos prob.";
  const kpi2Valor = amostraInsuficiente
    ? (medParcial !== null && medParcial !== undefined ? `${medParcial.toFixed(0)}%*` : "n/d")
    : kpi2 === null
      ? "—"
      : `${kpi2.toFixed(0)}%`;
  const kpi2Subtitulo = amostraInsuficiente
    ? `* Modelos sensíveis (Probit/Diffusion) aguardando próxima rodada. Sinal preliminar baseado em ${rec?.n_modelos ?? 0}/4 modelos.`
    : rec
      ? `${rec.n_acima_50} dispararam alerta · ${rec.n_modelos}/4 rodaram${rec.sinalizacao === "indeterminado" ? " (sinal incompleto)" : ""}`
      : "MS-AR, probit, gap HP, diffusion (probabilísticos).";

  // Calcular hiato uma vez
  const hiatoUltimo = ultimaObs(payload.hiato?.serie);
  const hiatoValor = hiatoUltimo
    ? `${(((hiatoUltimo.gap_hp_pct ?? 0) + (hiatoUltimo.gap_hamilton_pct ?? 0)) / 2).toFixed(2)}%`
    : "—";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* COLUNA ESQUERDA: Recessao full-height destaque */}
      <div className="md:row-span-4 flex">
        <KpiCard
          titulo="Probabilidade de recessão"
          tecnico={kpi2Tecnico}
          valor={kpi2Valor}
          subtitulo={kpi2Subtitulo}
          cor={kpi2Cor}
          mes={rec?.mes}
          destaque
          fullHeight
        />
      </div>

      {/* COLUNA DIREITA: 4 KPIs empilhados */}
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
        titulo="Confiança Empresarial FGV"
        tecnico="ICE (FGV-IBRE via SGS)"
        valor={kpi3 === null ? "—" : kpi3.toFixed(1)}
        subtitulo="100 = neutro. Acima = otimismo, abaixo = pessimismo."
        cor={kpi3Cor}
        mes={ice?.mes}
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
      <KpiCard
        titulo="Hiato do produto"
        tecnico="Mediana HP+Hamilton"
        valor={hiatoValor}
        subtitulo="Acima de 0 = aquecimento; abaixo = ociosidade."
        cor="neutro"
        mes={payload.hiato?.mes_recente}
      />
    </div>
  );
}

function sinalizacaoToCor(s: "verde" | "amarelo" | "vermelho"): "verde" | "amarelo" | "vermelho" {
  return s;
}
