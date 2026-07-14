# Database Design

PostgreSQL. Normalized schema; foreign keys enforce relationships; index columns used in frequent filters (mobile_number, profession, business_category, service_area, status fields).

## Entity Overview

| Entity | Owned by module | Notes |
|---|---|---|
| accounts | auth | Shared identity row for every account (User/Worker/Business/Admin) |
| otp_verifications | auth | Short-lived OTP codes for registration/login |
| refresh_tokens | auth | JWT refresh token store, revocable |
| users | users | Extends accounts where role = user |
| worker_profiles | workers | Extends accounts where role = worker |
| business_profiles | businesses | Extends accounts where role = business |
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
| role | enum(user, worker, business_owner, business_staff, admin) | |
| status | enum(active, pending_verification, suspended, blocked) | default active for `user`, `pending_verification` for worker/business |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### otp_verifications
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| mobile_number | varchar(15) | indexed |
| otp_hash | text | hashed, never stored plain |
| purpose | enum(registration, login) | |
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

## Planned Tables (subsequent modules — outline only, refine when implemented)

- **worker_profiles**: account_id FK, profession, skills[], experience_years, service_areas[], working_hours, address, id_document_url, profile_photo_url, portfolio_photo_urls[], availability enum(online, busy, offline).
- **business_profiles**: account_id FK, business_name, category, owner_name, address, village_town, service_area, working_hours, weekly_holiday, delivery_available bool, verification_document_urls[], shop_photo_urls[].
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
- `worker_profiles.profession`, `worker_profiles.service_areas` — search filtering.
- `business_profiles.category`, `business_profiles.service_area` — search filtering.
- `bookings.status`, `orders.status` — dashboard/queue queries.

## Migration Policy

All schema changes via versioned migration files in `database/migrations/`, never manual production edits. Every migration is additive/backward-compatible where possible; destructive changes require an explicit rollout plan noted in `docs/changelog.md`.
