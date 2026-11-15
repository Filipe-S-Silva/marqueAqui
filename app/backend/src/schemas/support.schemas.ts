import { FEEDBACK_CATEGORIES, TICKET_CATEGORIES } from '@marqueaqui/database';
import { z } from 'zod';
import { paginationSchema } from './common.ts';

const text = (min: number, max: number) =>
  z.string().trim().min(min, `Escreva ao menos ${min} caracteres.`).max(max, `Use no máximo ${max} caracteres.`);

/** Feedback do usuário para a equipe da plataforma. `.strict()` rejeita campos extras (mass assignment). */
export const feedbackBody = z
  .object({
    category: z.enum(FEEDBACK_CATEGORIES),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    message: text(10, 2000),
  })
  .strict();

export const ticketCreateBody = z
  .object({ subject: text(5, 150), category: z.enum(TICKET_CATEGORIES), message: text(10, 4000) })
  .strict();

export const ticketMessageBody = z.object({ message: text(2, 4000) }).strict();

/** Avaliação do cliente sobre um atendimento concluído. */
export const reviewBody = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional().transform((v) => (v ? v : null)),
  })
  .strict();

export const reviewReplyBody = z.object({ reply: text(2, 1000) }).strict();

export const pageQuery = paginationSchema.extend({ pageSize: z.coerce.number().int().min(1).max(50).default(10) });
