// Tratamento global de erros: nunca devolve stack trace nem detalhe interno (spec 17).
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.ts';

function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let i = 0; i < 4 && current && typeof current === 'object'; i++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ success: false, message: 'Rota não encontrada.', code: 'NOT_FOUND', errors: [] });
  });

  app.setErrorHandler((error: FastifyError | Error, req, reply) => {
    if (error instanceof AppError) {
      if (error.headers) for (const [k, v] of Object.entries(error.headers)) reply.header(k, v);
      return reply
        .status(error.status)
        .send({ success: false, message: error.message, code: error.code, errors: error.errors ?? [] });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        message: 'Dados inválidos.',
        code: 'VALIDATION_ERROR',
        errors: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const code = pgCode(error);
    if (code === '23505') {
      return reply.status(409).send({ success: false, message: 'Registro duplicado.', code: 'CONFLICT', errors: [] });
    }
    if (code === '23503') {
      return reply.status(409).send({
        success: false,
        message: 'A operação conflita com registros relacionados.',
        code: 'CONFLICT',
        errors: [],
      });
    }
    if (code === '23514' || code === '22P02' || code === '22007') {
      return reply.status(400).send({ success: false, message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors: [] });
    }

    const statusCode = (error as FastifyError).statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      const map: Record<number, [string, string]> = {
        400: ['Requisição inválida.', 'BAD_REQUEST'],
        413: ['Corpo da requisição grande demais.', 'PAYLOAD_TOO_LARGE'],
        415: ['Tipo de conteúdo não suportado. Use application/json.', 'UNSUPPORTED_MEDIA_TYPE'],
        429: ['Muitas requisições. Aguarde e tente novamente.', 'RATE_LIMITED'],
      };
      const [message, errCode] = map[statusCode] ?? ['Requisição inválida.', 'BAD_REQUEST'];
      return reply.status(statusCode).send({ success: false, message, code: errCode, errors: [] });
    }

    req.log.error({ err: error, url: req.url, method: req.method }, 'Erro não tratado');
    return reply.status(500).send({
      success: false,
      message: 'Erro interno. Tente novamente em instantes.',
      code: 'INTERNAL_ERROR',
      errors: [],
    });
  });
}
