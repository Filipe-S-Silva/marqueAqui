import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setSessionLostHandler, setToken } from '@/lib/api';

interface Admin { id: number; name: string; mustChangePassword: boolean; twoFactorEnabled: boolean; twoFactorSetupRequired: boolean }
type LoginResponse = { twoFactorRequired: true; challengeToken: string } | { twoFactorRequired: false; accessToken: string; admin: Admin };
interface AuthCtx {
  status: 'loading' | 'anonymous' | 'authenticated'; admin: Admin | null;
  /** Devolve o desafio quando o 2FA é exigido; senão, entra direto. */
  login: (name: string, email: string, password: string) => Promise<{ challengeToken: string } | null>;
  completeTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  /** Recarrega o estado do administrador (ex.: depois de ativar/desativar o 2FA). */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  /** Chamado após trocar a senha provisória. */
  markPasswordChanged: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: AuthCtx['status']; admin: Admin | null }>({ status: 'loading', admin: null });

  useEffect(() => {
    setSessionLostHandler(() => { setToken(null); setState({ status: 'anonymous', admin: null }); });
    if (!getToken()) { setState({ status: 'anonymous', admin: null }); return () => setSessionLostHandler(null); }
    // Confirma com o servidor (conta ativa, token válido) antes de liberar as rotas
    api.get<Admin>('/auth/me').then((a) => setState({ status: 'authenticated', admin: a }))
      .catch(() => { setToken(null); setState({ status: 'anonymous', admin: null }); });
    return () => setSessionLostHandler(null);
  }, []);

  const enter = useCallback((r: Extract<LoginResponse, { twoFactorRequired: false }>) => {
    setToken(r.accessToken);
    setState({ status: 'authenticated', admin: r.admin });
  }, []);

  const login = useCallback(async (name: string, email: string, password: string) => {
    const r = await api.post<LoginResponse>('/auth/login', { name, email, password }, false);
    if (r.twoFactorRequired) return { challengeToken: r.challengeToken };
    enter(r);
    return null;
  }, [enter]);

  const completeTwoFactor = useCallback(async (challengeToken: string, code: string) => {
    const r = await api.post<LoginResponse>('/auth/login/2fa', { challengeToken, code }, false);
    if (r.twoFactorRequired) throw new Error('Resposta inesperada do servidor.');
    enter(r);
  }, [enter]);

  const refresh = useCallback(async () => {
    const a = await api.get<Admin>('/auth/me');
    setState((s) => ({ ...s, admin: a }));
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* encerra localmente de qualquer forma */ }
    setToken(null);
    setState({ status: 'anonymous', admin: null });
  }, []);

  const markPasswordChanged = useCallback(() => {
    setState((s) => (s.admin ? { ...s, admin: { ...s.admin, mustChangePassword: false } } : s));
  }, []);

  const value = useMemo(() => ({ ...state, login, completeTwoFactor, refresh, logout, markPasswordChanged }), [state, login, completeTwoFactor, refresh, logout, markPasswordChanged]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
