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
        <div key={index} className="space-y-2 rounded-lg border border-[#132960]/12 bg-[#F3F5FB] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#132960]/55">
              Experiência {index + 1}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded border border-[#132960]/25 px-2 py-0.5 text-xs text-[#132960]/65 disabled:opacity-40">
                ↑
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} className="rounded border border-[#132960]/25 px-2 py-0.5 text-xs text-[#132960]/65 disabled:opacity-40">
                ↓
              </button>
              <button type="button" onClick={() => remove(index)} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">
                Remover
              </button>
            </div>
          </div>
          <input value={item.org} onChange={(e) => update(index, "org", e.target.value)} placeholder="Empresa" className="h-10 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
          <input value={item.title} onChange={(e) => update(index, "title", e.target.value)} placeholder="Cargo" className="h-10 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
          <textarea value={item.description} onChange={(e) => update(index, "description", e.target.value)} placeholder="Descrição" className="min-h-20 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-md border border-dashed border-[#132960]/30 px-3 py-2 text-sm text-[#132960]/70 hover:bg-[#132960]/5">
        + Adicionar experiência
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
      ? initial.map((row) => ({ ...row, period: row.period ?? "" }))
      : [{ title: "", institution: "", period: "", description: "" }],
  );

  function update(index: number, field: keyof AuthorEducation, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function add() {
    setItems((prev) => [...prev, { title: "", institution: "", period: "", description: "" }]);
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={hiddenName}
        value={JSON.stringify(items.filter((i) => i.title || i.institution || i.period || i.description))}
      />
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-[#132960]/12 bg-[#F3F5FB] p-3">
          <input value={item.title} onChange={(e) => update(index, "title", e.target.value)} placeholder="Curso" className="h-10 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
          <input value={item.institution} onChange={(e) => update(index, "institution", e.target.value)} placeholder="Instituição" className="h-10 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
          <input value={item.period} onChange={(e) => update(index, "period", e.target.value)} placeholder="Período" className="h-10 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
          <textarea value={item.description} onChange={(e) => update(index, "description", e.target.value)} placeholder="Detalhes" className="min-h-20 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
          <button type="button" onClick={() => remove(index)} className="text-xs text-red-600 hover:underline">
            Remover
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-md border border-dashed border-[#132960]/30 px-3 py-2 text-sm text-[#132960]/70 hover:bg-[#132960]/5">
        + Adicionar formação
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

  const reachedMax = items.length >= MAX_SPECIALTIES;

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={hiddenName}
        value={JSON.stringify(items.filter((i) => i.title || i.description))}
      />
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-[#132960]/12 bg-[#F3F5FB] p-3">
          <input value={item.title} onChange={(e) => update(index, "title", e.target.value)} placeholder="Título" className="h-10 w-full rounded-md border border-[#132960]/20 bg-white px-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
          <textarea value={item.description} onChange={(e) => update(index, "description", e.target.value)} placeholder="Descrição" className="min-h-20 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]" />
          <button type="button" onClick={() => remove(index)} className="text-xs text-red-600 hover:underline">
            Remover
          </button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={reachedMax} className="rounded-md border border-dashed border-[#132960]/30 px-3 py-2 text-sm text-[#132960]/70 hover:bg-[#132960]/5 disabled:opacity-50">
        + Adicionar especialidade
      </button>
    </div>
  );
}
