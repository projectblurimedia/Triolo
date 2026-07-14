# Testing Strategy

See [[.cloud/testing-rules.md]] for the enforced workflow. This file tracks what's actually covered per module as it's built.

## Coverage Status

| Module | Unit | Integration | API | Notes |
|---|---|---|---|---|
| Auth | done (29 tests) | not written | not written | Unit tests cover OTP hashing, JWT/refresh-token mechanics, and full `AuthService` logic via a mocked repository, including preferred-language capture at registration and the `updateLanguage` flow. Integration/API tests need a real `TEST_DATABASE_URL` Postgres instance, which wasn't available when this was scaffolded — add them before production use. |

Update this table as each module's tests land — do not let it drift from `backend/src/modules/*/tests/`.

## Manual QA Checklists

Add a checklist per screen/flow here as the mobile app grows (e.g. registration, OTP entry, broadcast search, PIN entry, shopping list review). None yet — mobile app not scaffolded beyond baseline.

## Test Environment

- Backend tests run against a dedicated test PostgreSQL database (never dev/staging/production), reset between runs.
- Jest for unit/integration, Supertest for API-level route tests.
