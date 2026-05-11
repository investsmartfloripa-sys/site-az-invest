export type AuthorExperience = {
  org: string;
  title: string;
  description: string;
};

export type AuthorEducation = {
  title: string;
  institution: string;
  /** Ano/mes (YYYY-MM), ano, intervalo livre etc. */
  period: string;
  description: string;
};

export type AuthorSpecialty = {
  title: string;
  description: string;
};

export const MAX_SPECIALTIES = 3;

export function parseExperiences(json: string | null | undefined): AuthorExperience[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => ({
        org: String(item?.org ?? "").trim(),
        title: String(item?.title ?? "").trim(),
        description: String(item?.description ?? "").trim(),
      }))
      .filter((item) => item.org || item.title || item.description);
  } catch {
    return [];
  }
}

export function parseEducation(json: string | null | undefined): AuthorEducation[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => ({
        title: String(item?.title ?? "").trim(),
        institution: String(item?.institution ?? "").trim(),
        period: String(item?.period ?? "").trim(),
        description: String(item?.description ?? "").trim(),
      }))
      .filter((item) => item.title || item.institution || item.period || item.description);
  } catch {
    return [];
  }
}

export function serializeExperiences(items: AuthorExperience[]): string | null {
  const cleaned = items
    .map((item) => ({
      org: item.org.trim(),
      title: item.title.trim(),
      description: item.description.trim(),
    }))
    .filter((item) => item.org || item.title || item.description);
  return cleaned.length ? JSON.stringify(cleaned) : null;
}

export function serializeEducation(items: AuthorEducation[]): string | null {
  const cleaned = items
    .map((item) => ({
      title: item.title.trim(),
      institution: item.institution.trim(),
      period: item.period.trim(),
      description: item.description.trim(),
    }))
    .filter((item) => item.title || item.institution || item.period || item.description);
  return cleaned.length ? JSON.stringify(cleaned) : null;
}

/** Exibe rotulo legivel para periodo (YYYY-MM -> mes/ano em pt-BR; restante como gravado). */
export function formatEducationPeriodLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const ym = /^(\d{4})-(\d{2})$/.exec(t);
  if (ym) {
    const y = Number(ym[1]);
    const mo = Number(ym[2]) - 1;
    if (!Number.isNaN(y) && mo >= 0 && mo <= 11) {
      return new Date(y, mo, 1).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      });
    }
  }
  return t;
}

export function parseSpecialties(json: string | null | undefined): AuthorSpecialty[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) return [];
    return data
      .slice(0, MAX_SPECIALTIES)
      .map((item) => ({
        title: String(item?.title ?? "").trim(),
        description: String(item?.description ?? "").trim(),
      }))
      .filter((item) => item.title || item.description);
  } catch {
    return [];
  }
}

export function serializeSpecialties(items: AuthorSpecialty[]): string | null {
  const cleaned = items
    .slice(0, MAX_SPECIALTIES)
    .map((item) => ({
      title: item.title.trim(),
      description: item.description.trim(),
    }))
    .filter((item) => item.title || item.description);
  return cleaned.length ? JSON.stringify(cleaned) : null;
}
