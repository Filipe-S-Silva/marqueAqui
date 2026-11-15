import type { z } from 'zod';
import { validationError } from './errors.ts';

/** Valida com Zod e devolve erro 400 padronizado, com a lista de campos inválidos. */
export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw validationError(
      'Dados inválidos. Corrija os campos indicados.',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
