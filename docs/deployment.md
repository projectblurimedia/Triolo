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

## CI/CD (planned)

GitHub Actions pipeline (`.github/workflows/`):
1. Install deps, lint, typecheck.
2. Run unit + integration + API tests.
3. Build.
4. On merge to `main`: deploy to staging automatically; production deploy is a manual/approved step.

## Environment Variables

Managed via `.env` files, never committed. `.env.example` at the repo root documents required keys (DB connection, JWT secrets, FCM credentials, etc.) without real values.

## Hosting (MVP)

Not yet finalized — VPS vs. AWS deferred until the backend/mobile MVP nears completion, per low-infra-cost priority for the Telugu-states launch. Revisit in `.cloud/project-context.md` "Open Questions" when decided.

## Database Backups

Automated daily backups required once staging/production exist; restore procedure to be documented here before first production deploy.

## Monitoring & Logging

- Application logs: authentication events, API errors, booking/order transitions, verification attempts, admin actions.
- Crash reporting and basic performance monitoring to be wired in before production launch (tool TBD — revisit when this phase starts).
