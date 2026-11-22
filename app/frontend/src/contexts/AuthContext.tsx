import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  LOGIN_HEADERS, api, refreshSession, setAccessToken, setSessionLostHandler,
  type Portal, type SessionPayload, type SessionUser, type ShopLink,
} from '@/lib/api';

interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated';
  user: SessionUser | null;
  portal: Portal | null;
  shops: ShopLink[];
  activeShopId: number | null;
  mustChangePassword: boolean;
}

interface AuthCtx extends AuthState {
  login: (email: string, password: string, portal?: Portal) => Promise<SessionPayload>;
  register: (input: { name: string; email: string; phone?: string; password: string; acceptTerms: boolean; isAdult: boolean }) => Promise<SessionPayload>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  selectShop: (shopId: number) => Promise<void>;
  patchUser: (u: Partial<SessionUser>) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const ANON: AuthState = { status: 'anonymous', user: null, portal: null, shops: [], activeShopId: null, mustChangePassword: false };

const fromPayload = (p: SessionPayload): AuthState => ({
  status: 'authenticated', user: p.user, portal: p.portal, shops: p.shops, activeShopId: p.activeShopId, mustChangePassword: p.mustChangePassword,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...ANON, status: 'loading' });

  // Restaura a sessão pelo cookie de refresh ao abrir o app
  useEffect(() => {
    let alive = true;
    setSessionLostHandler(() => { setAccessToken(null); setState(ANON); });
    refreshSession().then((p) => { if (alive) setState(p ? fromPayload(p) : ANON); });
    return () => { alive = false; setSessionLostHandler(null); };
  }, []);

  const login = useCallback(async (email: string, password: string, portal: Portal = 'client') => {
    const p = await api.post<SessionPayload>('/auth/login', { email, password, portal }, { auth: false });
    setAccessToken(p.accessToken);
    setState(fromPayload(p));
    return p;
  }, []);

  const register = useCallback(async (input: { name: string; email: string; phone?: string; password: string; acceptTerms: boolean; isAdult: boolean }) => {
    const p = await api.post<SessionPayload>('/auth/register', input, { auth: false });
    setAccessToken(p.accessToken);
    setState(fromPayload(p));
    return p;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', undefined, { headers: LOGIN_HEADERS }); } catch { /* encerra localmente de qualquer forma */ }
    setAccessToken(null);
    setState(ANON);
  }, []);

  const reload = useCallback(async () => {
    const me = await api.get<Omit<SessionPayload, 'accessToken' | 'expiresInSeconds' | 'mustChangePassword'>>('/auth/me');
    setState({
      status: 'authenticated', user: me.user, portal: me.portal, shops: me.shops, activeShopId: me.activeShopId,
      mustChangePassword: me.user.mustChangePassword,
    });
  }, []);

  const selectShop = useCallback(async (shopId: number) => {
    const r = await api.post<{ accessToken: string; activeShopId: number; shops: ShopLink[] }>('/auth/select-shop', { shopId });
    setAccessToken(r.accessToken);
    setState((s) => ({ ...s, activeShopId: r.activeShopId, shops: r.shops }));
  }, []);

  const patchUser = useCallback((u: Partial<SessionUser>) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, ...u } } : s));
  }, []);

  const value = useMemo(() => ({ ...state, login, register, logout, reload, selectShop, patchUser }), [state, login, register, logout, reload, selectShop, patchUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}

export const PORTAL_BY_ROLE = { CLIENT: '/app', PROFESSIONAL: '/staff', MANAGER: '/manager' } as const;

/** Home da sessão: quem entrou pelo login de cliente cai sempre na área do cliente, seja qual for o perfil. */
export function homeFor(user: SessionUser, portal: Portal | null): string {
  return portal === 'partner' ? PORTAL_BY_ROLE[user.role] : '/app';
}
