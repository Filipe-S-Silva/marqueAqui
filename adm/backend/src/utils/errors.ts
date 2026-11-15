// Erros de aplicação com código HTTP e código de negócio estável (spec 17).
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: unknown[] | undefined;
  readonly headers: Record<string, string> | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { errors?: unknown[]; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.errors = options.errors;
    this.headers = options.headers;
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', errors?: unknown[]) =>
  new AppError(400, code, message, { errors });
export const validationError = (message: string, errors?: unknown[]) =>
  new AppError(400, 'VALIDATION_ERROR', message, { errors });
export const unauthorized = (message = 'Não autenticado.', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);
export const forbidden = (message = 'Você não tem permissão para esta operação.', code = 'FORBIDDEN') =>
  new AppError(403, code, message);
export const notFound = (message = 'Recurso não encontrado.', code = 'NOT_FOUND') =>
  new AppError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);
export const unprocessable = (message: string, code = 'UNPROCESSABLE') =>
  new AppError(422, code, message);
export const tooManyRequests = (retryAfterSeconds: number, message = 'Muitas tentativas. Aguarde e tente novamente.') =>
  new AppError(429, 'RATE_LIMITED', message, {
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  });
