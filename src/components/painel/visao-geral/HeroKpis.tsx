"use client";

import type { VisaoGeralPayload } from "@/lib/painel-visao-geral";
import { formatPct, formatMes, ultimaObs, resumoProbabilidade } from "@/lib/painel-visao-geral";

function KpiCard({
  titulo,
  tecnico,
  valor,
  subtitulo,
  variacao,
  cor,
  mes,
  selo,
  hint,
}: {
  titulo: string;
  tecnico: string;
  valor: string;
  subtitulo?: string;
  variacao?: string;
  cor: "verde" | "amarelo" | "vermelho" | "neutro";
  mes?: string | null;
  selo?: { texto: string; classe: string };
  hint?: string;
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
  return (
    <div className={`rounded-2xl ${corClass} p-3 shadow-sm`} title={hint}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-zinc-900">{titulo}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">{tecnico}</div>
        </div>
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      </div>
      <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
        <div className="text-2xl font-bold leading-none text-zinc-900">{valor}</div>
        {selo && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${selo.classe}`}>
            {selo.texto}
          </span>
        )}
      </div>
      {subtitulo && <div className="mt-1 text-[10px] leading-tight text-zinc-600">{subtitulo}</div>}
      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
        <span>{mes ? `Ref. ${formatMes(mes)}` : ""}</span>
        {variacao && <span className="font-medium">{variacao}</span>}
      </div>
    </div>
  );
}

export function HeroKpis({ payload }: { payload: VisaoGeralPayload }) {
  // KPI 1 - Risco de recessão (FONTE ÚNICA: probabilidades.mediana / sinal_principal do JSON)
  const prob = resumoProbabilidade(payload.probitAz);
  const probPct = prob.valor !== null && prob.valor !== undefined ? prob.valor * 100 : null;
  const kpiProbCor: "verde" | "amarelo" | "vermelho" | "neutro" =
    probPct === null ? "neutro" : probPct >= 65 ? "vermelho" : probPct >= 35 ? "amarelo" : "verde";
  const kpiProbTecnico = prob.usaFallback
    ? "Probit AZ isolado"
    : probPct === null
      ? "Modelos causais"
      : `Mediana de ${prob.nModelos} de 4 modelos`;
  const kpiProbSubtitulo =
    probPct === null
      ? "Nenhum modelo disponível nesta rodada — aguardando pipeline."
      : prob.usaFallback
        ? `${prob.nModelos} de 4 modelos disponíveis — mediana indisponível. Backtest formal em construção.`
        : `${prob.nAcima50} de ${prob.nModelos} acima de 50% · backtest formal em construção`;

  // KPI 2 - Atividade: ritmo trimestral do IBC-Br (3m/3m dessaz, convenção BCB RI)
  const ibc = ultimaObs(payload.ibcbr?.serie);
  const ritmo = ibc?.var_ritmo_trimestral ?? null;
  const temRitmo = ritmo !== null && ritmo !== undefined;
  const atividadeValor = temRitmo ? ritmo : ibc?.var_mom ?? null;
  // Banda neutra de cor centrada no potencial (+0,5% t/t ±0,5pp), NÃO em zero
  const atividadeCor: "verde" | "amarelo" | "vermelho" | "neutro" = !temRitmo
    ? atividadeValor === null
      ? "neutro"
      : atividadeValor > 0
        ? "verde"
        : atividadeValor < -0.3
          ? "vermelho"
          : "amarelo"
    : ritmo > 1
      ? "verde"
      : ritmo < 0
        ? "vermelho"
        : "amarelo";
  const secundarios: string[] = [];
  if (ibc?.var_mom !== null && ibc?.var_mom !== undefined) secundarios.push(`m/m ${formatPct(ibc.var_mom)}`);
  if (ibc?.var_yoy_mm3 !== null && ibc?.var_yoy_mm3 !== undefined) secundarios.push(`a/a mm3 ${formatPct(ibc.var_yoy_mm3)}`);

  // KPI 3 - Hiato: faixa mín–máx + mediana (nunca número único)
  const hiatoUltimo = ultimaObs(payload.hiato?.serie);
  const gapMediana = hiatoUltimo?.gap_mediana_pct ?? null;
  const gapMin = hiatoUltimo?.gap_min_pct ?? null;
  const gapMax = hiatoUltimo?.gap_max_pct ?? null;
  const temFaixa = gapMin !== null && gapMin !== undefined && gapMax !== null && gapMax !== undefined;
  const hiatoValor = gapMediana !== null && gapMediana !== undefined ? formatPct(gapMediana, 1) : "—";
  const hiatoSubtitulo = temFaixa
    ? `entre ${formatPct(gapMin, 1)} e ${formatPct(gapMax, 1)} — métodos divergem; mostramos a faixa.`
    : "Acima de 0 = aquecimento; abaixo = ociosidade.";

  // KPI 4 - Confiança Empresarial FGV (ICE)
  const ice = ultimaObs(payload.fgvConfianca?.ice);
  const kpiIce = ice?.valor ?? null;
  const kpiIceCor: "verde" | "amarelo" | "vermelho" | "neutro" =
    kpiIce === null ? "neutro" : kpiIce > 100 ? "verde" : kpiIce < 90 ? "vermelho" : "amarelo";

  // KPI 5 - Condições financeiras: juro real ex-ante como número principal; z-score só no hint
  const icf = ultimaObs(payload.icf?.serie);
  const selicReal = icf?.selic_real_ex_ante_pct ?? null;
  const regime = icf?.regime ?? null;
  const icfCor: "verde" | "amarelo" | "vermelho" | "neutro" =
    regime === null ? "neutro" : regime === "estimulativo" ? "verde" : regime === "restritivo" ? "vermelho" : "amarelo";
  const seloRegime =
    regime === null
      ? undefined
      : regime === "estimulativo"
        ? { texto: "estimulativo", classe: "bg-emerald-100 text-emerald-700" }
        : regime === "restritivo"
          ? { texto: "restritivo", classe: "bg-rose-100 text-rose-700" }
          : { texto: "neutro", classe: "bg-amber-100 text-amber-700" };
  const icfHint =
    icf?.icf_zscore !== null && icf?.icf_zscore !== undefined
      ? `ICF z-score: ${icf.icf_zscore.toFixed(2)} (Selic real invertida + Ibov 6m + REER)`
      : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        titulo="Risco de recessão"
        tecnico={kpiProbTecnico}
        valor={probPct === null ? "n/d" : `${probPct.toFixed(0)}%`}
        subtitulo={kpiProbSubtitulo}
        cor={kpiProbCor}
        mes={prob.mes}
      />
      <KpiCard
        titulo="Atividade"
        tecnico={temRitmo ? "ritmo trimestral (3m/3m dessaz)" : "IBC-Br m/m dessaz"}
        valor={formatPct(atividadeValor)}
        subtitulo={
          temRitmo
            ? "Banda neutra: 0% a +1% t/t (potencial +0,5% ±0,5pp)."
            : "Proxy mensal do PIB calculada pelo BCB."
        }
        variacao={secundarios.length > 0 ? secundarios.join(" · ") : undefined}
        cor={atividadeCor}
        mes={ibc?.mes}
      />
      <KpiCard
        titulo="Hiato do produto"
        tecnico="Mediana de 3 métodos"
        valor={hiatoValor}
        selo={temFaixa ? { texto: "entre mín e máx", classe: "bg-zinc-100 text-zinc-600" } : undefined}
        subtitulo={hiatoSubtitulo}
        cor="neutro"
        mes={payload.hiato?.mes_recente}
      />
      <KpiCard
        titulo="Confiança Empresarial FGV"
        tecnico="ICE (FGV-IBRE via SGS)"
        valor={kpiIce === null ? "—" : kpiIce.toFixed(1)}
        subtitulo="100 = neutro. Acima = otimismo, abaixo = pessimismo."
        cor={kpiIceCor}
        mes={ice?.mes}
      />
      <KpiCard
        titulo="Condições financeiras"
        tecnico="Juro real ex-ante"
        valor={selicReal === null || selicReal === undefined ? "—" : `${selicReal.toFixed(1)}%`}
        subtitulo="Selic meta menos IPCA esperado 12m (Focus, suavizada)."
        cor={icfCor}
        mes={icf?.mes}
        selo={seloRegime}
        hint={icfHint}
      />
    </div>
  );
}
