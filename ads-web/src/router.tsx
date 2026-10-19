import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RequireLogin } from '@/components/RequireLogin';
import { LoginPage } from '@/pages/LoginPage';
import { AdDetailPage, AdEditPage, AdNewPage, HowItWorksPage, MyAdsPage } from '@/pages/AdsPages';

// The Triolo Ads website: businesses book their own ads; Triolo reviews them in admin-web.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireLogin>
        <Layout />
      </RequireLogin>
    ),
    children: [
      { index: true, element: <MyAdsPage /> },
      { path: 'new', element: <AdNewPage /> },
      { path: 'how', element: <HowItWorksPage /> },
      { path: 'ads/:id', element: <AdDetailPage /> },
      { path: 'ads/:id/edit', element: <AdEditPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
