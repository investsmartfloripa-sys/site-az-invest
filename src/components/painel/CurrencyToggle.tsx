"use client";

type Props = {
  value: "brl" | "usd";
  onChange: (c: "brl" | "usd") => void;
  className?: string;
};

export function CurrencyToggle({ value, onChange, className = "" }: Props) {
  return (
    <div className={`inline-flex rounded-lg border border-[#132960]/20 p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => onChange("brl")}
        className={`rounded-md px-3 py-1 text-xs font-semibold ${
          value === "brl" ? "bg-[#132960] text-white" : "text-[#132960]"
        }`}
      >
        BRL
      </button>
      <button
        type="button"
        onClick={() => onChange("usd")}
        className={`rounded-md px-3 py-1 text-xs font-semibold ${
          value === "usd" ? "bg-[#132960] text-white" : "text-[#132960]"
        }`}
      >
        USD
      </button>
    </div>
  );
}
