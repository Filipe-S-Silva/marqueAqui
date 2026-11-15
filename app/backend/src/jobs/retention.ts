// Retenção: apaga agendamentos CONCLUÍDOS, CANCELADOS ou com FALTA há mais de RETENTION_MONTHS meses (padrão 3).
// Confirmados nunca são apagados. As avaliações permanecem (guardam serviço e data). Idempotente, com advisory lock.
import { and, inArray, lt, sql } from 'drizzle-orm';
import { LOCK_NS, appointments, nowInBusinessTz } from '@marqueaqui/database';
import { writeAudit } from '../repositories/audit.repository.ts';
import type { AppContext } from '../types/app-context.ts';
import { retentionCutoff } from '../utils/retention.ts';

export async function purgeOldAppointments(ctx: AppContext, now = new Date()): Promise<number> {
  const cutoff = retentionCutoff(nowInBusinessTz(now).date, ctx.env.RETENTION_MONTHS);
  return ctx.db.transaction(async (tx) => {
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${LOCK_NS.retentionPurge}::int, 0) AS got`);
    if (!(lock as unknown as Array<{ got: boolean }>)[0]?.got) return 0;
    const gone = await tx
      .delete(appointments)
      .where(and(inArray(appointments.status, ['COMPLETED', 'CANCELLED', 'NO_SHOW']), lt(appointments.date, cutoff)))
      .returning({ id: appointments.id });
    if (gone.length) {
      await writeAudit(tx, { actorType: 'SYSTEM', action: 'appointments.retention_purge', entityType: 'appointment', metadata: { deleted: gone.length, before: cutoff } });
    }
    return gone.length;
  });
}

export function startRetentionJob(ctx: AppContext): () => void {
  const run = () =>
    purgeOldAppointments(ctx)
      .then((n) => n && ctx.log.info({ deleted: n }, 'Agendamentos antigos apagados'))
      .catch((e) => ctx.log.error({ err: e }, 'Falha na limpeza de agendamentos antigos'));
  void run();
  const timer = setInterval(run, 24 * 60 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
