import { FEEDBACK_CATEGORIES, TICKET_CATEGORIES } from '@marqueaqui/database';
import { z } from 'zod';
import { adminPassword, dateSchema, emailSchema, idSchema, imageUrlSchema, nameSchema, paginationSchema, passwordSchema, phoneSchema } from './common.ts';

const optText = (max: number) => z.string().trim().max(max).transform((v) => (v === '' ? null : v));

export const challengeBody = z.object({ challengeToken: z.string().min(20).max(200), code: z.string().trim().min(6).max(20) });
export const twoFactorCodeBody = z.object({ code: z.string().trim().min(6).max(20) });
export const twoFactorConfirmBody = z.object({ adminPassword, code: z.string().trim().min(6).max(20) });
export const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });
export const auditQuery = paginationSchema.extend({
  type: z.enum(['AUTH', 'SECURITY', 'USER', 'SHOP', 'ANNOUNCEMENT', 'SUPPORT', 'ADMIN']).optional(),
  adminId: idSchema.optional(),
  action: z.string().trim().max(80).optional(),
  from: dateSchema.optional(), to: dateSchema.optional(),
});
export const announcementBody = z.object({
  adminPassword,
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(2000),
  audience: z.enum(['ALL', 'CLIENT', 'PROFESSIONAL', 'MANAGER', 'SHOP']),
  shopId: idSchema.optional(),
  requiresAck: z.boolean().default(false),
});

export const loginBody = z.object({ name: nameSchema, email: emailSchema, password: z.string().min(1).max(128) });
export const confirmOnly = z.object({ adminPassword });
export const activeBody = z.object({ adminPassword, active: z.boolean() });

/* empresas */
export const shopListQuery = paginationSchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
const managerInput = z.object({ name: nameSchema, email: emailSchema, phone: phoneSchema.optional() });
export const createShopBody = z.object({
  adminPassword,
  name: z.string().trim().min(2).max(120),
  description: optText(1000).optional(), address: optText(255).optional(), phone: optText(30).optional(),
  logoUrl: imageUrlSchema.nullable().optional(),
  manager: managerInput,
});
export const updateShopBody = z.object({
  adminPassword,
  name: z.string().trim().min(2).max(120).optional(),
  description: optText(1000).optional(), address: optText(255).optional(), phone: optText(30).optional(),
  logoUrl: imageUrlSchema.nullable().optional(),
}).strict();
export const addManagerBody = managerInput.extend({ adminPassword });
export const shopManagerParam = z.object({ id: idSchema, userId: idSchema });

/* usuários */
export const userFilters = z.object({
  name: z.string().trim().max(120).optional(), email: z.string().trim().max(254).optional(),
  role: z.enum(['CLIENT', 'PROFESSIONAL', 'MANAGER']).optional(), status: z.enum(['active', 'inactive']).optional(),
  shopId: idSchema.optional(), from: dateSchema.optional(), to: dateSchema.optional(),
});
export const userListQuery = userFilters.merge(paginationSchema);
export const userExportQuery = userFilters.extend({ format: z.enum(['csv', 'doc']).default('csv') });
export const createUserBody = z.object({
  adminPassword,
  role: z.enum(['CLIENT', 'PROFESSIONAL', 'MANAGER', 'ADMIN']),
  name: nameSchema, email: emailSchema, phone: phoneSchema.optional(), password: passwordSchema.optional(),
  shopIds: z.array(idSchema).max(50).default([]).transform((a) => [...new Set(a)]),
});
/** .strict(): campos como active, email e passwordHash são rejeitados (mass assignment). */
export const updateUserBody = z.object({
  adminPassword, name: nameSchema.optional(), phone: phoneSchema.optional(),
  role: z.enum(['CLIENT', 'PROFESSIONAL', 'MANAGER']).optional(),
  shopIds: z.array(idSchema).max(50).transform((a) => [...new Set(a)]).optional(),
}).strict();
export const shopLinkBody = z.object({ adminPassword, shopId: idSchema });
export const resetUserPasswordBody = z.object({ adminPassword, email: emailSchema });

/* administradores */
export const createAdminBody = z.object({ adminPassword, name: nameSchema, email: emailSchema, password: passwordSchema });
export const renameAdminBody = z.object({ adminPassword, name: nameSchema });

/* suporte: feedbacks e chamados */
export const feedbackListQuery = paginationSchema.extend({
  status: z.enum(['NEW', 'READ', 'ARCHIVED']).optional(),
  category: z.enum(FEEDBACK_CATEGORIES).optional(),
});
export const feedbackStatusBody = z.object({ adminPassword, status: z.enum(['NEW', 'READ', 'ARCHIVED']) }).strict();
export const ticketListQuery = paginationSchema.extend({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  waiting: z.enum(['1']).optional(), // só chamados aguardando resposta da equipe
});
export const ticketReplyBody = z.object({ adminPassword, message: z.string().trim().min(2).max(4000) }).strict();
export const ticketStatusBody = z.object({ adminPassword, status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']) }).strict();
