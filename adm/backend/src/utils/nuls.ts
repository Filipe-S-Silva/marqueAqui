/** Há algum caractere NUL (\u0000) em qualquer string do valor (inclui chaves e estruturas aninhadas)? Limite de profundidade evita laços. */
export function containsNul(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === 'string') return value.includes('\u0000');
  if (Array.isArray(value)) return value.some((v) => containsNul(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([k, v]) => k.includes('\u0000') || containsNul(v, depth + 1));
  }
  return false;
}
