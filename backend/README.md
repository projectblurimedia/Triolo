# Backend

Node.js + Express + TypeScript API for the local services marketplace. Modular monolith — see `../.cloud/architecture.md`.

## Setup

```bash
npm install
cp .env.example .env   # fill in real values
npm run migrate         # applies database/migrations/*.sql
npm run dev             # starts on PORT (default 4000)
```

## Scripts

- `npm run dev` — start with hot reload (tsx)
- `npm run build` / `npm start` — compile and run production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm test` — Jest unit/integration tests
- `npm run migrate` — apply pending SQL migrations from `../database/migrations`

## Structure

```
src/
  app.ts, server.ts       Express app wiring and entrypoint
  config/                 env (incl. Cloudinary), database pool
  common/                 shared middleware (auth, validation, upload/multer), errors, utils, cloudinaryService
  modules/
    auth/                 registration, login, JWT/refresh, OTP
    workers/               Worker capability profile (skill/experience/portfolio)
    businesses/            Business capability profile (shop details/photos)
  types/                  Express request augmentation
scripts/
  migrate.ts              SQL migration runner
```

## Account Model

Every self-registered account is a plain `user` — not an exclusive role chosen at registration. Worker and Business are **optional capabilities** added afterward via `POST /workers/me/profile` / `POST /businesses/me/profile`, each creating a linked profile row with its own `verification_status`, independent of the account itself (which is `active` immediately). See `../.cloud/architecture.md`'s "Account Model" section for the full rationale.

## Auth Module (implemented)

Mobile OTP registration (name, mobile, **email, location** — GPS or manual)/login, JWT access tokens + rotating refresh tokens (selector/verifier split, hashed at rest), account status always `active` immediately (Worker/Business `pending_verification` moved to each capability profile's own status — see Account Model above). See `../docs/authentication.md` and `../docs/api.md`.

## Workers / Businesses Modules (implemented)

Add the Worker/Business capability to the current account. Both accept `multipart/form-data` (not JSON — the only such endpoints in this API) so they can carry image files: 0-6 images per submission, uploaded to Cloudinary via a shared `multer` → `cloudinaryService.uploadToCloudinary()` pipeline (`common/middleware/upload.ts`, `common/services/cloudinaryService.ts`). Requires your own `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` in `.env` — get these from your own Cloudinary account dashboard; uploads fail with a clear `CLOUDINARY_NOT_CONFIGURED` error if unset (the server still boots fine without them). See `../docs/api.md`.

## Testing

Current coverage is unit-level: 29 tests for Auth (OTP hashing, JWT/refresh-token mechanics, full `AuthService` business logic with a mocked repository), 5 for Workers and 4 for Businesses (service logic with a mocked repository and mocked Cloudinary upload) — 38 total, all passing. Repository-level integration tests and API tests against a real PostgreSQL instance are not yet written for any module — they need `TEST_DATABASE_URL` pointed at a real Postgres server, which wasn't available in the scaffolding environment. Set one up and add `*.integration.test.ts` files per `../docs/testing.md` before relying on this in production.
