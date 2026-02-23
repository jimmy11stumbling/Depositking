const STORAGE_KEY = "tenantadvocate_case_tokens";

export function saveCaseToken(token: string): void {
  const tokens = getCaseTokens();
  if (!tokens.includes(token)) {
    tokens.push(token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  }
}

export function getCaseTokens(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t: any) => typeof t === "string" && t.length > 0);
  } catch {
    return [];
  }
}

export function removeCaseToken(token: string): void {
  const tokens = getCaseTokens().filter(t => t !== token);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}
