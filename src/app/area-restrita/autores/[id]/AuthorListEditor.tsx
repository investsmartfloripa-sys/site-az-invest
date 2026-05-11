"use client";

import { useState } from "react";
import {
  MAX_SPECIALTIES,
  type AuthorEducation,
  type AuthorExperience,
  type AuthorSpecialty,
} from "@/lib/authors";

type ExperienceProps = {
  initial: AuthorExperience[];
  hiddenName: string;
};

export function ExperienceEditor({ initial, hiddenName }: ExperienceProps) {
  const [items, setItems] = useState<AuthorExperience[]>(
    initial.length ? initial : [{ org: "", title: "", description: "" }],
  );

  function update(index: number, field: keyof AuthorExperience, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function add() {
    setItems((prev) => [...prev, { org: "", title: "", description: "" }]);
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={hiddenName}
        value={JSON.stringify(items.filter((i) => i.org || i.title || i.description))}
      />
      {items.map((item, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#132960]/70">
              Experiencia {index + 1}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-white"
                disabled={index === 0}
              >
                {"\u2191"}
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-white"
                disabled={index === items.length - 1}
              >
                {"\u2193"}
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
          </div>
          <input
            value={item.org}
            onChange={(e) => update(index, "org", e.target.value)}
            placeholder="Empresa / Organizacao (ex: InvestSmart Florianopolis)"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          />
          <input
            value={item.title}
            onChange={(e) => update(index, "title", e.target.value)}
            placeholder="Cargo (ex: Fundador e Gestor)"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          />
          <textarea
            value={item.description}
            onChange={(e) => update(index, "description", e.target.value)}
            placeholder="Descricao da atuacao"
            className="min-h-20 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="rounded-md border border-dashed border-[#132960]/40 px-3 py-2 text-sm font-semibold text-[#132960] hover:bg-[#132960]/5"
      >
        + Adicionar experiencia
      </button>
    </div>
  );
}

type EducationProps = {
  initial: AuthorEducation[];
  hiddenName: string;
};

export function EducationEditor({ initial, hiddenName }: EducationProps) {
  const [items, setItems] = useState<AuthorEducation[]>(
    initial.length
      ? initial.map((row) => ({
          ...row,
          period: row.period ?? "",
        }))
      : [{ title: "", institution: "", period: "", description: "" }],
  );

  function update(index: number, field: keyof AuthorEducation, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function add() {
    setItems((prev) => [
      ...prev,
      { title: "", institution: "", period: "", description: "" },
    ]);
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={hiddenName}
        value={JSON.stringify(
          items.filter(
            (i) => i.title || i.institution || i.period || i.description,
          ),
        )}
      />
      {items.map((item, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#132960]/70">
              Formacao {index + 1}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-white"
                disabled={index === 0}
              >
                {"\u2191"}
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-white"
                disabled={index === items.length - 1}
              >
                {"\u2193"}
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
          </div>
          <input
            value={item.title}
            onChange={(e) => update(index, "title", e.target.value)}
            placeholder="Curso / Certificacao (ex: Graduacao em Economia)"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          />
          <input
            value={item.institution}
            onChange={(e) => update(index, "institution", e.target.value)}
            placeholder="Instituicao (ex: UFSC)"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          />
          <div className="space-y-2 rounded-md border border-dashed border-[#027DFC]/35 bg-[#f8fbff] px-3 py-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#027DFC]">
              Data / periodo (opcional)
            </span>
            <label className="block text-[11px] text-zinc-500">
              Mes e ano de conclusao (se aplicavel)
              <input
                type="month"
                lang="pt-BR"
                value={/^\d{4}-\d{2}$/.test(item.period) ? item.period : ""}
                onChange={(e) => update(index, "period", e.target.value)}
                className="mt-1 block h-10 w-full max-w-[14rem] rounded-md border border-zinc-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="block text-[11px] text-zinc-500">
              Ou texto livre (intervalo, &quot;cursando&quot;, ano so)
              <input
                type="text"
                value={/^\d{4}-\d{2}$/.test(item.period) ? "" : item.period}
                onChange={(e) => update(index, "period", e.target.value)}
                placeholder="Ex: 2019-2022, 2024, em andamento"
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
              />
            </label>
          </div>
          <textarea
            value={item.description}
            onChange={(e) => update(index, "description", e.target.value)}
            placeholder="Detalhes adicionais (ex: Areas de estudo, foco, certificacoes)"
            className="min-h-20 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="rounded-md border border-dashed border-[#132960]/40 px-3 py-2 text-sm font-semibold text-[#132960] hover:bg-[#132960]/5"
      >
        + Adicionar formacao
      </button>
    </div>
  );
}

type SpecialtyProps = {
  initial: AuthorSpecialty[];
  hiddenName: string;
};

export function SpecialtyEditor({ initial, hiddenName }: SpecialtyProps) {
  const [items, setItems] = useState<AuthorSpecialty[]>(
    initial.length ? initial.slice(0, MAX_SPECIALTIES) : [{ title: "", description: "" }],
  );

  function update(index: number, field: keyof AuthorSpecialty, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function add() {
    setItems((prev) =>
      prev.length >= MAX_SPECIALTIES ? prev : [...prev, { title: "", description: "" }],
    );
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const reachedMax = items.length >= MAX_SPECIALTIES;

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={hiddenName}
        value={JSON.stringify(items.filter((i) => i.title || i.description))}
      />
      {items.map((item, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#132960]/70">
              Especialidade {index + 1}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-white"
                disabled={index === 0}
              >
                {"\u2191"}
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-white"
                disabled={index === items.length - 1}
              >
                {"\u2193"}
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
          </div>
          <input
            value={item.title}
            onChange={(e) => update(index, "title", e.target.value)}
            placeholder="Titulo curto (ex: Financas familiares)"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          />
          <textarea
            value={item.description}
            onChange={(e) => update(index, "description", e.target.value)}
            placeholder="Descricao curta (1-2 linhas)"
            className="min-h-20 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={reachedMax}
        className="rounded-md border border-dashed border-[#132960]/40 px-3 py-2 text-sm font-semibold text-[#132960] hover:bg-[#132960]/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Adicionar especialidade {reachedMax ? `(maximo ${MAX_SPECIALTIES})` : ""}
      </button>
    </div>
  );
}
