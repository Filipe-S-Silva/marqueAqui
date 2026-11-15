import { isValidDate, isValidMonth, isValidTime } from '@marqueaqui/database';
import { z } from 'zod';

export const emailSchema = z
  .string({ required_error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .max(254, 'E-mail muito longo.')
  .email('E-mail inválido.');

export const nameSchema = z
  .string({ required_error: 'Informe o nome.' })
  .trim()
  .min(2, 'O nome precisa ter ao menos 2 caracteres.')
  .max(120, 'O nome pode ter no máximo 120 caracteres.');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9()+\-\s]{8,20}$/, 'Telefone inválido. Use apenas números, espaços, parênteses, + e -.');

export const optionalPhoneSchema = phoneSchema.optional().or(z.literal('').transform(() => undefined));

/** Regras de senha: 8 a 128 caracteres, com letra e número. */
export const passwordSchema = z
  .string({ required_error: 'Informe a senha.' })
  .min(8, 'A senha precisa ter ao menos 8 caracteres.')
  .max(128, 'A senha pode ter no máximo 128 caracteres.')
  .regex(/[A-Za-z]/, 'A senha precisa ter ao menos uma letra.')
  .regex(/\d/, 'A senha precisa ter ao menos um número.');

export const idSchema = z.coerce.number().int().positive();
export const dateSchema = z.string().refine(isValidDate, 'Data inválida. Use YYYY-MM-DD.');
export const timeSchema = z.string().refine(isValidTime, 'Horário inválido. Use HH:MM.');
export const monthSchema = z.string().refine(isValidMonth, 'Mês inválido. Use YYYY-MM.');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(6),
});

/** URL https ou imagem enviada pelo navegador (data URL png/jpeg/webp de até ~400 KB). SVG é proibido (XSS). */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(560_000, 'Imagem grande demais. Reduza o tamanho.')
  .refine(
    (v) => /^https:\/\/[^\s]+$/i.test(v) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    'Use uma URL https ou envie uma imagem PNG, JPEG ou WebP.',
  );
