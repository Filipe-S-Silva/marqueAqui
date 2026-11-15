const SENSITIVE_KEYS = /pass|senha|token|secret|hash|authorization|cookie|message|mensagem|body|code|codigo/i;

/**
 * Remove qualquer chave que pareça segredo ou TEXTO de mensagem antes de gravar. A guarda é por nome de chave:
 * quem chama deve passar só contagens, ids e nomes de campos, nunca conteúdo livre.
 */
export function scrub(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.test(k)) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? scrub(v as Record<string, unknown>) : v;
  }
  return out;
}

