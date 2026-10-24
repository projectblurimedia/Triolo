import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { RequireAdmin } from '@/components/RequireAdmin';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { AdDetailPage, AdEditPage, AdNewPage, AdsPage } from '@/pages/AdsPages';
import { DashboardPage } from '@/pages/DashboardPage';
import { AccountsPage, BookingsPage, JobPostsPage, OrdersPage, ProblemsPage, ShopsPage, WorkersPage } from '@/pages/ListPages';
import {
  AccountDetailPage,
  BookingDetailPage,
  JobPostDetailPage,
  OrderDetailPage,
  ProblemDetailPage,
  ShopDetailPage,
  WorkerDetailPage,
} from '@/pages/DetailPages';

function BookingsOrDetail() {
  const { id } = useParams();
  return id === 'quick' || id === 'problem' ? <BookingsPage kind={id} /> : <BookingDetailPage />;
}

// The whole site is the admin console: every page except /login needs an admin session.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAdmin>
        <Layout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'accounts/:id', element: <AccountDetailPage /> },
      { path: 'workers', element: <WorkersPage /> },
      { path: 'workers/:id', element: <WorkerDetailPage /> },
      { path: 'shops', element: <ShopsPage /> },
      { path: 'shops/:id', element: <ShopDetailPage /> },
      // Old links from the previous admin site.
      { path: 'businesses/:id', element: <ShopDetailPage /> },
      { path: 'bookings', element: <Navigate to="/bookings/quick" replace /> },
      // /bookings/quick and /bookings/problem are the lists; anything else is one booking.
      { path: 'bookings/:id', element: <BookingsOrDetail /> },
      { path: 'problems', element: <ProblemsPage /> },
      { path: 'problems/:id', element: <ProblemDetailPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: 'job-posts', element: <JobPostsPage /> },
      { path: 'job-posts/:id', element: <JobPostDetailPage /> },
      { path: 'ads', element: <AdsPage /> },
      { path: 'subscriptions', element: <SubscriptionsPage /> },
      { path: 'ads/new', element: <AdNewPage /> },
      { path: 'ads/:id', element: <AdDetailPage /> },
      { path: 'ads/:id/edit', element: <AdEditPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
