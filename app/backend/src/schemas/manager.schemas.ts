import { z } from 'zod';
import { emailSchema, idSchema, imageUrlSchema, monthSchema, nameSchema, optionalPhoneSchema, timeSchema } from './common.ts';

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

/** `name` só é exigido quando o e-mail ainda não tem conta; profissional já cadastrado é apenas vinculado à empresa. */
export const createProfessionalBody = z.object({
  name: nameSchema.optional(),
  email: emailSchema,
  phone: optionalPhoneSchema,
  serviceIds: z.array(idSchema).max(100).default([]).transform((a) => [...new Set(a)]),
});

export const createManagerBody = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
});

export const barberIdParam = z.object({ barberId: idSchema });

export const barberServicesBody = z.object({
  serviceIds: z.array(idSchema).max(100).transform((a) => [...new Set(a)]),
});

export const workingHoursBody = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.coerce.number().int().min(0).max(6),
        startTime: timeSchema,
        endTime: timeSchema,
      }),
    )
    .max(42),
});

export const createServiceBody = z.object({
  name: z.string().trim().min(2).max(100),
  description: optionalText(500),
  durationMinutes: z.coerce.number().int().min(30).max(480).refine((v) => v % 30 === 0, 'A duração deve ser múltipla de 30 minutos.'),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
});

export const updateServiceBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: optionalText(500),
    durationMinutes: createServiceBody.shape.durationMinutes,
    priceCents: createServiceBody.shape.priceCents,
    active: z.boolean(),
  })
  .partial()
  .strict();

export const updateShopBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: optionalText(1000),
    address: optionalText(255),
    phone: optionalPhoneSchema,
    logoUrl: imageUrlSchema.nullable(),
  })
  .partial()
  .strict();

export const reportQuery = z.object({ month: monthSchema.optional() });
export const exportQuery = z.object({ month: monthSchema.optional(), format: z.enum(['csv', 'doc']).default('csv') });

/** .strict(): campos como role, active ou email são rejeitados (mass assignment). */
export const updateProfileBody = z
  .object({
    name: nameSchema,
    phone: optionalPhoneSchema,
    photoUrl: imageUrlSchema.nullable(),
    description: optionalText(500),
  })
  .partial()
  .strict();
