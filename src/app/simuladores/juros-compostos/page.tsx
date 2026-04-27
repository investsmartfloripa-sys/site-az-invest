"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function brl(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default function JurosCompostosPage() {
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(1000);
  const [rate, setRate] = useState(0.85);
  const [months, setMonths] = useState(120);

  const result = useMemo(() => {
    const r = rate / 100;
    let total = initial;
    for (let i = 0; i < months; i += 1) {
      total = total * (1 + r) + monthly;
    }
    const invested = initial + monthly * months;
    return {
      total,
      invested,
      profit: total - invested,
    };
  }, [initial, monthly, rate, months]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 md:px-8">
        <Link
          href="/simuladores"
          className="text-xs font-semibold text-[#132960] hover:underline"
        >
          {"<-"} Voltar para Simuladores
        </Link>

        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">
            Simulador
          </p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Juros compostos</h1>
          <p className="text-sm text-zinc-600">
            Veja o efeito do tempo + aportes mensais sobre o seu patrimonio.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-[#132960]/15 bg-white p-6 md:grid-cols-2">
          <div className="space-y-4">
            <Field label="Valor inicial (R$)">
              <input
                type="number"
                min={0}
                value={initial}
                onChange={(event) => setInitial(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Aporte mensal (R$)">
              <input
                type="number"
                min={0}
                value={monthly}
                onChange={(event) => setMonthly(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Taxa mensal (%)">
              <input
                type="number"
                step={0.05}
                min={0}
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Periodo (meses)">
              <input
                type="number"
                min={1}
                value={months}
                onChange={(event) => setMonths(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
          </div>

          <div className="space-y-3">
            <ResultRow label="Total acumulado" value={brl(result.total)} accent />
            <ResultRow label="Total investido" value={brl(result.invested)} />
            <ResultRow label="Juros ganhos" value={brl(result.profit)} />
            <p className="text-xs text-zinc-500">
              Calculo simplificado, sem considerar inflacao, taxas e impostos. Use como
              referencia inicial.
            </p>
          </div>
        </section>
      </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ResultRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-4 ${
        accent
          ? "border-[#027DFC] bg-[#027DFC]/5"
          : "border-[#132960]/15 bg-white"
      }`}
    >
      <span className="text-sm text-zinc-600">{label}</span>
      <span
        className={`text-xl font-semibold ${
          accent ? "text-[#027DFC]" : "text-[#132960]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
