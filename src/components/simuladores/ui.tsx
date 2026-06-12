"use client";

import { useEffect, useState } from "react";

import { SIM } from "@/lib/simulador-theme";

/**
 * Componentes de input compartilhados dos simuladores — antes duplicados em
 * cada page. API idêntica à dos componentes locais para a migração ser só a
 * troca do import. Foco usa o azure da marca (SIM.blue).
 */

type NumFieldProps = {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  width?: string;
  size?: string;
};

/** Input numérico inteiro com máscara pt-BR (milhar com ponto). */
export function NumField({
  value,
  onChange,
  min,
  max,
  prefix,
  suffix,
  width = "w-full",
  size = "text-base",
}: NumFieldProps) {
  return (
    <div className="flex items-center gap-1">
      {prefix && (
        <span className="text-sm shrink-0" style={{ color: SIM.textDim }}>
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={value.toLocaleString("pt-BR")}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/\D/g, "");
          const num = cleaned === "" ? 0 : parseInt(cleaned, 10);
          onChange(Math.min(Math.max(num, min), max));
        }}
        onFocus={(e) => e.target.select()}
        className={`${size} font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right ${width}`}
        style={{ color: SIM.dark, borderColor: "transparent" }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = SIM.blue;
          e.currentTarget.style.backgroundColor = SIM.fieldBg;
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      />
      {suffix && (
        <span className="text-sm shrink-0" style={{ color: SIM.textDim }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Input numérico com decimais — pt-BR usa vírgula; commit no blur. */
export function NumFieldDecimal({
  value,
  onChange,
  min,
  max,
  prefix,
  suffix,
  width = "w-full",
  size = "text-base",
}: NumFieldProps) {
  const [localStr, setLocalStr] = useState(String(value).replace(".", ","));
  useEffect(() => {
    setLocalStr(String(value).replace(".", ","));
  }, [value]);
  return (
    <div className="flex items-center gap-1">
      {prefix && (
        <span className="text-sm shrink-0" style={{ color: SIM.textDim }}>
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={localStr}
        onChange={(e) => setLocalStr(e.target.value.replace(/[^0-9,.]/g, ""))}
        onBlur={() => {
          const num = parseFloat(localStr.replace(",", "."));
          if (!isNaN(num)) {
            const clamped = Math.min(Math.max(num, min), max);
            onChange(clamped);
            setLocalStr(String(clamped).replace(".", ","));
          } else {
            setLocalStr(String(value).replace(".", ","));
          }
        }}
        onFocus={(e) => e.target.select()}
        className={`${size} font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right ${width}`}
        style={{ color: SIM.dark, borderColor: "transparent" }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = SIM.blue;
          e.currentTarget.style.backgroundColor = SIM.fieldBg;
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      />
      {suffix && (
        <span className="text-sm shrink-0" style={{ color: SIM.textDim }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Formata moeda BRL sem centavos. */
export function fmtBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

/** Formato compacto p/ eixos de gráfico: 1,2M · 350k. */
export function fmtCompacto(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return n.toFixed(0);
}
