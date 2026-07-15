# Project Context (Living Memory)

Update this file whenever product state changes: completed modules, pending work, schema, APIs, decisions. This is the "what" — see [[cloud.md]] for the "how".

## Product Vision

Local-services marketplace for India. MVP launches in Telugu-speaking states, then expands nationwide. Three account types — **User**, **Worker**, **Business** — plus an internal **Admin** system. Full detail: `docs/product-specification.md`.

## MVP Scope Snapshot

- Auth: mobile OTP + JWT, single registration flow branching into User / Worker (2-stage) / Business (2-stage).
- Worker discovery: broadcast (expanding radius) + manual filtered search.
- Worker booking: PIN-verified arrival, full status pipeline through to rated/closed.
- Business ordering: shopping-list model, per-item availability review, PIN-verified pickup/delivery.
- Admin: verification queues, user/worker/business management, complaints, warnings, suspension/blocking, announcements, audit logs.
- Location: village/town selection, no live GPS (designed to add later).
- Language: core architectural requirement, not a nice-to-have — English + Telugu from MVP, account-level `preferred_language` synced with device storage, first-launch language picker, registration-time language capture, settings-time backend sync. Full model in `docs/localization.md`. No feature ships without both languages.
- No SMS OTP for service completion anywhere — always backend-generated single-use in-app PINs.

## Completed Modules

- **Auth** (`backend/src/modules/auth/`): registration OTP request/verify, login OTP request/verify, JWT access tokens, rotating refresh tokens (selector/verifier split, hashed at rest), `GET /me`, `PATCH /me/language`, role-aware account status (`active` for User, `pending_verification` for Worker/Business), account-level `preferred_language` (enum `app_language`, captured at registration via the OTP record, updatable post-login). 29 unit tests passing (OTP hashing, JWT/refresh mechanics, full service business logic via mocked repository). Repository/API-level integration tests against a real Postgres instance are **not yet written** — none was available in the scaffolding environment; add them before production use (see `docs/testing.md`).
- **Mobile baseline** (`mobile/`): Expo + TypeScript app scaffolded with the full architecture.md folder structure (screens/components/navigation/services/hooks/state/theme/localization/constants). Working registration + login flow wired end-to-end against the Auth module's API (role select → OTP request → OTP verify → persisted session), access-token auto-refresh on 401. Post-login app shell: 4-tab bottom navigator (Home, Search, Bazaar, Profile — see `.cloud/architecture.md` for the pattern), brand gradient header (`#0055D3` → `#1D76FA`, constant) with a circular icon-only back button on Auth screens and a decorative logo icon + notification/message/menu actions on Home, light/dark theme (`theme/useThemeColors`, `#ECEDEE`/`#0c0f14` background/text, brand colors constant), Poppins as the app-wide font (Google Sans isn't publicly licensed for third-party use). Search and Bazaar are placeholders pending the Worker/Business modules; Profile now holds the account card/language switcher/theme switcher/logout moved out of Home. Typechecks clean and bundles successfully (`expo export --platform web`). Not yet run on a real device/emulator or against a live backend+DB. Telugu strings (`mobile/src/localization/te.json`) are machine-translated scaffolding — need native-speaker review before shipping.
- **Localization** (cross-cutting, not a standalone module — see `docs/localization.md`): first-launch language picker gating the app until confirmed, language re-selectable at registration (sent as part of the registration request), Settings-screen switch that updates UI immediately and syncs to the backend account, account language overriding device state on login, and client-side `error.code` → localized-string mapping (`mobile/src/localization/errorMessages.ts`) so no raw API message is ever shown to a user.

## Pending Modules (build order, current plan)

1. ~~Auth~~ — done (localization support included)
2. User module — **next up**
3. Worker module (profile, availability, search, booking, PIN verification, ratings)
4. Business module (profile, staff, shopping list, order flow, PIN verification)
5. Notifications (FCM)
6. Admin module

Localization is no longer a separate future module — it's a cross-cutting requirement applied to every module above as it's built (English + Telugu keys ship in the same change as any new user-visible text; see `.cloud/development-rules.md` Definition of Done).

## Database Schema

Implemented (`database/migrations/`): `accounts` (includes `preferred_language app_language`), `otp_verifications` (includes nullable `full_name`/`role`/`preferred_language` for the registration flow), `refresh_tokens` (selector/verifier split). Everything else is still just the outline in `docs/database.md` §"Planned Tables".

## APIs

Implemented under `/api/v1/auth`: `register/request-otp`, `register/verify-otp`, `login/request-otp`, `login/verify-otp`, `refresh`, `logout`, `me`, `PATCH me/language`. Full request/response detail in `docs/api.md`.

## Key Technical Decisions

- Modular monolith, feature-based backend modules (routes/controller/service/repository/validation/dto/tests each).
- PostgreSQL as default DB.
- PIN verification (not SMS OTP) for all service-completion steps; PINs are backend-generated, single-use, per-booking/per-order.
- No live GPS in MVP; area-based (village/town) search only, architected to add GPS later.
- Business staff share one dashboard with real-time sync; permission-scoped actions.
- Order/booking cancellation locks once business review / worker-PIN-verification begins; only business/admin can cancel past that point.
- Localization: language is a first-class account attribute (`accounts.preferred_language`), not a purely client-side setting; client never displays raw API error messages, only `error.code` mapped to a localized string.

## Open Questions / Not Yet Decided

- Payment method for MVP: cash / external UPI assumed, no in-app payment gateway yet.
- Exact list of supported languages beyond English/Telugu.
- Hosting target (VPS vs AWS) — deferred until deployment phase.
