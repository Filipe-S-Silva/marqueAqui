import type { FastifyReply } from 'fastify';

/** Resposta de sucesso padronizada (spec 17). */
export function ok<T>(reply: FastifyReply, data: T, message = 'Operação realizada com sucesso.', status = 200) {
  return reply.status(status).send({ success: true, message, data });
}

export function created<T>(reply: FastifyReply, data: T, message = 'Criado com sucesso.') {
  return ok(reply, data, message, 201);
}

export function sendFile(reply: FastifyReply, filename: string, contentType: string, body: string) {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  return reply
    .header('Content-Type', contentType)
    .header('Content-Disposition', `attachment; filename="${safe}"`)
    .send(body);
}
