import { isValidDate } from '@marqueaqui/database';
import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().max(254, 'E-mail muito longo.').email('E-mail inválido.');
export const nameSchema = z.string().trim().min(2, 'O nome precisa ter ao menos 2 caracteres.').max(120);
export const phoneSchema = z.string().trim().regex(/^[0-9()+\-\s]{8,20}$/, 'Telefone inválido.');
export const passwordSchema = z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.').max(128)
  .regex(/[A-Za-z]/, 'A senha precisa ter ao menos uma letra.').regex(/\d/, 'A senha precisa ter ao menos um número.');
export const idSchema = z.coerce.number().int().positive();
export const idParam = z.object({ id: idSchema });
export const dateSchema = z.string().refine(isValidDate, 'Data inválida. Use YYYY-MM-DD.');
/** Presente em todo corpo que altera dados. */
export const adminPassword = z.string().min(1, 'Confirme com sua senha.').max(128);
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export const imageUrlSchema = z.string().trim().max(560_000).refine(
  (v) => /^https:\/\/[^\s]+$/i.test(v) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
  'Use uma URL https ou uma imagem PNG, JPEG ou WebP.',
);
