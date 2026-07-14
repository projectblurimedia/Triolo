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
- Language: UI must support switching to Telugu (MVP requirement) alongside English.
- No SMS OTP for service completion anywhere — always backend-generated single-use in-app PINs.

## Completed Modules

- **Auth** (`backend/src/modules/auth/`): registration OTP request/verify, login OTP request/verify, JWT access tokens, rotating refresh tokens (selector/verifier split, hashed at rest), `GET /me`, role-aware account status (`active` for User, `pending_verification` for Worker/Business). 26 unit tests passing (OTP hashing, JWT/refresh mechanics, full service business logic via mocked repository). Repository/API-level integration tests against a real Postgres instance are **not yet written** — none was available in the scaffolding environment; add them before production use (see `docs/testing.md`).
- **Mobile baseline** (`mobile/`): Expo + TypeScript app scaffolded with the full architecture.md folder structure (screens/components/navigation/services/hooks/state/theme/localization/constants). Working registration + login flow wired end-to-end against the Auth module's API (role select → OTP request → OTP verify → persisted session → home screen), access-token auto-refresh on 401, English/Telugu language switch persisted via AsyncStorage. Typechecks clean and bundles successfully (`expo export --platform web`, 562 modules). Not yet run on a real device/emulator or against a live backend+DB. Telugu strings (`mobile/src/localization/te.json`) are machine-translated scaffolding — need native-speaker review before shipping.

## Pending Modules (build order, current plan)

1. ~~Auth~~ — done
2. User module — **next up**
3. Worker module (profile, availability, search, booking, PIN verification, ratings)
4. Business module (profile, staff, shopping list, order flow, PIN verification)
5. Notifications (FCM)
6. Admin module
7. Localization (English/Telugu)

## Database Schema

Implemented (`database/migrations/`): `accounts`, `otp_verifications` (includes nullable `full_name`/`role` for the registration flow), `refresh_tokens` (selector/verifier split). Everything else is still just the outline in `docs/database.md` §"Planned Tables".

## APIs

Implemented under `/api/v1/auth`: `register/request-otp`, `register/verify-otp`, `login/request-otp`, `login/verify-otp`, `refresh`, `logout`, `me`. Full request/response detail in `docs/api.md`.

## Key Technical Decisions

- Modular monolith, feature-based backend modules (routes/controller/service/repository/validation/dto/tests each).
- PostgreSQL as default DB.
- PIN verification (not SMS OTP) for all service-completion steps; PINs are backend-generated, single-use, per-booking/per-order.
- No live GPS in MVP; area-based (village/town) search only, architected to add GPS later.
- Business staff share one dashboard with real-time sync; permission-scoped actions.
- Order/booking cancellation locks once business review / worker-PIN-verification begins; only business/admin can cancel past that point.

## Open Questions / Not Yet Decided

- Payment method for MVP: cash / external UPI assumed, no in-app payment gateway yet.
- Exact list of supported languages beyond English/Telugu.
- Hosting target (VPS vs AWS) — deferred until deployment phase.
