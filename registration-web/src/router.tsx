import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { RegisterWorkerPage } from '@/pages/RegisterWorkerPage';
import { RegisterBusinessPage } from '@/pages/RegisterBusinessPage';
import { RegisterJobSeekerPage } from '@/pages/RegisterJobSeekerPage';

// This site does three things — register a Worker, register a Shop, or post for a job. No admin
// routes here at all; admin-web is a completely separate site/deployment.
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/worker', element: <RegisterWorkerPage /> },
  { path: '/business', element: <RegisterBusinessPage /> },
  { path: '/job', element: <RegisterJobSeekerPage /> },
]);
