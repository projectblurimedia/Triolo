import { createBrowserRouter } from 'react-router-dom';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { AdminWorkerDetailPage, AdminBusinessDetailPage } from '@/pages/AdminProfileDetailPage';
import { RequireAdmin } from '@/components/RequireAdmin';

// A dedicated site — routes aren't prefixed with /admin since the whole site is the admin
// dashboard (unlike the earlier combined web/ app this was split from).
export const router = createBrowserRouter([
  { path: '/login', element: <AdminLoginPage /> },
  {
    path: '/',
    element: (
      <RequireAdmin>
        <AdminDashboardPage />
      </RequireAdmin>
    ),
  },
  {
    path: '/workers/:id',
    element: (
      <RequireAdmin>
        <AdminWorkerDetailPage />
      </RequireAdmin>
    ),
  },
  {
    path: '/businesses/:id',
    element: (
      <RequireAdmin>
        <AdminBusinessDetailPage />
      </RequireAdmin>
    ),
  },
]);
