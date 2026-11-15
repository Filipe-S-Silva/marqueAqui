import { z } from 'zod';
import { emailSchema, idSchema, nameSchema, optionalPhoneSchema, passwordSchema } from './common.ts';

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Sem regras de formato no login: qualquer texto é só "senha incorreta"
  password: z.string().min(1, 'Informe a senha.').max(128),
  // Login de cliente (padrão) ou de parceiro (gestor/profissional vinculado a uma empresa)
  portal: z.enum(['client', 'partner']).default('client'),
});

export const selectShopSchema = z.object({ shopId: idSchema });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.').max(128),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: passwordSchema,
});
