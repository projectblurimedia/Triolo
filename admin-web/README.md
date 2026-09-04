# Admin Web

React + Vite + TypeScript — the Admin verification dashboard. A dedicated site, not sharing a deployment with the public registration forms — see `../registration-web` for those (split from an earlier combined `web/` app per follow-up feedback).

## Setup

```bash
npm install
npm run dev         # Vite dev server, http://localhost:5173
npm run build        # typecheck + production build
npm run typecheck
```

Expects the backend running locally at `http://localhost:4000` (see `src/services/apiClient.ts`).

## Structure

```
src/
  pages/          AdminLoginPage, AdminDashboardPage, AdminProfileDetailPage
  components/     PageHeader, RequireAdmin, VerificationBadge, LoadingSpinner
  services/       apiClient, authService, workersService, businessesService, adminService,
                  errorMessages
  state/          authStore (zustand, localStorage-persisted)
  theme/          brand color tokens + global.css
  router.tsx, main.tsx
```

## What's implemented

`/login` (OTP login, rejects non-`admin` accounts client-side — the real enforcement is server-side `authorize('admin')`) → `/` (Workers/Businesses tabs, filterable by verification status) → `/workers/:id`, `/businesses/:id` (full profile + Approve/Reject).

Admin accounts are seeded via `backend/scripts/seedAdmin.ts` — there's no self-registration path for `admin`.

## What's not yet implemented

Not yet opened in a real browser.

## Verified

- `npx tsc --noEmit` passes.
- `npx vite build` succeeds.
