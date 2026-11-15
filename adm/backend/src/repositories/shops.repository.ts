import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { barbers, shopManagers, shops, users, type DbOrTx } from '@marqueaqui/database';

export interface ShopFilters { q?: string | undefined; status?: 'active' | 'inactive' | undefined; }

function where(f: ShopFilters): SQL | undefined {
  const c: SQL[] = [];
  if (f.q) {
    const byName = ilike(shops.name, `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    // "#12" ou "12" também encontra a empresa pelo ID
    const id = /^#?\d{1,9}$/.test(f.q) ? Number(f.q.replace('#', '')) : null;
    c.push(id !== null ? or(byName, eq(shops.id, id))! : byName);
  }
  if (f.status) c.push(eq(shops.active, f.status === 'active'));
  return c.length ? and(...c) : undefined;
}

export async function list(db: DbOrTx, f: ShopFilters, page: number, pageSize: number) {
  const w = where(f);
  const items = await db
    .select({
      id: shops.id, name: shops.name, logoUrl: shops.logoUrl, active: shops.active,
      createdAt: shops.createdAt,
      professionals: sql<number>`(SELECT count(*)::int FROM ${barbers} b WHERE b.shop_id = ${shops.id} AND b.active = true)`,
      managers: sql<number>`(SELECT count(*)::int FROM ${shopManagers} m WHERE m.shop_id = ${shops.id} AND m.active = true)`,
    })
    .from(shops).where(w).orderBy(desc(shops.active), asc(shops.name)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ n: count() }).from(shops).where(w);
  return { items, total: t?.n ?? 0 };
}

export async function find(db: DbOrTx, id: number) {
  const [row] = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  return row;
}

/** Bloqueia a linha até o fim da transação (serializa ativação/desativação e reservas). */
export async function findForUpdate(db: DbOrTx, id: number) {
  const [row] = await db.select().from(shops).where(eq(shops.id, id)).for('update').limit(1);
  return row;
}

export async function managersOf(db: DbOrTx, shopId: number) {
  return db
    .select({ userId: users.id, name: users.name, email: users.email, phone: users.phone, userActive: users.active, linkActive: shopManagers.active })
    .from(shopManagers).innerJoin(users, eq(users.id, shopManagers.userId))
    .where(eq(shopManagers.shopId, shopId)).orderBy(asc(users.name));
}

export async function countActiveManagers(db: DbOrTx, shopId: number, exceptUserId?: number): Promise<number> {
  const rows = await db
    .select({ n: count() }).from(shopManagers).innerJoin(users, eq(users.id, shopManagers.userId))
    .where(and(eq(shopManagers.shopId, shopId), eq(shopManagers.active, true), eq(users.active, true),
      ...(exceptUserId ? [sql`${shopManagers.userId} <> ${exceptUserId}`] : [])));
  return rows[0]?.n ?? 0;
}
