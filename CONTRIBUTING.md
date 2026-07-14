# Contributing

## Workflow

```
main ← develop ← feature/<module>-<short-description>
```

1. Branch from `develop`: `feature/auth-otp-login`, `fix/booking-pin-retry-limit`, etc.
2. Commit with imperative, scoped messages: `feat(auth): add OTP verification endpoint`.
3. Open a PR into `develop`. Include: what changed, why, how it was tested.
4. Ensure the full test suite passes (unit, integration, API, regression) before requesting review.
5. Update related docs (`docs/*.md`, `.cloud/project-context.md`) in the same PR.
6. After review + approval, merge into `develop`. `develop` → `main` after staging validation.

## Code Standards

See `docs/coding-standards.md` and `.cloud/development-rules.md`.

## Module Convention

New backend feature? Create `backend/src/modules/<name>/` with `routes.ts`, `controller.ts`, `service.ts`, `repository.ts`, `validation.ts`, `dto.ts`, `interfaces.ts`, `tests/`. See `.cloud/architecture.md`.

## Definition of Done

A feature isn't done until: implemented, integrated (no isolated/standalone code), tested (unit/integration/API), regression-tested against existing features, and documented. See `.cloud/development-rules.md`.
