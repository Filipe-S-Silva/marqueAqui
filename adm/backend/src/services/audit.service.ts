import * as repo from '../repositories/audit-list.repository.ts';
import type { AppContext } from '../types/context.ts';

export async function list(ctx: AppContext, f: repo.AuditFilters, page: number, pageSize: number) {
  const { items, total } = await repo.list(ctx.db, f, page, pageSize);
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
