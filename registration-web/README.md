# Registration Web

React + Vite + TypeScript — the public Worker/Shop registration site. Does exactly two things: `/worker` and `/business`. No admin anything here — see `../admin-web` for that, a completely separate site/deployment (split from an earlier combined `web/` app per follow-up feedback).

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
  pages/          LandingPage, RegisterWorkerPage, RegisterBusinessPage
  components/     PageHeader, PhoneAuthFlow, CategoryChips, LocationField, PhotoUpload,
                  VerificationBadge, LoadingSpinner
  services/       apiClient, authService, workersService, businessesService, errorMessages
  state/          authStore (zustand, localStorage-persisted)
  theme/          brand color tokens + global.css
  router.tsx, main.tsx
```

## What's implemented

`/worker`, `/business` — phone → OTP (login if the number already has an account, a short details step + registration OTP if it's brand new) → if that capability already exists, a read-only status view; otherwise the registration form (same fields/category-chip pattern as `partner-app`'s screens) → submit → pending-verification confirmation.

## What's not yet implemented

No native locale-aware reverse-geocoding (GPS-detected location shows raw coordinates). English only. Not yet opened in a real browser.

## Verified

- `npx tsc --noEmit` passes.
- `npx vite build` succeeds.
