export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().split('-')[0]}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
