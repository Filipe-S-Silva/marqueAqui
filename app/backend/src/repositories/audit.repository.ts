import { auditLogs, type DbOrTx } from '@marqueaqui/database';

const SENSITIVE_KEYS = /pass|senha|token|secret|hash|authorization|cookie/i;

/** Remove qualquer chave que pareça segredo antes de gravar (spec 10.6). */
export function scrub(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.test(k)) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? scrub(v as Record<string, unknown>) : v;
  }
  return out;
}

export interface AuditEntry {
  actorType: 'USER' | 'SYSTEM';
  actorId?: number | null;
  action: string;
  entityType?: string;
  entityId?: string | number;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function writeAudit(db: DbOrTx, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId === undefined ? null : String(entry.entityId),
    metadata: scrub(entry.metadata) ?? null,
    ip: entry.ip ?? null,
  });
}
