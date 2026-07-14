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
  config/                 env, database pool
  common/                 shared middleware, errors, utils
  modules/
    auth/                 registration, login, JWT/refresh, OTP
  types/                  Express request augmentation
scripts/
  migrate.ts              SQL migration runner
```

## Auth Module (implemented)

Mobile OTP registration/login for User/Worker/Business, JWT access tokens + rotating refresh tokens (selector/verifier split, hashed at rest), role-aware account status handling (`pending_verification` for Worker/Business until admin approval). See `../docs/authentication.md` and `../docs/api.md`.

## Testing

Current coverage is unit-level (OTP hashing, JWT/refresh-token mechanics, and the full `AuthService` business-logic surface with a mocked repository — 26 tests, all passing). Repository-level integration tests and API tests against a real PostgreSQL instance are not yet written — they need `TEST_DATABASE_URL` pointed at a real Postgres server, which wasn't available in the scaffolding environment. Set one up and add `*.integration.test.ts` files per `../docs/testing.md` before relying on this in production.
