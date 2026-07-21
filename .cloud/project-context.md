# Project Context (Living Memory)

Update this file whenever product state changes: completed modules, pending work, schema, APIs, decisions. This is the "what" — see [[cloud.md]] for the "how".

## Product Vision

Local-services marketplace for India. MVP launches in Telugu-speaking states, then expands nationwide. Three account types — **User**, **Worker**, **Business** — plus an internal **Admin** system. Full detail: `docs/product-specification.md`.

## MVP Scope Snapshot

- Auth: mobile OTP + JWT. Every self-registered account is a plain `user` (captures full name, mobile, email, and location at registration) — Worker and Business are **optional capabilities** added afterward (during onboarding or later, from Home's menu), not an exclusive role chosen at signup. See "Account Model" below.
- Worker discovery: broadcast (expanding radius) + manual filtered search.
- Worker booking: PIN-verified arrival, full status pipeline through to rated/closed.
- Business ordering: shopping-list model, per-item availability review, PIN-verified pickup/delivery.
- Admin: verification queues, user/worker/business management, complaints, warnings, suspension/blocking, announcements, audit logs.
- Location: **full GPS coordinates** now captured (registration, Worker service location, Business shop location) — see "Key Technical Decisions" below; this overrides an earlier "no live GPS in MVP" decision. Search itself is still area/village-town-based for now; the captured coordinates are there for radius-based search to build on later.
- Language: core architectural requirement, not a nice-to-have — English + Telugu from MVP, account-level `preferred_language` synced with device storage, first-launch language picker, registration-time language capture, settings-time backend sync. Full model in `docs/localization.md`. No feature ships without both languages.
- No SMS OTP for service completion anywhere — always backend-generated single-use in-app PINs.

## Account Model

Every self-registered account is a plain `user` — not one of an exclusive set of roles chosen at registration. **Worker and Business are optional capabilities**: from Home's menu ("Become a Worker" / "Become a Business"), a `user` account can add a Worker profile (skill category, experience, service location, portfolio photos) and/or a Business profile (shop name/category, shop location, shop photos). Each capability is its own row (`worker_profiles`/`business_profiles`, owned by the new `workers`/`businesses` backend modules) with its own generated id (worker_id / business_id) and its own `verification_status` (`pending_verification` → `verified`/`rejected`) — independent of `accounts.status`, which is `active` immediately for every self-registered account. `business_staff` (an employee added by a business owner) and `admin` are unrelated to this model — provisioned differently, never self-registered.

This superseded an earlier design (role chosen once at registration, Worker/Business accounts starting `pending_verification`) — `WelcomeScreen`'s three role-selection cards were removed, `RegisterScreen` no longer takes a `role` param at all.

## Completed Modules

- **Auth** (`backend/src/modules/auth/`): registration OTP request/verify (now captures `email` and location — GPS lat/lng + reverse-geocoded address, or a manual address — alongside full name/mobile; no `role` field, always creates `role: "user"`), login OTP request/verify, JWT access tokens, rotating refresh tokens (selector/verifier split, hashed at rest), `GET /me`, `PATCH /me/language`, account status always `active` immediately on registration, account-level `preferred_language` (enum `app_language`, captured at registration via the OTP record, updatable post-login). 29 unit tests passing (OTP hashing, JWT/refresh mechanics, full service business logic via mocked repository). Repository/API-level integration tests against a real Postgres instance are **not yet written** — none was available in the scaffolding environment; add them before production use (see `docs/testing.md`).
- **Workers** (`backend/src/modules/workers/`): `POST /workers/me/profile` (multipart — skill category enum, experience years, location, 0-6 portfolio photos uploaded to Cloudinary), `GET /workers/me/profile`. One profile per account (409 if one already exists). 5 unit tests passing (mocked repository + mocked Cloudinary upload).
- **Businesses** (`backend/src/modules/businesses/`): mirrors Workers exactly, shop-shaped — `POST /businesses/me/profile` (shop name, shop category enum, location, 0-6 shop photos), `GET /businesses/me/profile`. 4 unit tests passing.
- **Image uploads**: shared `multer` middleware (`backend/src/common/middleware/upload.ts`, disk-temp storage, images only, 5MB/file) + `backend/src/common/services/cloudinaryService.ts` (`uploadToCloudinary`, always cleans up the local temp file). Configured via `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` env vars — **the user must supply their own Cloudinary account credentials into their own untracked `backend/.env`**; nothing is hardcoded or shared from elsewhere. If unset, upload attempts fail with a clear `CLOUDINARY_NOT_CONFIGURED` error rather than the server failing to boot.
- **Mobile baseline** (`mobile/`): Expo + TypeScript app scaffolded with the full architecture.md folder structure (screens/components/navigation/services/hooks/state/theme/localization/constants). Working registration + login flow wired end-to-end against the Auth module's API (name/mobile/email/location → OTP request → OTP verify → persisted session), access-token auto-refresh on 401. Post-login app shell: 4-tab bottom navigator (Home, Services, Bazaar, Profile — see `.cloud/architecture.md` for the pattern), brand gradient header (`#0055D3` → `#1D76FA`, constant) with a circular icon-only back button on Auth screens and a decorative logo icon + notification/menu actions on Home, light/dark theme (`theme/useThemeColors`, `#F9FCFF`/`#0c0f14` background/text, brand colors constant), Poppins as the app-wide font (Google Sans isn't publicly licensed for third-party use). Home also has a search bar + filter chips (Services/Shops/Top Rated/Nearby, UI-only). Services and Bazaar are placeholders pending the Worker/Business search/shopping-list modules; Profile now holds the account card/language switcher/theme switcher/logout moved out of Home. Home's header menu icon opens a right-side drawer (`HomeMenuModal`) with "Become a Worker" / "Become a Business" entries that open real forms (`WorkerProfileModal`/`BusinessProfileModal` — category chips, `LocationPicker`, `ImagePickerField`, submit) wired to the new backend endpoints, plus an App Settings section (theme + logout). `WelcomeScreen` is a single "Create Account" CTA (no role picker — see Account Model above); logout shows a dedicated full-screen `LogoutOverlay` for the request's duration instead of an abrupt, feedback-free stack swap; all loading states across the app share one `LoadingIndicator` motif. Typechecks clean and bundles successfully (`expo export --platform web`); backend smoke-tested end-to-end against a live local server (health check, registration OTP request with the new fields, validation rejection, auth-gated Workers/Businesses routes). Not yet run on a real device/emulator. Telugu strings (`mobile/src/localization/te.json`) are machine-translated scaffolding — need native-speaker review before shipping.
- **Localization** (cross-cutting, not a standalone module — see `docs/localization.md`): first-launch language picker gating the app until confirmed, language re-selectable at registration (sent as part of the registration request), Settings-screen switch that updates UI immediately and syncs to the backend account, account language overriding device state on login, and client-side `error.code` → localized-string mapping (`mobile/src/localization/errorMessages.ts`) so no raw API message is ever shown to a user.

## Pending Modules (build order, current plan)

1. ~~Auth~~ — done (localization support included)
2. ~~Workers, Businesses (profile-creation slice)~~ — done (capability profiles + image upload; search/booking/order-flow pieces below are still pending)
3. Worker module remainder (availability, search, booking, PIN verification, ratings)
4. Business module remainder (staff, shopping list, order flow, PIN verification)
5. Notifications (FCM)
6. Admin module (including reviewing `worker_profiles`/`business_profiles.verification_status`)

Localization is no longer a separate future module — it's a cross-cutting requirement applied to every module above as it's built (English + Telugu keys ship in the same change as any new user-visible text; see `.cloud/development-rules.md` Definition of Done).

## Database Schema

Implemented (`database/migrations/`): `accounts` (`preferred_language app_language`, `email`, `latitude`/`longitude`/`location_address`), `otp_verifications` (nullable `full_name`/`email`/`latitude`/`longitude`/`location_address`/`preferred_language` for the registration flow — `role` column kept but no longer populated), `refresh_tokens` (selector/verifier split), `worker_profiles` (skill_category enum, experience_years, location, portfolio_photo_urls[], verification_status enum), `business_profiles` (shop_name, shop_category enum, location, shop_photo_urls[], verification_status enum, shares the `profile_verification_status` enum with worker_profiles). Everything else is still just the outline in `docs/database.md` §"Planned Tables".

## APIs

Implemented under `/api/v1/auth`: `register/request-otp` (fullName, mobileNumber, email, latitude?, longitude?, locationAddress, preferredLanguage?), `register/verify-otp`, `login/request-otp`, `login/verify-otp`, `refresh`, `logout`, `me`, `PATCH me/language`. Implemented under `/api/v1/workers`: `POST me/profile` (multipart), `GET me/profile`. Implemented under `/api/v1/businesses`: same shape, shop-flavored. Full request/response detail in `docs/api.md`.

## Key Technical Decisions

- Modular monolith, feature-based backend modules (routes/controller/service/repository/validation/dto/tests each).
- PostgreSQL as default DB.
- PIN verification (not SMS OTP) for all service-completion steps; PINs are backend-generated, single-use, per-booking/per-order.
- **Full GPS coordinates captured** (registration location, Worker service location, Business shop location) — a confirmed, deliberate override of an earlier "no live GPS in MVP, area-based only" decision. Search itself remains area/village-town-based for now; the coordinates are stored for radius-based search to build on later without another migration.
- Account model: every self-registered account is `role: "user"`; Worker/Business are additive capabilities with their own tables/verification status, not an exclusive role — see "Account Model" above.
- Image uploads: backend-mediated Cloudinary (multer → temp disk → Cloudinary → cleanup), never exposing the API secret to the client. Each user supplies their own Cloudinary credentials via env vars.
- Business staff share one dashboard with real-time sync; permission-scoped actions.
- Order/booking cancellation locks once business review / worker-PIN-verification begins; only business/admin can cancel past that point.
- Localization: language is a first-class account attribute (`accounts.preferred_language`), not a purely client-side setting; client never displays raw API error messages, only `error.code` mapped to a localized string.

## Open Questions / Not Yet Decided

- Payment method for MVP: cash / external UPI assumed, no in-app payment gateway yet.
- Exact list of supported languages beyond English/Telugu.
- Hosting target (VPS vs AWS) — deferred until deployment phase.
- Whether Worker/Business capability can be added more than once per account in different categories (currently one profile per account, enforced by a unique `account_id` constraint on each table).
