import { and, count, desc, eq, gte, ilike, lte, sql, type SQL } from 'drizzle-orm';
import { adminAudit, admins, type AdminAuditType, type DbOrTx } from '@marqueaqui/database';

export interface AuditFilters {
  type?: AdminAuditType | undefined; adminId?: number | undefined; action?: string | undefined;
  from?: string | undefined; to?: string | undefined;
}

const esc = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function list(db: DbOrTx, f: AuditFilters, page: number, pageSize: number) {
  const c: SQL[] = [];
  if (f.type) c.push(eq(adminAudit.type, f.type));
  if (f.adminId) c.push(eq(adminAudit.adminId, f.adminId));
  if (f.action) c.push(ilike(adminAudit.action, `${esc(f.action)}%`));
  if (f.from) c.push(gte(adminAudit.createdAt, sql`${f.from}::date`));
  if (f.to) c.push(lte(adminAudit.createdAt, sql`(${f.to}::date + interval '1 day' - interval '1 second')`));
  const where = c.length ? and(...c) : undefined;
  const rows = await db
    .select({
      id: adminAudit.id, type: adminAudit.type, action: adminAudit.action, adminId: adminAudit.adminId, adminName: admins.name,
      targetType: adminAudit.targetType, targetId: adminAudit.targetId, metadata: adminAudit.metadata, ip: adminAudit.ip, createdAt: adminAudit.createdAt,
    })
    .from(adminAudit).leftJoin(admins, eq(admins.id, adminAudit.adminId))
    .where(where).orderBy(desc(adminAudit.createdAt), desc(adminAudit.id)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ n: count() }).from(adminAudit).where(where);
  return { items: rows, total: t?.n ?? 0 };
}
