# Ads Web — Triolo Ads

React + Vite + TypeScript — the website where **businesses book their own ads** for the Triolo apps. Its own site, separate from the admin console (`../admin-web`) and the registration forms (`../registration-web`). Same look as admin-web (its theme, layout and map picker were copied from there — keep them in sync by hand).

## Setup

```bash
npm install
npm run dev          # http://localhost:5175 (also on the LAN)
npm run build        # typecheck + production build
```

It talks to the **production API** (`https://triolo-backend.vercel.app/api/v1`) by default. To use a local backend, create `.env.local` with `VITE_API_URL=http://<your-LAN-IP>:4000/api/v1`.

## What a business does

1. **Signs in** with a mobile number + OTP — the same Triolo account as the apps. A number with no account is asked for a name and gets one.
2. **Books an ad:** business name and phone, one picture or one video (≤30 s, ≤100 MB; vertical or horizontal is worked out from its shape), how long a picture shows (default 15 s), optional words and link, the place (current location or a map pin — shown within 5 km), the plan (1 / 3 / 7 / 30 days, at the admin's prices) and a start date (today or later). The file is only previewed until **Send for Review**, then uploaded straight to Cloudinary in retried 6 MB pieces with a progress bar.
3. **Waits for review.** The ad is never shown in the apps until the admin approves it in admin-web (Ads → Waiting for review). A rejected ad shows the admin's reason; the business changes it and sends it again. An ad waiting for review or rejected can be withdrawn (its media is deleted). Once approved it can't be changed.
4. **Watches it:** status, dates, views and opens.

**Payment is "coming soon":** a self-booked ad is saved with `paymentMethod: 'pending'`. After approving, the admin takes the payment by cash / UPI and records it with Edit. Revenue totals count only approved, paid ads.

API: `/api/v1/ads/self/*` (any signed-in account; see `docs/api.md`).
