import { CalendarDays, CalendarPlus, ClipboardList, Home, LayoutDashboard, LifeBuoy, Scissors, Star, Store, UserCircle, Users, BarChart3 } from 'lucide-react';
import { Navigate, createBrowserRouter } from 'react-router';
import { homeFor, useAuth } from '@/contexts/AuthContext';
import { PageLoading } from '@/components/common/states';
import { ChangePasswordPage, ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/PasswordPages';
import { LoginPage, PartnerLoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { BookingWizard } from '@/features/client/BookingWizard';
import { ClientDashboard } from '@/features/client/ClientDashboard';
import { MyAppointments } from '@/features/client/MyAppointments';
import { LandingPage } from '@/features/landing/LandingPage';
import { PrivacyPage, TermsPage } from '@/features/legal/LegalPages';
import { ManagerAgendas } from '@/features/manager/ManagerAgendas';
import { ManagerDashboard } from '@/features/manager/ManagerDashboard';
import { ReviewsPage } from '@/features/manager/ReviewsPage';
import { SupportPage } from '@/features/support/SupportPage';
import { ReportPage } from '@/features/manager/ReportPage';
import { ServicesPage } from '@/features/manager/ServicesPage';
import { ShopPage } from '@/features/manager/ShopPage';
import { TeamPage } from '@/features/manager/Team';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { StaffAgendaPage, StaffDashboard } from '@/features/staff/StaffPages';
import { GuestOnly, RequireClientArea, RequirePartner } from '@/layouts/RouteGuards';
import { PortalLayout, type NavItem } from '@/layouts/PortalLayout';

const CLIENT_NAV: NavItem[] = [
  { to: '/app', label: 'Início', icon: Home, end: true },
  { to: '/app/new', label: 'Novo agendamento', icon: CalendarPlus },
  { to: '/app/appointments', label: 'Meus agendamentos', icon: ClipboardList },
  { to: '/app/support', label: 'Suporte', icon: LifeBuoy },
  { to: '/app/profile', label: 'Meu perfil', icon: UserCircle },
];
const STAFF_NAV: NavItem[] = [
  { to: '/staff', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/staff/agenda', label: 'Minha agenda', icon: CalendarDays },
  { to: '/staff/support', label: 'Suporte', icon: LifeBuoy },
  { to: '/staff/profile', label: 'Meu perfil', icon: UserCircle },
];
const MANAGER_NAV: NavItem[] = [
  { to: '/manager', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/manager/agendas', label: 'Agendas', icon: CalendarDays },
  { to: '/manager/team', label: 'Equipe', icon: Users },
  { to: '/manager/services', label: 'Serviços', icon: Scissors },
  { to: '/manager/shop', label: 'Empresa', icon: Store },
  { to: '/manager/reviews', label: 'Avaliações', icon: Star },
  { to: '/manager/report', label: 'Relatório', icon: BarChart3 },
  { to: '/manager/my-agenda', label: 'Minha agenda', icon: CalendarDays },
  { to: '/manager/support', label: 'Suporte', icon: LifeBuoy },
  { to: '/manager/profile', label: 'Meu perfil', icon: UserCircle },
];

function HomeRedirect() {
  const { status, user, portal } = useAuth();
  if (status === 'loading') return <PageLoading />;
  return user ? <Navigate to={homeFor(user, portal)} replace /> : <LandingPage />;
}

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/parceiro/login', element: <PartnerLoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  { path: '/privacidade', element: <PrivacyPage /> },
  { path: '/termos', element: <TermsPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },
  {
    path: '/app',
    element: <RequireClientArea />,
    children: [{
      element: <PortalLayout nav={CLIENT_NAV} title="Cliente" />,
      children: [
        { index: true, element: <ClientDashboard /> },
        { path: 'new', element: <BookingWizard /> },
        { path: 'appointments', element: <MyAppointments /> },
        { path: 'support', element: <SupportPage /> },
        { path: 'profile', element: <ProfilePage /> },
      ],
    }],
  },
  {
    path: '/staff',
    element: <RequirePartner role="PROFESSIONAL" />,
    children: [{
      element: <PortalLayout nav={STAFF_NAV} title="Profissional" />,
      children: [
        { index: true, element: <StaffDashboard /> },
        { path: 'agenda', element: <StaffAgendaPage /> },
        { path: 'support', element: <SupportPage /> },
        { path: 'profile', element: <ProfilePage /> },
      ],
    }],
  },
  {
    path: '/manager',
    element: <RequirePartner role="MANAGER" />,
    children: [{
      element: <PortalLayout nav={MANAGER_NAV} title="Gestor" />,
      children: [
        { index: true, element: <ManagerDashboard /> },
        { path: 'agendas', element: <ManagerAgendas /> },
        { path: 'team', element: <TeamPage /> },
        { path: 'services', element: <ServicesPage /> },
        { path: 'shop', element: <ShopPage /> },
        { path: 'reviews', element: <ReviewsPage /> },
        { path: 'support', element: <SupportPage /> },
        { path: 'report', element: <ReportPage /> },
        { path: 'my-agenda', element: <StaffAgendaPage /> },
        { path: 'profile', element: <ProfilePage /> },
      ],
    }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
