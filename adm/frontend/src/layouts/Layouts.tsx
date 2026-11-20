import { Building2, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Megaphone, Menu, MessageSquareText, ScrollText, ShieldCheck, Users, X } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { PageLoading } from '@/components/common/states';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/shops', label: 'Empresas', icon: Building2, end: false },
  { to: '/users', label: 'Usuários', icon: Users, end: false },
  { to: '/admins', label: 'Administradores', icon: ShieldCheck, end: false },
  { to: '/tickets', label: 'Chamados', icon: LifeBuoy, end: false },
  { to: '/feedbacks', label: 'Feedbacks', icon: MessageSquareText, end: false },
  { to: '/announcements', label: 'Comunicados', icon: Megaphone, end: false },
  { to: '/audit', label: 'Auditoria', icon: ScrollText, end: false },
  { to: '/account', label: 'Segurança', icon: KeyRound, end: false },
];

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2 font-extrabold tracking-tight">
      <span className="relative grid size-8 place-items-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-card">
        <ShieldCheck className="mt-0.5 size-[18px]" aria-hidden />
      </span>
      <span className="font-display">Marque<span className="text-primary">Aqui</span> <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase text-background">ADM</span></span>
    </span>
  );
}

export function RequireAdmin() {
  const { status, admin } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <PageLoading label="Verificando sessão…" />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // Senha provisória: a API só aceita a troca de senha até ela ser feita
  if ((admin?.mustChangePassword || admin?.twoFactorSetupRequired) && loc.pathname !== '/account') return <Navigate to="/account" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <PageLoading />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

export function AdminLayout() {
  const { admin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const sidebar = (group: string) => (
    <LayoutGroup id={group}>
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Brand />
        <button type="button" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="size-5" /></button>
      </div>
      <nav aria-label="Principal" className="grid gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cn('relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150', isActive ? 'text-primary-foreground' : 'hover:bg-accent')}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-md bg-primary shadow-card"
                    transition={{ type: 'spring', duration: 0.35, bounce: 0.12 }} aria-hidden />
                )}
                <span className="relative z-10 flex items-center gap-3"><Icon className="size-4" /> {label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto grid gap-2 border-t pt-4">
        <p className="truncate text-sm font-semibold">{admin?.name}</p>
        <Button variant="outline" size="sm" onClick={() => void logout()}><LogOut className="size-4" /> Sair</Button>
      </div>
    </div>
    </LayoutGroup>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r bg-card lg:block">{sidebar('desk')}</aside>
      <div className={cn('fixed inset-0 z-40 bg-[#071039]/50 transition-opacity duration-200 ease-out lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={() => setOpen(false)} aria-hidden />
      <aside className={cn('fixed inset-y-0 left-0 z-50 w-72 border-r bg-card shadow-float transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden', open ? 'translate-x-0' : '-translate-x-full')} aria-hidden={!open} inert={!open}>{sidebar('mobile')}</aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur print:hidden lg:justify-end">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></Button>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6"><div key={loc.pathname} className="rise"><Outlet /></div></main>
      </div>
    </div>
  );
}
