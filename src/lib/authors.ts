export type AuthorExperience = {
  org: string;
  title: string;
  description: string;
};

export type AuthorEducation = {
  title: string;
  institution: string;
};

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
      }))
      .filter((item) => item.title || item.institution);
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
    }))
    .filter((item) => item.title || item.institution);
  return cleaned.length ? JSON.stringify(cleaned) : null;
}
