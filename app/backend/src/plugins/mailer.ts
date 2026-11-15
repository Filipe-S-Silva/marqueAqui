// Envio de e-mail de redefinição. Não há SMTP configurado nesta entrega.
// Em desenvolvimento o link vai para o log do servidor; em produção o token NUNCA é registrado.
import type { Env } from '../config/env.ts';
import type { AppContext, Mailer } from '../types/app-context.ts';

export function createMailer(env: Env, log: AppContext['log']): Mailer {
  return {
    async sendPasswordReset({ to, token }) {
      if (env.isProduction) {
        log.warn({ to }, 'Mailer não configurado: e-mail de redefinição NÃO foi enviado. Integre um provedor SMTP.');
        return;
      }
      const origin = env.CORS_ORIGINS[0] ?? '';
      log.info({ to, link: `${origin}/reset-password?token=${token}` }, 'Link de redefinição (somente desenvolvimento)');
    },
  };
}
