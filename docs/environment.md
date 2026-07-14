# Environment Configuration

## Environments

`development`, `test`, `staging`, `production` — see `docs/deployment.md`.

## Required Variables (backend)

See `.env.example` at the repo root for the authoritative, up-to-date list. Summary:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | development / test / staging / production |
| `PORT` | backend HTTP port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | signs access tokens |
| `JWT_REFRESH_SECRET` | signs/hashes refresh tokens |
| `JWT_ACCESS_EXPIRY` | e.g. `15m` |
| `JWT_REFRESH_EXPIRY` | e.g. `30d` |
| `OTP_EXPIRY_MINUTES` | OTP validity window |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging credential |
| `SMS_PROVIDER_*` | OTP delivery provider credentials (registration/login OTP only — not used for service-completion PINs) |

Never commit real values — `.env` is gitignored; only `.env.example` (no secrets) is tracked.
