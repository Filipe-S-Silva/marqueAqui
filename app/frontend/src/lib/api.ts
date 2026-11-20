// Cliente HTTP. O access token vive só em memória; o refresh token é um cookie HttpOnly (nunca visível ao JS).
// Sem barra final: "…vercel.app/" + "/auth" vira "//auth", que redireciona e quebra o preflight de CORS.
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3333').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public errors: Array<{ path: string; message: string }> = [],
    public retryAfter?: number,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export const setAccessToken = (t: string | null): void => { accessToken = t; };
export const setSessionLostHandler = (fn: (() => void) | null): void => { onSessionLost = fn; };

interface Envelope<T> { success: boolean; message: string; data: T; code?: string; errors?: ApiError['errors'] }

async function raw(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (init.auth !== false && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  try {
    return await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Não foi possível concluir a operação.');
  }
}

async function toError(res: Response): Promise<ApiError> {
  let body: Partial<Envelope<unknown>> = {};
  try { body = (await res.json()) as Partial<Envelope<unknown>>; } catch { /* corpo vazio */ }
  const retry = Number(res.headers.get('Retry-After'));
  return new ApiError(
    res.status,
    body.code ?? 'ERROR',
    body.message ?? 'Não foi possível concluir a operação.',
    body.errors ?? [],
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  );
}

/** Fotos são servidas pela API: caminho relativo (/photos/…) vira URL completa; https externo passa como está. */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${BASE}${url}` : url;
}

/** Envia uma imagem como corpo binário (sem multipart) para PUT. */
export function uploadImage<T>(path: string, file: File): Promise<T> {
  return request<T>(path, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
}

export type Portal = 'client' | 'partner';

export interface SessionPayload {
  user: SessionUser;
  portal: Portal;
  accessToken: string;
  expiresInSeconds: number;
  shops: ShopLink[];
  activeShopId: number | null;
  mustChangePassword: boolean;
  redirectTo: string;
}
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export interface SessionUser {
  id: number; name: string; email: string; phone: string | null; role: 'CLIENT' | 'PROFESSIONAL' | 'MANAGER';
  photoUrl: string | null; description: string | null; mustChangePassword: boolean; createdAt: string;
}
export interface ShopLink { id: number; name: string; barberId: number | null }

/** Renova a sessão pelo cookie. Chamadas simultâneas compartilham a mesma requisição. */
export function refreshSession(): Promise<SessionPayload | null> {
  return doRefresh().then(() => lastPayload);
}
let lastPayload: SessionPayload | null = null;

function doRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await raw('/auth/refresh', { method: 'POST', auth: false, headers: { 'X-Requested-With': 'marqueaqui' } });
      if (!res.ok) { accessToken = null; lastPayload = null; return false; }
      const body = (await res.json()) as Envelope<SessionPayload>;
      accessToken = body.data.accessToken;
      lastPayload = body.data;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

export async function request<T>(path: string, init: RequestInit & { auth?: boolean; retry?: boolean } = {}): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && init.auth !== false && init.retry !== false) {
    if (await doRefresh()) res = await raw(path, init);
    else { onSessionLost?.(); }
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('Content-Type') ?? '';
  if (!ct.includes('application/json')) return (await res.blob()) as T;
  return ((await res.json()) as Envelope<T>).data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, extra: { auth?: boolean; headers?: Record<string, string> } = {}) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), ...extra }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Baixa um arquivo autenticado (exportações). */
export async function download(path: string, fallbackName: string): Promise<void> {
  const blob = await request<Blob>(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fallbackName; a.click();
  URL.revokeObjectURL(url);
}

export const LOGIN_HEADERS = { 'X-Requested-With': 'marqueaqui' };
