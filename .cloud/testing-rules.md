# Testing Rules

## Required Coverage Per Feature

- Unit tests — services, validators, utilities in isolation.
- Integration tests — module's repository + service against a real (test) PostgreSQL instance.
- API tests — routes end-to-end (request in, response/status out), including auth/authorization checks.
- Validation tests — reject bad input, boundary conditions.
- Error handling tests — verify graceful failure and correct error shape.
- Regression tests — full existing suite must still pass after any new feature lands.

## Workflow Per Feature

1. Write/extend tests for the new feature.
2. Implement until it passes.
3. Integrate into the existing app.
4. Run the **full** test suite (not just the new feature's tests).
5. Fix any regression before marking the feature done.

No feature merges if it breaks existing functionality or leaves the suite red.

## Tooling (backend)

- Jest (or Vitest) for unit/integration.
- Supertest for API tests against Express routes.
- A dedicated test database (never the dev/staging DB) for integration tests, reset between runs.

## Tooling (mobile)

- Jest + React Native Testing Library for component/hook tests.
- Manual QA checklist per screen before marking a screen done (documented in `docs/testing.md`).

## Security-sensitive Areas Requiring Extra Test Attention

- OTP/PIN generation and verification (single-use enforcement, retry limits, expiry).
- Role-based authorization boundaries (a Worker token must never succeed on Business/Admin-only routes, etc.).
- Order/booking cancellation-rule edge cases (attempting to cancel after the lock point must fail cleanly).
