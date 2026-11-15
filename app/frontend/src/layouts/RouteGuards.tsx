import { Navigate, Outlet, useLocation } from 'react-router';
import { PageLoading } from '@/components/common/states';
import { PORTAL_BY_ROLE, homeFor, useAuth } from '@/contexts/AuthContext';

type PartnerRole = 'PROFESSIONAL' | 'MANAGER';

/**
 * Área do cliente: qualquer conta autenticada entra (parceiro que escolheu o login de cliente tem acesso normal).
 * A decisão final de acesso é sempre do backend; isto só evita telas erradas.
 */
export function RequireClientArea() {
  const { status, user, mustChangePassword } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <PageLoading label="Verificando sessão…" />;
  if (status === 'anonymous' || !user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

/** Áreas de parceiro: exigem o login de parceiro E o perfil certo. Cliente nunca passa daqui. */
export function RequirePartner({ role }: { role: PartnerRole }) {
  const { status, user, portal, mustChangePassword } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <PageLoading label="Verificando sessão…" />;
  if (status === 'anonymous' || !user) return <Navigate to="/parceiro/login" replace state={{ from: loc.pathname }} />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  if (portal !== 'partner' || user.role === 'CLIENT') return <Navigate to="/app" replace />;
  if (user.role !== role) return <Navigate to={PORTAL_BY_ROLE[user.role]} replace />;
  return <Outlet />;
}

/** Páginas só para visitantes (login, cadastro): quem já entrou vai para a própria área. */
export function GuestOnly() {
  const { status, user, portal, mustChangePassword } = useAuth();
  if (status === 'loading') return <PageLoading />;
  if (status === 'authenticated' && user) return <Navigate to={mustChangePassword ? '/change-password' : homeFor(user, portal)} replace />;
  return <Outlet />;
}
