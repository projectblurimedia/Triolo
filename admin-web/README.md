# Admin Web

React + Vite + TypeScript — the Admin verification dashboard. A dedicated site, not sharing a deployment with the public registration forms — see `../registration-web` for those (split from an earlier combined `web/` app per follow-up feedback).

## Setup

```bash
npm install
npm run dev         # Vite dev server — bound to the LAN interface (server.host in vite.config.ts),
                    # so it's reachable from another device on the same Wi-Fi, not just this machine
npm run build        # typecheck + production build
npm run typecheck
```

`npm run dev` prints both a `Local` and a `Network` URL — use the `Network` one (`http://<your-LAN-IP>:5173`) to open the site from a phone/another device. Expects the backend reachable at the same LAN IP the mobile apps use (`src/services/apiClient.ts` — keep it in sync with `user-app`/`partner-app`'s `constants/config.ts` if that IP changes).

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
