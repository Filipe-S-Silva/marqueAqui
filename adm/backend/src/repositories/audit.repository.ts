import { adminAudit, type AdminAuditType, type DbOrTx } from '@marqueaqui/database';
import { auditType } from '../utils/audit-type.ts';
import { scrub } from '../utils/scrub.ts';

export { scrub };

export interface AuditEntry {
  /** Quem agiu: ADMIN grava o id; SYSTEM (ex.: login falho) grava sem administrador. */
  actorType: 'ADMIN' | 'USER' | 'SYSTEM';
  actorId?: number | null;
  action: string;
  type?: AdminAuditType;
  entityType?: string;
  entityId?: string | number;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function writeAudit(db: DbOrTx, entry: AuditEntry): Promise<void> {
  await db.insert(adminAudit).values({
    adminId: entry.actorType === 'ADMIN' ? (entry.actorId ?? null) : null,
    type: entry.type ?? auditType(entry.action),
    action: entry.action,
    targetType: entry.entityType ?? null,
    targetId: entry.entityId === undefined ? null : String(entry.entityId),
    metadata: scrub(entry.metadata) ?? null,
    ip: entry.ip ?? null,
  });
}
