import { and, asc, count, desc, eq, gte, ilike, lte, sql, type SQL } from 'drizzle-orm';
import { barbers, shopManagers, shops, users, type DbOrTx, type UserRole } from '@marqueaqui/database';

export interface UserFilters {
  name?: string | undefined; email?: string | undefined; role?: UserRole | undefined;
  status?: 'active' | 'inactive' | undefined; shopId?: number | undefined; from?: string | undefined; to?: string | undefined;
}

const esc = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

function where(f: UserFilters): SQL | undefined {
  const c: SQL[] = [];
  if (f.name) c.push(ilike(users.name, `%${esc(f.name)}%`));
  if (f.email) c.push(ilike(users.email, `%${esc(f.email.toLowerCase())}%`));
  if (f.role) c.push(eq(users.role, f.role));
  if (f.status) c.push(eq(users.active, f.status === 'active'));
  if (f.from) c.push(gte(users.createdAt, sql`${f.from}::date`));
  if (f.to) c.push(lte(users.createdAt, sql`(${f.to}::date + interval '1 day' - interval '1 second')`));
  if (f.shopId) {
    c.push(sql`(EXISTS (SELECT 1 FROM ${shopManagers} sm WHERE sm.user_id = ${users.id} AND sm.shop_id = ${f.shopId} AND sm.active = true)
      OR EXISTS (SELECT 1 FROM ${barbers} b WHERE b.user_id = ${users.id} AND b.shop_id = ${f.shopId} AND b.active = true))`);
  }
  return c.length ? and(...c) : undefined;
}

const cols = {
  id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, active: users.active,
  createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, mustChangePassword: users.mustChangePassword,
};

/** Empresas ativas de cada usuário (gestor e/ou profissional), em uma única consulta. */
async function attachShops(db: DbOrTx, rows: Array<{ id: number }>) {
  if (!rows.length) return new Map<number, Array<{ id: number; name: string; as: 'MANAGER' | 'PROFESSIONAL' }>>();
  const ids = sql.join(rows.map((r) => sql`${r.id}`), sql`, `);
  const res = await db.execute(sql`
    SELECT sm.user_id AS "userId", s.id AS "shopId", s.name AS name, 'MANAGER' AS "as"
      FROM shop_managers sm JOIN shops s ON s.id = sm.shop_id WHERE sm.active = true AND sm.user_id IN (${ids})
    UNION ALL
    SELECT b.user_id, s.id, s.name, 'PROFESSIONAL'
      FROM barbers b JOIN shops s ON s.id = b.shop_id WHERE b.active = true AND b.user_id IN (${ids})
    ORDER BY name`);
  const map = new Map<number, Array<{ id: number; name: string; as: 'MANAGER' | 'PROFESSIONAL' }>>();
  for (const r of res as unknown as Array<{ userId: number; shopId: number; name: string; as: 'MANAGER' | 'PROFESSIONAL' }>) {
    map.set(r.userId, [...(map.get(r.userId) ?? []), { id: r.shopId, name: r.name, as: r.as }]);
  }
  return map;
}

export async function list(db: DbOrTx, f: UserFilters, page: number, pageSize: number) {
  const w = where(f);
  const rows = await db.select(cols).from(users).where(w).orderBy(desc(users.createdAt), asc(users.id)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ n: count() }).from(users).where(w);
  const shopMap = await attachShops(db, rows);
  return { items: rows.map((r) => ({ ...r, shops: shopMap.get(r.id) ?? [] })), total: t?.n ?? 0 };
}

export async function exportRows(db: DbOrTx, f: UserFilters, limit: number) {
  const rows = await db.select(cols).from(users).where(where(f)).orderBy(desc(users.createdAt), asc(users.id)).limit(limit);
  const shopMap = await attachShops(db, rows);
  return rows.map((r) => ({ ...r, shops: shopMap.get(r.id) ?? [] }));
}

export async function findById(db: DbOrTx, id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}
export async function findByEmail(db: DbOrTx, email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}
export async function userShops(db: DbOrTx, userId: number) {
  const m = await attachShops(db, [{ id: userId }]);
  return m.get(userId) ?? [];
}
export async function shopExists(db: DbOrTx, id: number): Promise<boolean> {
  const [r] = await db.select({ id: shops.id }).from(shops).where(eq(shops.id, id)).limit(1);
  return r !== undefined;
}
