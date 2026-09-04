import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { RegisterWorkerPage } from '@/pages/RegisterWorkerPage';
import { RegisterBusinessPage } from '@/pages/RegisterBusinessPage';

// This site only ever does two things — register a Worker, or register a Shop. No admin
// routes here at all; admin-web is a completely separate site/deployment.
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/worker', element: <RegisterWorkerPage /> },
  { path: '/business', element: <RegisterBusinessPage /> },
]);
