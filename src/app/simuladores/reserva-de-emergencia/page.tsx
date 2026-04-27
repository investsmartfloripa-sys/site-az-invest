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

export default function ReservaEmergenciaPage() {
  const [expense, setExpense] = useState(5000);
  const [months, setMonths] = useState(6);
  const [saved, setSaved] = useState(2000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);

  const result = useMemo(() => {
    const target = expense * months;
    const remaining = Math.max(0, target - saved);
    const monthsToGoal = monthlyContribution > 0 ? Math.ceil(remaining / monthlyContribution) : 0;
    const progress = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
    return { target, remaining, monthsToGoal, progress };
  }, [expense, months, saved, monthlyContribution]);

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
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Reserva de emergencia</h1>
          <p className="text-sm text-zinc-600">
            Saiba quanto precisa guardar para cobrir despesas em um momento de imprevisto.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-[#132960]/15 bg-white p-6 md:grid-cols-2">
          <div className="space-y-4">
            <Field label="Despesa mensal (R$)">
              <input
                type="number"
                min={0}
                value={expense}
                onChange={(event) => setExpense(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Quantos meses de protecao">
              <input
                type="number"
                min={1}
                max={24}
                value={months}
                onChange={(event) => setMonths(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Ja tenho guardado (R$)">
              <input
                type="number"
                min={0}
                value={saved}
                onChange={(event) => setSaved(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Aporte mensal (R$)">
              <input
                type="number"
                min={0}
                value={monthlyContribution}
                onChange={(event) => setMonthlyContribution(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
          </div>

          <div className="space-y-3">
            <ResultRow label="Reserva ideal" value={brl(result.target)} accent />
            <ResultRow label="Falta acumular" value={brl(result.remaining)} />
            <ResultRow
              label="Meses ate a meta"
              value={
                result.monthsToGoal === 0 && result.remaining > 0
                  ? "Aumente o aporte"
                  : `${result.monthsToGoal} meses`
              }
            />
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Progresso
              </p>
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full bg-[#027DFC] transition-all"
                  style={{ width: `${result.progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">{result.progress.toFixed(1)}% concluido</p>
            </div>
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
        accent ? "border-[#027DFC] bg-[#027DFC]/5" : "border-[#132960]/15 bg-white"
      }`}
    >
      <span className="text-sm text-zinc-600">{label}</span>
      <span className={`text-xl font-semibold ${accent ? "text-[#027DFC]" : "text-[#132960]"}`}>
        {value}
      </span>
    </div>
  );
}
