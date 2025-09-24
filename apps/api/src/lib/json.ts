export function parseJson<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return null;
}

export function parseJsonOr<T>(value: unknown, fallback: T): T {
  const parsed = parseJson<T>(value);
  return parsed ?? fallback;
}

export function stringifyJson(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 'null';
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(trimmed);
    }
  }
  return JSON.stringify(value ?? null);
}

