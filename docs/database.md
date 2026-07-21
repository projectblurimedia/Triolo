# Database Design

PostgreSQL, UTF-8 encoding (Postgres default). All free-text columns (names, addresses, shopping list items, reviews, business names, worker descriptions) accept full Unicode/Telugu input unmodified — never constrained to ASCII. Normalized schema; foreign keys enforce relationships; index columns used in frequent filters (mobile_number, profession, business_category, service_area, status fields). See `docs/localization.md` for the language-related data model (account language preference, future category/notification/announcement translation pattern).

## Account Model

Every self-registered account is a plain `user` — not one of an exclusive set of roles picked at registration. Worker and Business are **additive capabilities**: a `user` account can optionally gain a `worker_profiles` row and/or a `business_profiles` row (via `POST /api/v1/workers/me/profile` / `POST /api/v1/businesses/me/profile`), each with its own generated `id` serving as that capability's distinct identifier (worker_id / business_id). The base account is `active` immediately; each capability profile carries its own `verification_status` (`pending_verification` → `verified`/`rejected`) gating whether it's trustworthy to surface in search/booking, independent of the account itself. `business_staff` (an employee added by a business owner) and `admin` are unrelated to this — assigned differently, never self-registered.

## Entity Overview

| Entity | Owned by module | Notes |
|---|---|---|
| accounts | auth | Shared identity row for every account — always `role = user` for self-registrations |
| otp_verifications | auth | Short-lived OTP codes for registration/login |
| refresh_tokens | auth | JWT refresh token store, revocable |
| worker_profiles | workers | Optional Worker capability a `user` account can add |
| business_profiles | businesses | Optional Business capability a `user` account can add |
| business_staff | staff | Staff membership + permissions, linked to a business_profile |
| bookings | booking | Worker booking lifecycle |
| booking_pins | booking | Single-use arrival PIN per booking |
| orders | orders | Business shopping-list order lifecycle |
| order_items | orders | Line items with availability status |
| order_pins | orders | Pickup/delivery PINs per order |
| notifications | notifications | Delivery record per recipient |
| ratings_reviews | ratings/reviews | Polymorphic: worker or business target |
| verification_requests | verification | Worker/Business admin verification queue |
| audit_logs | audit-logs | Immutable admin action log |

## Core Tables (Auth — current implementation target)

### accounts
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| full_name | text | |
| mobile_number | varchar(15) UNIQUE | indexed |
| email | text nullable | indexed; required by the API for new registrations, nullable at the DB level since a migration can't backfill rows that predate it |
| role | enum(user, worker, business_owner, business_staff, admin) | always `user` for self-registered accounts as of the account-model change above; other values are provisioned separately (not self-registerable) |
| status | enum(active, pending_verification, suspended, blocked) | `active` immediately on registration — the old worker/business `pending_verification` gate moved to each capability profile's own `verification_status` |
| preferred_language | enum `app_language` (en, te, ...) | authoritative language for this account; see `docs/localization.md`. Enum so adding a language later is `ALTER TYPE ... ADD VALUE`, no migration of existing rows. |
| latitude | double precision nullable | GPS coordinate captured at registration (auto-detect or manual); null if the user only entered a manual address with no GPS fix |
| longitude | double precision nullable | see `latitude` |
| location_address | text nullable | human-readable address (reverse-geocoded from GPS, or manually typed) — required by the API for new registrations |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### otp_verifications
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| mobile_number | varchar(15) | indexed |
| otp_hash | text | hashed, never stored plain |
| purpose | enum(registration, login) | |
| full_name | text nullable | registration only |
| role | account_role nullable | no longer populated for registration (always `user`) — column kept, unused going forward |
| email | text nullable | registration only |
| latitude | double precision nullable | registration only |
| longitude | double precision nullable | registration only |
| location_address | text nullable | registration only |
| preferred_language | app_language nullable | registration only — carries the app's active language at registration time so the account is created with it already set |
| expires_at | timestamptz | |
| consumed_at | timestamptz nullable | single-use |
| attempt_count | int | rate-limit guard |
| created_at | timestamptz | |

### refresh_tokens
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts.id | |
| token_hash | text | hashed |
| expires_at | timestamptz | |
| revoked_at | timestamptz nullable | |
| created_at | timestamptz | |

### worker_profiles (Workers module — implemented)
| column | type | notes |
|---|---|---|
| id | uuid PK | serves as the worker's distinct identifier (worker_id) |
| account_id | uuid FK → accounts.id, UNIQUE | one worker profile per account |
| skill_categories | enum `worker_skill_category`[] | a worker can have multiple skills; GIN-indexed for containment search. Stable codes, not translated text — see `docs/localization.md`'s reference-data rule |
| other_skill_description | text nullable | free-text description, required (validated at the API layer) when `skill_categories` includes `other` |
| experience_years | int | |
| latitude / longitude | double precision nullable | service location, separate from the account's own registration location |
| location_address | text nullable | |
| portfolio_photo_urls | text[] | Cloudinary-hosted URLs, uploaded via `POST /api/v1/workers/me/profile` (multipart) |
| verification_status | enum `profile_verification_status` (pending_verification, verified, rejected) | admin review gate for this capability specifically, independent of `accounts.status` |
| created_at / updated_at | timestamptz | |

### business_profiles (Businesses module — implemented)
| column | type | notes |
|---|---|---|
| id | uuid PK | serves as the business's distinct identifier (business_id) |
| account_id | uuid FK → accounts.id, UNIQUE | one business profile per account |
| shop_name | text | |
| shop_categories | enum `business_shop_category`[] | a shop can belong to multiple categories; GIN-indexed for containment search. Same stable-code pattern as `skill_categories` |
| other_category_description | text nullable | free-text description, required (validated at the API layer) when `shop_categories` includes `other` |
| latitude / longitude | double precision nullable | shop location |
| location_address | text nullable | |
| shop_photo_urls | text[] | Cloudinary-hosted URLs, uploaded via `POST /api/v1/businesses/me/profile` (multipart) |
| delivery_available | boolean | whether the shop offers delivery |
| delivery_price_per_km | double precision nullable | required (validated at the API layer) when `delivery_available` is true |
| verification_status | enum `profile_verification_status` | shared enum with `worker_profiles` |
| created_at / updated_at | timestamptz | |

## Planned Tables (subsequent modules — outline only, refine when implemented)

- **business_staff**: business_profile_id FK, account_id FK, permissions jsonb.
- **bookings**: user_id FK, worker_id FK, status enum (pipeline per product-specification §2), requested_at, accepted_at, completed_at.
- **booking_pins**: booking_id FK, pin_hash, single_use, verified_at nullable, attempt_count.
- **orders**: user_id FK, business_profile_id FK, status enum (pipeline per product-specification §3), fulfillment_type enum(pickup, delivery).
- **order_items**: order_id FK, item_name, quantity, availability_status enum(available, partial, out_of_stock).
- **order_pins**: order_id FK, pin_type enum(pickup, delivery), pin_hash, verified_at nullable.
- **verification_requests**: account_id FK, submitted_documents jsonb, status enum(pending, approved, rejected, resubmission_requested), reviewed_by (admin account_id), reason.
- **audit_logs**: admin_account_id FK, action, target_type, target_id, reason, created_at (append-only, no update path).

## Indexing Notes

- `accounts.mobile_number` — unique index (login lookup).
- `accounts.email` — indexed.
- `worker_profiles.skill_categories` — GIN index, array-containment search filtering.
- `business_profiles.shop_categories` — GIN index, array-containment search filtering.
- `bookings.status`, `orders.status` — dashboard/queue queries.

## Migration Policy

All schema changes via versioned migration files in `database/migrations/`, never manual production edits. Every migration is additive/backward-compatible where possible; destructive changes require an explicit rollout plan noted in `docs/changelog.md`.
