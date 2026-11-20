// Cliente HTTP do ADM. O token vive em sessionStorage (spec 8.1); não há refresh: expirou (8 h), entra de novo.
// Sem barra final: "…/" + "/auth" vira "//auth", que redireciona e quebra o preflight de CORS.
const BASE = ((import.meta.env.VITE_ADM_API_URL as string | undefined) ?? 'http://localhost:3334').replace(/\/+$/, '');
const KEY = 'mq-adm-token';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string,
    public errors: Array<{ path: string; message: string }> = [], public retryAfter?: number) { super(message); }
}

export const getToken = (): string | null => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t: string | null): void => {
  try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch { /* indisponível */ }
};

let onSessionLost: (() => void) | null = null;
export const setSessionLostHandler = (fn: (() => void) | null): void => { onSessionLost = fn; };

interface Envelope<T> { success: boolean; message: string; data: T; code?: string; errors?: ApiError['errors'] }

export async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (init.auth !== false && token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Não foi possível concluir a operação.');
  }

  if (!res.ok) {
    let body: Partial<Envelope<unknown>> = {};
    try { body = (await res.json()) as Partial<Envelope<unknown>>; } catch { /* sem corpo */ }
    // 401 fora do login = sessão expirada/inválida; 403 de confirmação de senha NÃO derruba a sessão
    if (res.status === 401 && init.auth !== false) onSessionLost?.();
    const retry = Number(res.headers.get('Retry-After'));
    throw new ApiError(res.status, body.code ?? 'ERROR', body.message ?? 'Não foi possível concluir a operação.', body.errors ?? [], retry > 0 ? retry : undefined);
  }
  if (res.status === 204) return undefined as T;
  if (!(res.headers.get('Content-Type') ?? '').includes('application/json')) return (await res.blob()) as T;
  return ((await res.json()) as Envelope<T>).data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), auth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};

/** Baixa um arquivo autenticado usando os dados devolvidos pela API (exportações). */
export async function download(path: string, filename: string): Promise<void> {
  const blob = await request<Blob>(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
