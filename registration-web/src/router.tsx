import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { RegisterWorkerPage } from '@/pages/RegisterWorkerPage';
import { RegisterBusinessPage } from '@/pages/RegisterBusinessPage';
import { RegisterJobSeekerPage } from '@/pages/RegisterJobSeekerPage';
import { LegalPage } from '@/pages/LegalPage';
import { DeleteAccountPage } from '@/pages/DeleteAccountPage';
import { PRIVACY, REFUNDS, TERMS } from '@/legal/content';

// This site does three things — register a Worker, register a Shop, or post for a job. No admin
// routes here at all; admin-web is a completely separate site/deployment.
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/worker', element: <RegisterWorkerPage /> },
  { path: '/business', element: <RegisterBusinessPage /> },
  { path: '/job', element: <RegisterJobSeekerPage /> },
  // Public legal pages (the apps and the Play Store link here).
  { path: '/privacy', element: <LegalPage doc={PRIVACY} /> },
  { path: '/terms', element: <LegalPage doc={TERMS} /> },
  { path: '/refunds', element: <LegalPage doc={REFUNDS} /> },
  { path: '/delete-account', element: <DeleteAccountPage /> },
]);
