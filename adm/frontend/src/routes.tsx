import { createBrowserRouter, Navigate } from 'react-router';
import { AccountPage } from '@/features/account/AccountPage';
import { AnnouncementsPage } from '@/features/announcements/AnnouncementsPage';
import { FeedbacksPage, TicketDetail, TicketsPage } from '@/features/support/SupportAdmin';
import { AuditPage } from '@/features/audit/AuditPage';
import { AdminsPage } from '@/features/admins/AdminsPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { ShopDetail } from '@/features/shops/ShopDetail';
import { NewShopPage } from '@/features/shops/ShopForm';
import { ShopsList } from '@/features/shops/ShopsList';
import { NewUserPage } from '@/features/users/UserForm';
import { UserDetail } from '@/features/users/UserDetail';
import { UsersList } from '@/features/users/UsersList';
import { AdminLayout, GuestOnly, RequireAdmin } from '@/layouts/Layouts';

export const router = createBrowserRouter([
  { element: <GuestOnly />, children: [{ path: '/login', element: <LoginPage /> }] },
  {
    element: <RequireAdmin />,
    children: [{
      element: <AdminLayout />,
      children: [
        { path: '/', element: <Dashboard /> },
        { path: '/shops', element: <ShopsList /> },
        { path: '/shops/new', element: <NewShopPage /> },
        { path: '/shops/:id', element: <ShopDetail /> },
        { path: '/users', element: <UsersList /> },
        { path: '/users/new', element: <NewUserPage /> },
        { path: '/users/:id', element: <UserDetail /> },
        { path: '/admins', element: <AdminsPage /> },
        { path: '/tickets', element: <TicketsPage /> },
        { path: '/tickets/:id', element: <TicketDetail /> },
        { path: '/feedbacks', element: <FeedbacksPage /> },
        { path: '/announcements', element: <AnnouncementsPage /> },
        { path: '/audit', element: <AuditPage /> },
        { path: '/account', element: <AccountPage /> },
      ],
    }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
