"use client";

import type { ReactNode } from "react";

import { AZ_BRAND, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";

/**
 * Tooltip navy padrão AZ (PADRAO-VISUAL-GRAFICOS.md §5).
 *
 * Duas formas de uso:
 * 1. Estilos no Tooltip default do Recharts (sem conteúdo custom):
 *    `<Tooltip {...azTooltipProps()} formatter={...} />`
 * 2. Conteúdo custom (controle total de label/valor):
 *    `<Tooltip content={<AzTooltip valueFmt={fmtSignedPct} />} cursor={azTooltipProps().cursor} />`
 */

/** Entrada de payload injetada pelo Recharts no componente `content`. */
export type AzTooltipPayloadEntry = {
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  stroke?: string;
  fill?: string;
  hide?: boolean;
};

export type AzTooltipProps = {
  /** Injetado pelo Recharts. */
  active?: boolean;
  /** Injetado pelo Recharts. */
  payload?: ReadonlyArray<AzTooltipPayloadEntry>;
  /** Injetado pelo Recharts. */
  label?: string | number;
  /** Formata o label (ex.: data) — default: texto cru. */
  labelFmt?: (label: string | number) => ReactNode;
  /** Formata cada valor numérico — default: `fmtNum(v, 2)`. */
  valueFmt?: (value: number, name: string) => string;
  /** Oculta a bolinha de cor por item (útil em série única). */
  hideDot?: boolean;
};

/**
 * Props p/ spread no `<Tooltip />` default do Recharts quando NÃO houver
 * conteúdo custom: fundo navy, radius 8, texto branco 12px, label slate,
 * cursor navy a 5%.
 */
export function azTooltipProps(): typeof AZ_TOOLTIP_PROPS {
  return AZ_TOOLTIP_PROPS;
}

function toNumber(v: AzTooltipPayloadEntry["value"]): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Componente `content` do Recharts no padrão navy AZ. Renderiza label
 * (#94A3B8 600), itens 12px brancos com dot na cor da série e sombra navy.
 */
export function AzTooltip({ active, payload, label, labelFmt, valueFmt, hideDot = false }: AzTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const visible = payload.filter((p) => !p.hide && p.value != null);
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        background: AZ_BRAND.navy,
        border: "none",
        borderRadius: 8,
        color: "#fff",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(19,41,96,.25)",
        padding: "8px 12px",
        maxWidth: 280,
      }}
    >
      {label != null && label !== "" ? (
        <p style={{ color: "#94A3B8", fontWeight: 600, margin: 0, marginBottom: 4 }}>
          {labelFmt ? labelFmt(label) : String(label)}
        </p>
      ) : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {visible.map((p, i) => {
          const name = String(p.name ?? "");
          const num = toNumber(p.value);
          const text = num == null ? "—" : valueFmt ? valueFmt(num, name) : fmtNum(num, 2);
          const dotColor = p.color ?? p.stroke ?? p.fill ?? "#fff";
          return (
            <li
              key={`${name}-${i}`}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0", whiteSpace: "nowrap" }}
            >
              {!hideDot ? (
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
              ) : null}
              {name ? <span style={{ color: "#C7D2E8" }}>{name}</span> : null}
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
