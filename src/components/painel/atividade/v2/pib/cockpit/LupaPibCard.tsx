"use client";

import { useCallback, useMemo, useState } from "react";

import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzXRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import { AzSegmented, ChartCard, CockpitChip, tomPorSinal, type CockpitChipTom } from "@/components/painel/core";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import type { AtividadeCodaceData, AtividadePibData } from "@/lib/painel-atividade";
import { baixarCsv, codaceAreas, fmtTrimCurto, num } from "../../shared";
import {
  BTN_CSV_CLASS,
  RECORTES_DEMANDA,
  RECORTES_OFERTA,
  ROTULO_CURTO,
  blocoDoPib,
  lentePib,
  lentesDisponiveis,
  rotuloRecorte,
  seriePib,
  ultimoPib,
  type LentePib,
  type LentePibId,
} from "../cockpit-shared";

/**
 * Recorte sob a lupa (cockpit do PIB): UM dos 23 recortes da CNT (17 da oferta +
 * 6 da demanda) × UMA das 9 lentes (4 variações da 5932, índice SA/NS da
 * 1621/1620, R$ SA/NS a preços de 1995 da 6613/6612 e % do PIB nominal da 1846).
 * Substitui SetorLupaPib + ComponenteLupaDemandaPib. O recorte é controlado pelo
 * pai; a lente é interna salvo quando `onLenteChange` vier.
 */

const LENTE_DEFAULT: LentePibId = "idx_sa";
const ALTURA = 280;
const ZERO_LINE: AzRefLine[] = [{ y: 0 }];

/** Valor formatado com a unidade da lente (chip e estado vazio). */
function fmtValorLente(lente: LentePib, v: number | null): string {
  if (v == null) return "—";
  switch (lente.grupo) {
    case "variacao":
      return fmtSignedPct(v, 1);
    case "peso":
      return `${fmtPct(v, 1)} do PIB`;
    default:
      return lente.unit === "index" ? `${fmtNum(v, 1)} (1995 = 100)` : `R$ ${fmtNum(v, 1)} bi`;
  }
}

/** Texto da coluna "unidade" do CSV. */
function unidadeCsv(lente: LentePib): string {
  switch (lente.grupo) {
    case "variacao":
      return "% (variacao real)";
    case "peso":
      return "% do PIB nominal";
    default:
      return lente.unit === "index" ? "indice (media 1995 = 100)" : "R$ bilhoes a precos de 1995";
  }
}

export function LupaPibCard({
  pib,
  codace,
  geradoEm,
  recorte,
  onRecorteChange,
  lente: lenteProp,
  onLenteChange,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
  /** Chave do recorte (ex.: "pib", "fbcf") — controlado pelo pai. */
  recorte: string;
  onRecorteChange: (k: string) => void;
  /** Lente ativa. Sem `onLenteChange`, vira só o valor inicial do estado interno. */
  lente?: LentePibId;
  onLenteChange?: (id: LentePibId) => void;
}) {
  const controlada = onLenteChange != null;
  const [lenteInterna, setLenteInterna] = useState<LentePibId>(lenteProp ?? LENTE_DEFAULT);
  const lentePedida: LentePibId = controlada ? (lenteProp ?? LENTE_DEFAULT) : lenteInterna;

  const setLente = useCallback(
    (id: LentePibId) => {
      if (onLenteChange) onLenteChange(id);
      else setLenteInterna(id);
    },
    [onLenteChange],
  );

  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });

  // Só as lentes com pelo menos um ponto para o recorte (evita combinações
  // mortas: impostos × QoQ SA/índice SA/R$ SA, estoques fora de % PIB, PIB × % PIB).
  const disponiveis = useMemo(() => lentesDisponiveis(pib, recorte), [pib, recorte]);

  // Lente exibida = a pedida, ou a PRIMEIRA disponível quando ela não existe
  // para o recorte (derivado no render — sem efeito, sem render em cascata).
  const lenteAtiva: LentePib = useMemo(
    () => disponiveis.find((l) => l.id === lentePedida) ?? disponiveis[0] ?? lentePib(lentePedida),
    [disponiveis, lentePedida],
  );

  // Troca de recorte pelo <select>: se a lente atual morre no recorte novo,
  // o estado (interno ou do pai) já cai para a primeira disponível no próprio
  // handler. Trocas de recorte vindas do pai seguem cobertas pelo fallback acima.
  const trocarRecorte = (k: string) => {
    onRecorteChange(k);
    const novas = lentesDisponiveis(pib, k);
    if (novas.length > 0 && !novas.some((l) => l.id === lenteAtiva.id)) setLente(novas[0].id);
  };

  const data = useMemo(() => seriePib(pib, lenteAtiva, recorte), [pib, lenteAtiva, recorte]);
  const minIso = data.length ? data[0][0] : undefined;
  const maxIso = data.length ? data[data.length - 1][0] : undefined;

  const ultimo = useMemo(() => ultimoPib(pib, lenteAtiva, recorte), [pib, lenteAtiva, recorte]);

  const faixasCodace = useMemo<AzXRefArea[]>(() => codaceAreas(codace?.trimestral), [codace]);

  const rotulo = rotuloRecorte(pib, recorte);
  const rotuloCurto = ROTULO_CURTO[recorte] ?? rotulo;

  const tomChip: CockpitChipTom = lenteAtiva.grupo === "variacao" ? tomPorSinal(ultimo?.valor) : "navy";
  const textoChip = `${rotuloCurto} · ${lenteAtiva.label} · ${ultimo ? fmtTrimCurto(ultimo.trim) : "—"}: ${fmtValorLente(
    lenteAtiva,
    ultimo?.valor ?? null,
  )}`;

  const baixar = () => {
    const rows = blocoDoPib(pib, lenteAtiva.bloco);
    const campo = lenteAtiva.chave(recorte);
    const unidade = unidadeCsv(lenteAtiva);
    const linhas: (string | number | null)[][] = [];
    for (const r of rows) {
      const v = num(r, campo);
      if (v == null) continue;
      linhas.push([String(r.trim), recorte, lenteAtiva.id, lenteAtiva.escala ? +(v / lenteAtiva.escala).toFixed(3) : v, unidade]);
    }
    baixarCsv(`pib-lupa-${recorte}-${lenteAtiva.id}-${ultimo?.trim ?? pib.trim_recente}.csv`, ["trimestre", "recorte", "lente", "valor", "unidade"], linhas);
  };

  const selectClass =
    "max-w-[240px] rounded-lg border border-[#132960]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[#132960] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027DFC]";

  return (
    <ChartCard
      id="pib-lupa"
      title="Recorte sob a lupa — 9 lentes da CNT"
      subtitle="SIDRA 5932 / 1620 / 1621 / 6612 / 6613 / 1846 · um recorte × uma transformação por vez: 4 variações (QoQ SA · YoY · acum. 4T · acum. ano), 4 níveis (índice SA · índice NS · R$ SA · R$ NS a preços de 1995) e peso no PIB nominal"
      toolbar={
        <>
          <select aria-label="Recorte da CNT" value={recorte} onChange={(e) => trocarRecorte(e.target.value)} className={selectClass}>
            <optgroup label="Oferta">
              {RECORTES_OFERTA.map((r) => (
                <option key={r.key} value={r.key}>
                  {rotuloRecorte(pib, r.key)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Demanda">
              {RECORTES_DEMANDA.map((r) => (
                <option key={r.key} value={r.key}>
                  {rotuloRecorte(pib, r.key)}
                </option>
              ))}
            </optgroup>
          </select>
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["5y", "10y", "max"]} />
          <button type="button" onClick={baixar} disabled={data.length === 0} className={`${BTN_CSV_CLASS} disabled:opacity-40`}>
            Baixar CSV
          </button>
        </>
      }
      footer={
        <span>
          <span className="block">
            <strong>Lente ativa — {lenteAtiva.label}:</strong> {lenteAtiva.fonte}. Fonte: IBGE, Contas Nacionais Trimestrais
            (SIDRA). Recorte: {rotulo}.
          </span>
          <span className="mt-1.5 block">
            <strong>Glossário:</strong> QoQ SA = variação vs trimestre anterior, com ajuste sazonal; YoY = vs mesmo trimestre
            do ano anterior; acum. 4T = últimos 4 trimestres vs os 4 anteriores; acum. ano = do 1º trimestre ao corrente vs
            mesmo período do ano anterior; SA/NS = com/sem ajuste sazonal; índice = volume encadeado, média de 1995 = 100;
            R$ = valores encadeados a preços de 1995, em bilhões; % PIB = participação no PIB nominal a preços correntes.
          </span>
          <span className="mt-1.5 block">
            <strong>Lentes ausentes por recorte:</strong> o seletor mostra só as lentes com dado. Impostos líquidos sobre
            produtos — a 1621/6613 não publicam índice/R$ com ajuste sazonal e a 5932 não publica QoQ SA (restam YoY,
            acumulados, índice NS, R$ NS e % PIB). Variação de estoques — existe apenas em % do PIB nominal (1846); a
            1620/1621/5932/6612/6613 não publicam volume nem variação real desse item. PIB — não tem % PIB (é a base, 100%).
          </span>
          <span className="mt-1.5 block">
            Faixas cinzas = recessões CODACE/FGV-IBRE, só nas lentes de nível. Linha zero nas variações (aparece quando o
            zero cai dentro do intervalo da série na janela). CSV: série completa do recorte × lente ativa, na unidade
            exibida.
          </span>
        </span>
      }
      stampGiro={geradoEm}
      stampDado={ultimo?.trim ?? pib.trim_recente}
    >
      <div className="mb-2 overflow-x-auto">
        <div className="w-max min-w-full">
          <AzSegmented
            ariaLabel="Lente (transformação)"
            options={(disponiveis.length ? disponiveis : [lenteAtiva]).map((l) => ({ id: l.id, label: l.label }))}
            value={lenteAtiva.id}
            // AzSegmented emite string; as opções vêm de LENTES_PIB, logo o id é sempre um LentePibId.
            onChange={(id) => setLente(id as LentePibId)}
          />
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip tom={tomChip} title={`${rotulo} · ${lenteAtiva.fonte}`}>
          {textoChip}
        </CockpitChip>
      </div>

      {data.length > 0 ? (
        <AzTimeSeriesChart
          series={[{ id: `${recorte}-${lenteAtiva.id}`, label: `${rotuloCurto} · ${lenteAtiva.label}`, color: AZ_BRAND.azure, data }]}
          unit={lenteAtiva.unit}
          yAxisLabel={lenteAtiva.yAxisLabel}
          period={period}
          height={ALTURA}
          variant="default"
          dots={2}
          xRefAreas={lenteAtiva.grupo === "nivel" ? faixasCodace : []}
          refLines={lenteAtiva.grupo === "variacao" ? ZERO_LINE : []}
        />
      ) : (
        <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-[#132960]/15" style={{ height: ALTURA }}>
          <p className="px-4 text-center text-xs text-zinc-500">
            — · sem série na CNT para {rotuloCurto} × {lenteAtiva.label} (ver ?)
          </p>
        </div>
      )}
    </ChartCard>
  );
}
