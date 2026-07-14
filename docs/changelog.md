# Changelog

All notable changes to this project are documented here. Format: date, module, summary.

## Unreleased

- Project scaffolded: documentation set (`docs/`), AI/engineering instructions (`.cloud/`), folder structure, initial repo setup.
- **Auth module** (backend): mobile OTP registration/login for User/Worker/Business, JWT access tokens, rotating refresh tokens, `GET /me`. See `docs/api.md`, `docs/authentication.md`, `docs/database.md`. 26 unit tests passing; integration/API tests pending a real Postgres test instance.
- **Mobile baseline** (`mobile/`): Expo + TypeScript scaffold with the full feature-based folder structure, working registration/login flow against the Auth module, English/Telugu language switching, and access-token refresh handling. See `mobile/README.md`.
- **Localization made a core architectural requirement** (backend + mobile): `docs/localization.md` added as the canonical spec. Backend: `accounts.preferred_language` (enum, extensible) added and threaded through registration (captured via the OTP record) and a new `PATCH /auth/me/language` endpoint; 3 new unit tests (29 total). Mobile: first-launch language picker gating the app, language re-selectable at registration, Settings-screen language switch now syncs to the backend account, account language overrides device state on login, and all client-shown error messages now resolve from `error.code` via a localized mapping instead of the raw (always-English) API `message`. See `docs/localization.md`, `mobile/README.md`, `docs/api.md`.
