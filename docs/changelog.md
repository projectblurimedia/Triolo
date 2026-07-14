# Changelog

All notable changes to this project are documented here. Format: date, module, summary.

## Unreleased

- Project scaffolded: documentation set (`docs/`), AI/engineering instructions (`.cloud/`), folder structure, initial repo setup.
- **Auth module** (backend): mobile OTP registration/login for User/Worker/Business, JWT access tokens, rotating refresh tokens, `GET /me`. See `docs/api.md`, `docs/authentication.md`, `docs/database.md`. 26 unit tests passing; integration/API tests pending a real Postgres test instance.
- **Mobile baseline** (`mobile/`): Expo + TypeScript scaffold with the full feature-based folder structure, working registration/login flow against the Auth module, English/Telugu language switching, and access-token refresh handling. See `mobile/README.md`.
