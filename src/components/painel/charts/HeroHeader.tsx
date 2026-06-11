import { variationFill, variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";

import { RangeBar } from "./RangeBar";

/**
 * Cabeçalho padrão do HERO de ativo/índice (§9 do PADRAO-VISUAL-GRAFICOS.md):
 * UM cluster coeso — eyebrow com o nome, valor grande tabular navy com a
 * unidade pequena ao lado, chip de variação do dia COLADO ao valor (fundo
 * tonal ~12% da cor de variação, texto na cor de texto da família) e, à
 * direita (empilha no mobile), a range bar 12m. O formato antigo "lista
 * rótulo/valor" (Máx 12m / Mín 12m / Atualizado) está PROIBIDO — frescor é
 * papel do DataStamp no rodapé do card.
 *
 * Sem hooks — funciona em server e client components.
 */

export type HeroHeaderProps = {
  /** Nome do ativo/índice (ex.: "Ibovespa") — 11px uppercase slate. */
  eyebrow: string;
  /** Valor grande JÁ formatado (ex.: fmtNum(hero.last_value, 0)). */
  value: string;
  /** Unidade pequena ao lado do valor (ex.: "pts", "R$"). */
  unit?: string;
  /** true ⇒ unidade ANTES do valor (moedas: "R$ 158,43"). Default depois. */
  unitBefore?: boolean;
  /** Variação % do dia — vira o chip tonal "+0,68% hoje". null/undefined oculta. */
  changePct?: number | null;
  /** Range 12m (mín/máx/atual + formatador). null/undefined oculta a barra. */
  range?: {
    min: number;
    max: number;
    current: number;
    format: (v: number) => string;
    /** Default "range 12m". */
    label?: string;
  } | null;
  className?: string;
};

export function HeroHeader({
  eyebrow,
  value,
  unit,
  unitBefore = false,
  changePct,
  range,
  className = "",
}: HeroHeaderProps) {
  const unitEl = unit ? <span className="text-sm font-normal text-zinc-500">{unit}</span> : null;

  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
          {eyebrow}
        </p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-3xl font-semibold tabular-nums text-[#132960] md:text-[34px] md:leading-tight">
            {unitBefore && unitEl ? <>{unitEl} </> : null}
            {value}
            {!unitBefore && unitEl ? <> {unitEl}</> : null}
          </p>
          {changePct != null && Number.isFinite(changePct) ? (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
              // Fundo tonal ~12% (sufixo hex 1F) da cor de variação; texto na
              // cor de TEXTO da família (contraste AA) — tokens do tema AZ.
              style={{
                backgroundColor: `${variationFill(changePct)}1F`,
                color: variationText(changePct),
              }}
            >
              {fmtSignedPct(changePct, 2)} hoje
            </span>
          ) : null}
        </div>
      </div>
      {range ? (
        <RangeBar
          min={range.min}
          max={range.max}
          value={range.current}
          format={range.format}
          label={range.label}
          className="w-full sm:w-60"
        />
      ) : null}
    </div>
  );
}
