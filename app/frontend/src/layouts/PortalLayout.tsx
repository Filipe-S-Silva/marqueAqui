import { Handshake, LogOut, Menu, X } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BrandMark } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { NoticesDialog } from '@/features/notifications/NoticesDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/hooks/useAsync';
import { cn } from '@/lib/utils';

export interface NavItem { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean }

export function PortalLayout({ nav, title }: { nav: NavItem[]; title: string }) {
  const { user, shops, activeShopId, selectShop, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  async function onShop(id: number) {
    try { await selectShop(id); toast.push('success', 'Empresa ativa alterada.'); } catch (e) { toast.push('error', errorMessage(e)); }
  }

  const sidebar = (group: string) => (
    <LayoutGroup id={group}>
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <BrandMark />
        <button type="button" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="size-5" /></button>
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      {shops.length > 1 && (
        <Select aria-label="Empresa ativa" value={activeShopId ?? ''} onChange={(e) => void onShop(Number(e.target.value))}>
          {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      )}
      {shops.length === 1 && <p className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold">{shops[0]!.name}</p>}
      <nav aria-label="Principal" className="grid gap-1">
        {nav.map(({ to, label, icon: Icon, end }) => (
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
        <div className="flex items-center gap-2">
          <Avatar name={user?.name ?? ''} photoUrl={user?.photoUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        {title === 'Cliente' && user && user.role !== 'CLIENT' && (
          <Button variant="ghost" size="sm" onClick={() => void logout().then(() => navigate('/parceiro/login'))}><Handshake className="size-4" /> Entrar como parceiro</Button>
        )}
        <Button variant="outline" size="sm" onClick={() => void logout()}><LogOut className="size-4" /> Sair</Button>
      </div>
    </div>
    </LayoutGroup>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r bg-card lg:block">{sidebar('desk')}</aside>
      <div className={cn('fixed inset-0 z-40 bg-[#0b1220]/50 transition-opacity duration-200 ease-out lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={() => setOpen(false)} aria-hidden />
      <aside className={cn('fixed inset-y-0 left-0 z-50 w-72 border-r bg-card shadow-float transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden', open ? 'translate-x-0' : '-translate-x-full')} aria-hidden={!open} inert={!open}>
        {sidebar('mobile')}
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur lg:justify-end">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></Button>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-5xl p-4 sm:p-6"><div key={loc.pathname} className="rise"><Outlet /></div></main>
      </div>
      <NoticesDialog />
    </div>
  );
}
