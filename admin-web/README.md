# Admin Web

React + Vite + TypeScript — the Triolo admin console. Its own site, separate from the public registration forms (`../registration-web`).

## Setup

```bash
npm install
npm run dev          # http://localhost:5173 (also on the LAN, see vite.config.ts)
npm run build        # typecheck + production build
```

It talks to the **production API** (`https://triolo-backend.vercel.app/api/v1`) by default — admin actions are real. To use a local backend, create `.env.local` with `VITE_API_URL=http://<your-LAN-IP>:4000/api/v1`.

Admin accounts are created with `backend/scripts/seedAdmin.ts` — there's no self-registration. Every `/admin/*` API call is checked server-side (`authorize('admin')`).

## Look and feel

The mobile apps' design language: brand-blue gradient, Poppins, frosted-glass panels over soft colour, a sidebar like the apps' drawer menu (gradient icon squares, live counts on items needing attention), glass confirmation popups over a dimmed page, toasts. Light and dark follow the system; the layout works down to phone width (the sidebar becomes a drawer).

## Sections

- **Dashboard** — numbers for every area, and what needs attention (profiles to review, bookings in progress, new orders).
- **All Accounts** — search by name, mobile or email; filter active / suspended / banned. An account page shows everything about the person: details, worker / shop / job post profiles, and all their bookings, orders and problem posts. **Suspend** (1–90 days), **Ban**, **Reactivate**, **Delete profiles** (removes worker, shop and job post profiles with photos and bans the account; history is kept). Each asks first, takes an optional reason, and the person is told.
- **Services**
  - **Workers** — review (Approve / Reject), search, ratings, photos, the owner's account and moderation.
  - **Quick Book** / **Problem trips** — every booking with its full timeline, both people (with call links), the workers it was offered to and what they did, rating and review. **Cancel booking** at any unfinished step (both sides are told, with the reason).
  - **Problem Jobs** — posts waiting for a worker, in progress, completed, closed. **Close post** for a waiting one.
- **Business** — **Shops** (review like workers) and **Shop Orders** (the list with packed / not available items and prices, the bill, timeline, rating; **Cancel order**).
- **Hire Staff** — **Job Posts**: details, **Hide / Show**, **Delete**.

## Structure

```
src/
  components/  Layout (sidebar + Topbar), ui (badges, rows, search, segments, pager, photos, toasts),
               ConfirmModal, AccountActions, RequireAdmin
  pages/       LoginPage, DashboardPage, ListPages (every list), DetailPages (every detail page)
  services/    apiClient, adminApi (typed /admin endpoints), authService, errorMessages
  hooks/       useApi
  state/       authStore, toastStore
  utils/       format (labels, dates, money, status tones)
  theme/       global.css (tokens, glass, layout, components; light + dark)
```

## Verified

- `npm run build` (typecheck + Vite build) passes.
- The API behind every page was checked live end-to-end (see docs/changelog.md). The pages themselves have not been clicked through in a browser from here.
