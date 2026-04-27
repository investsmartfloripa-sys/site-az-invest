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

export default function AposentadoriaPage() {
  const [age, setAge] = useState(30);
  const [retireAge, setRetireAge] = useState(60);
  const [monthlyIncome, setMonthlyIncome] = useState(8000);
  const [realRate, setRealRate] = useState(5);

  const result = useMemo(() => {
    const yearsToRetire = Math.max(0, retireAge - age);
    const months = yearsToRetire * 12;
    const target = (monthlyIncome * 12) / (realRate / 100);

    const r = realRate / 100 / 12;
    const fv = target;
    const pmt = months > 0 && r > 0 ? (fv * r) / (Math.pow(1 + r, months) - 1) : 0;

    return {
      target,
      pmt,
      yearsToRetire,
    };
  }, [age, retireAge, monthlyIncome, realRate]);

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
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Aposentadoria</h1>
          <p className="text-sm text-zinc-600">
            Estime o patrimonio necessario para viver de renda e quanto investir por mes para
            chegar la.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-[#132960]/15 bg-white p-6 md:grid-cols-2">
          <div className="space-y-4">
            <Field label="Idade atual">
              <input
                type="number"
                min={18}
                max={100}
                value={age}
                onChange={(event) => setAge(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Idade desejada para aposentar">
              <input
                type="number"
                min={age}
                max={100}
                value={retireAge}
                onChange={(event) => setRetireAge(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Renda mensal desejada (R$)">
              <input
                type="number"
                min={0}
                value={monthlyIncome}
                onChange={(event) => setMonthlyIncome(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
            <Field label="Taxa real anual estimada (%)">
              <input
                type="number"
                step={0.5}
                min={0.5}
                value={realRate}
                onChange={(event) => setRealRate(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              />
            </Field>
          </div>

          <div className="space-y-3">
            <ResultRow label="Patrimonio alvo" value={brl(result.target)} accent />
            <ResultRow label="Aporte mensal necessario" value={brl(result.pmt)} />
            <ResultRow label="Anos de acumulacao" value={`${result.yearsToRetire} anos`} />
            <p className="text-xs text-zinc-500">
              Considera taxa real (descontada inflacao) e regra dos 4% (renda perpetua).
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
