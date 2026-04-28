"use client";

const LABELS: Record<string, string> = {
  "1d": "1D",
  "1wk": "1S",
  "1mo": "1M",
  "3mo": "3M",
  "1y": "1A",
};

type Props = {
  value: string;
  onChange: (p: string) => void;
  periods?: string[];
  className?: string;
};

export function PeriodSelector({
  value,
  onChange,
  periods = ["1d", "1wk", "1mo", "3mo", "1y"],
  className = "",
}: Props) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
            value === p
              ? "bg-[#027DFC] text-white"
              : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
          }`}
        >
          {LABELS[p] ?? p}
        </button>
      ))}
    </div>
  );
}
