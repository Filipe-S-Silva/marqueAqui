import type { AdminAuditType } from '@marqueaqui/database';

/** Eventos de segurança (o que um analista procuraria primeiro). Têm prioridade sobre o prefixo da ação. */
const SECURITY = new Set([
  'admin.login_failed', 'admin.login_blocked', 'admin.login_2fa_failed', 'admin.login_2fa_recovery',
  'admin.change_password', 'admin.revoke_other_sessions', 'admin.revoke_sessions', 'admin.unlock',
  'admin.reset_password', 'admin.2fa_enabled', 'admin.2fa_disabled', 'admin.2fa_recovery_regenerated', 'admin.2fa_reset',
  'user.revoke_sessions', 'user.unlock', 'user.reset_password',
]);
const AUTH = new Set(['admin.login', 'admin.logout']);

/** Classifica a ação em um tipo de auditoria para o filtro da página. */
export function auditType(action: string): AdminAuditType {
  if (SECURITY.has(action)) return 'SECURITY';
  if (AUTH.has(action)) return 'AUTH';
  if (action.startsWith('ticket.') || action.startsWith('feedback.')) return 'SUPPORT';
  if (action.startsWith('announcement.')) return 'ANNOUNCEMENT';
  if (action.startsWith('user.')) return 'USER';
  if (action.startsWith('shop.')) return 'SHOP';
  return 'ADMIN';
}
