import { z } from 'zod';
import { emailSchema, idSchema, nameSchema, optionalPhoneSchema, passwordSchema } from './common.ts';

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
  password: passwordSchema,
  // Conta própria só para maiores de 18 (capacidade civil para contratar); menores são atendidos pela conta do responsável
  acceptTerms: z.literal(true, { error: 'Aceite os Termos de Uso e a Política de Privacidade.' }),
  isAdult: z.literal(true, { error: 'É preciso ter 18 anos ou mais para criar uma conta.' }),
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

export const deleteAccountSchema = z.object({ password: z.string().min(1, 'Informe a senha.').max(128) });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: passwordSchema,
});
