# Deployment

## Environments

```
Development → Testing → Staging → Production
```

- **Development**: local machine, local/Dockerized PostgreSQL, `.env.development`.
- **Testing**: CI-run automated test suite against an ephemeral/test database.
- **Staging**: mirrors production configuration at smaller scale, used for manual QA before release.
- **Production**: live environment serving real users.

## Containerization

Docker for the backend (and PostgreSQL locally via `docker-compose`). `docker/` holds Dockerfiles and compose configuration once the backend is scaffolded enough to containerize meaningfully.

## CI/CD

GitHub Actions (`.github/workflows/`), one workflow per app since they have independent dependency trees:

- `backend-ci.yml`: on push/PR touching `backend/**` — install, lint, typecheck, unit test, build.
- `mobile-ci.yml`: on push/PR touching `mobile/**` — install, typecheck, `expo export --platform web` as a bundle sanity check.

Both currently run against `main`. Integration/API tests will be added to `backend-ci.yml` (with a Postgres service container) once those tests exist — see `docs/testing.md`. Staging/production deploy steps are not yet wired up; add them here when the deploy target (Section "Hosting (MVP)") is decided.

## Environment Variables

Managed via `.env` files, never committed. `.env.example` at the repo root documents required keys (DB connection, JWT secrets, FCM credentials, etc.) without real values.

## Hosting (MVP)

Not yet finalized — VPS vs. AWS deferred until the backend/mobile MVP nears completion, per low-infra-cost priority for the Telugu-states launch. Revisit in `.cloud/project-context.md` "Open Questions" when decided.

## Database Backups

Automated daily backups required once staging/production exist; restore procedure to be documented here before first production deploy.

## Monitoring & Logging

- Application logs: authentication events, API errors, booking/order transitions, verification attempts, admin actions.
- Crash reporting and basic performance monitoring to be wired in before production launch (tool TBD — revisit when this phase starts).
