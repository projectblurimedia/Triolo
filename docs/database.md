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
| booking_requests | bookings | Implemented — Quick Book's broadcast request (skills, location, radius, status); see its own section below |
| booking_offers | bookings | Implemented — one row per invited worker per request; first-accept-wins is enforced here |
| (arrival PIN) | bookings | Implemented as `booking_requests.arrival_pin` / `pin_attempts` (migration `0018`); shop orders keep theirs on `shop_orders.pin` |
| shop_orders / shop_order_items | orders | Implemented — a list sent to a shop and its items (packed with a price, or unavailable); see their section below |
| notifications | notifications | Implemented — `profile_view` event only so far, delivered in-app (polled) and via push when configured; see its own section below |
| push_tokens | notifications | Implemented — one device token per account, feeds the push side of `notifications` above |
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
| suspended_until | timestamptz nullable | end of an admin suspension (`status = 'suspended'`); lifted automatically once passed (migration `0025`) |
| status_reason | text nullable | the admin's reason for the current suspension or ban (migration `0025`) |
| status_changed_at | timestamptz nullable | when the admin last changed `status` (migration `0025`) |
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
| area | text nullable | street/locality/landmark — the only optional part of the structured address |
| city / district / state | text | required — replaced a single free-text `location_address` column (migration 0008), which wasn't precise enough to filter/search on |
| pincode | text, `CHECK (pincode ~ '^[0-9]{6}$')` | required, 6-digit Indian postal code — indexed (`idx_worker_profiles_pincode`, plus `idx_worker_profiles_city`) for future area-based search |
| portfolio_photo_urls | text[] | Cloudinary-hosted URLs, uploaded via `POST /api/v1/workers/me/profile` (multipart) |
| verification_status | enum `profile_verification_status` (pending_verification, verified, rejected) | admin review gate for this capability specifically, independent of `accounts.status` |
| rating_sum / rating_count | integer, default 0 | running total of customer star ratings (migration `0016`) — the API exposes `ratingAverage = rating_sum / rating_count` (null when count is 0). Only ever incremented via `WorkersService.recordRating()`, called by the problems module when a job is rated, so the workers module never reads `problem_posts` |
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
| area | text nullable | street/locality/landmark — the only optional part of the structured address |
| city / district / state | text | required — replaced a single free-text `location_address` column (migration 0008), which wasn't precise enough to filter/search on |
| pincode | text, `CHECK (pincode ~ '^[0-9]{6}$')` | required, 6-digit Indian postal code — indexed (`idx_business_profiles_pincode`, plus `idx_business_profiles_city`) for future area-based search |
| shop_photo_urls | text[] | Cloudinary-hosted URLs, uploaded via `POST /api/v1/businesses/me/profile` (multipart) |
| delivery_available | boolean | whether the shop offers delivery |
| delivery_price_per_km | double precision nullable | required (validated at the API layer) when `delivery_available` is true |
| verification_status | enum `profile_verification_status` | shared enum with `worker_profiles` |
| created_at / updated_at | timestamptz | |

### notifications (Notifications module — implemented, in-app only for now)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts.id, ON DELETE CASCADE | the recipient — not the actor who triggered the notification |
| type | enum `notification_type` | just `profile_view` for now; more event types append to this enum as they're built, no table redesign needed |
| title / body | text | plain, not per-language — see `docs/localization.md`; this module doesn't localize server-side yet since it composes exactly one fixed, English-only string per event type so far |
| is_read | boolean, default false | |
| created_at | timestamptz | |

Migration `0009_create_notifications.sql`. One composite index, `(account_id, created_at DESC)`, covers both read patterns this module has (list newest-first, count unread) — no separate index needed for either. Raised by `POST /api/v1/workers/:id/view` / `POST /api/v1/businesses/:id/view` via `NotificationsService.notifyProfileViewed()` (see `.cloud/architecture.md`'s Backend Module Boundaries). Delivered two ways: polling (`GET /api/v1/notifications`, `partner-app`'s `useNotifications()` hook) always works; a real FCM push additionally fires if the recipient has a row in `push_tokens` below and the server has push configured.

### push_tokens (Notifications module — implemented)
| column | type | notes |
|---|---|---|
| account_id | uuid PK, FK → accounts.id, ON DELETE CASCADE | one row per account — a newer registration (reinstall, new device) overwrites the old token, no multi-device support yet |
| token | text | the device's native FCM registration token, not an Expo push token — see `backend/src/modules/notifications/pushSender.ts`'s doc comment for why this bypasses Expo's own push relay |
| updated_at | timestamptz | |

Migration `0010_create_push_tokens.sql`. Owned by the `notifications` module, not `auth`/`accounts` — deliberately kept as its own table rather than a column on `accounts`, so nothing outside this module ever needs to reach into it. Registered via `PATCH /api/v1/notifications/push-token`; consumed by `NotificationsService.notifyProfileViewed()`, which looks the token up right before sending a push and silently skips the push (the in-app row above is unaffected) if none is registered.

### booking_requests (Bookings module — implemented: Quick Book, broadcast through rating)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts.id, ON DELETE CASCADE | the requesting user |
| skill_categories | `worker_skill_category[]` | every skill required — a matching worker must have **all** of these, not just one |
| latitude / longitude | double precision | the requester's location at broadcast time |
| radius_km | numeric | how far the broadcast reached — currently always `50` (a testing-only default, also the max the API allows) |
| location_address | text, nullable | reverse-geocoded label for the customer's location, shown to the worker (migration `0018`) |
| status | enum `booking_request_status` (`broadcasting`, `accepted`, `on_the_way`, `arrived`, `in_progress`, `work_done`, `completed`, `cancelled`, `expired`) | full trip flow added in migration `0018`; `expired` (+ `expired_at`, migration `0020`) = no worker accepted within 3 minutes — transitions in `docs/api.md`'s Bookings Module |
| accepted_worker_id | uuid FK → worker_profiles.id, ON DELETE SET NULL, nullable | set atomically the moment a worker wins the accept race |
| accepted_at | timestamptz, nullable | |
| arrival_pin | text, nullable | 4-digit PIN set on accept, returned only to the customer; cleared once verified (single use) |
| pin_attempts | integer, default 0 | wrong PIN tries — locked at 5, counted under a `SELECT … FOR UPDATE` row lock |
| worker_latitude / worker_longitude / worker_location_at | double precision / timestamptz, nullable | the worker's last reported position during the trip (`PUT /bookings/:id/location`); only exposed to the customer while `accepted`/`on_the_way`/`arrived` |
| started_at / arrived_at / pin_verified_at / work_done_at / completed_at / cancelled_at | timestamptz, nullable | one timestamp per step — drives the customer's progress timeline |
| cancelled_by | text, nullable, `CHECK (customer, worker)` | who cancelled (migration `0024`); the worker can cancel until the PIN is verified |
| cancel_reason | text, nullable | the worker's optional reason (migration `0024`) |
| worker_rating | smallint, nullable, `CHECK (1..5)` | the customer's rating, set once on completion; also added to `worker_profiles.rating_sum/rating_count` via `WorkersService.recordRating()` |
| worker_review | text, nullable | optional feedback (≤300 chars at the API) |
| created_at | timestamptz | |

Migration `0018_quick_book_trip_flow.sql` also added index `(accepted_worker_id, created_at DESC)` (a worker's job history, `GET /bookings/jobs/mine`) and `notification_type` values `booking_accepted`, `booking_on_the_way`, `booking_arrived`, `booking_work_done`, `booking_completed`, `booking_cancelled`.

### booking_offers (Bookings module — implemented)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| booking_request_id | uuid FK → booking_requests.id, ON DELETE CASCADE | |
| worker_id | uuid FK → worker_profiles.id, ON DELETE CASCADE | |
| status | enum `booking_offer_status` (`pending`, `accepted`, `lost`, `declined`) | `accepted`/`lost` flip atomically alongside the parent request (see below); `declined` is set independently, one row at a time, when a worker dismisses their own offer (`POST /bookings/:id/decline`) — added in migration `0012_booking_offer_declined_status.sql` via `ALTER TYPE ... ADD VALUE` |
| distance_meters | double precision | computed once, at broadcast time, from the requester's location to this worker's |
| created_at | timestamptz | |
| | | `UNIQUE (booking_request_id, worker_id)` — one offer per worker per request |

Migration `0011_create_booking_requests.sql`. Two indexes: `(account_id, created_at DESC)` on `booking_requests` (a requester's own history, not yet surfaced in any UI), `(worker_id, status)` on `booking_offers` (a worker's pending-offers list, `GET /api/v1/bookings/offers/mine`). **First-accept-wins is enforced entirely by `booking_requests`' own row lock**, not application logic: `BookingsRepository.acceptOffer()` runs `UPDATE booking_requests SET status='accepted', ... WHERE id=$1 AND status='broadcasting'` inside a transaction — a second, concurrent call for the same request blocks on Postgres's row lock until the first commits, then affects 0 rows since `status` no longer matches, so exactly one worker can ever win. The same transaction flips every other still-`pending` offer for that request to `lost` and returns the losing workers' account ids/languages so the service layer can push a "job taken" notification to each (see `docs/api.md`'s Bookings Module section, and `.cloud/architecture.md`'s Notification Architecture).

### problem_posts (Problems module — implemented; accepted jobs run as trips)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts.id, ON DELETE CASCADE | the user who posted it |
| skill_categories | `worker_skill_category[]` | worker type(s) needed, GIN-indexed |
| description | text, nullable | optional, ≤500 chars (API-enforced) |
| quotation_amount | integer, `CHECK (> 0)` | the user's offered price, whole rupees |
| photo_urls | text[], default `{}` | 0–5 Cloudinary URLs, appended one at a time (`POST /problems/:id/photos`) |
| location_address | text, nullable | GPS-detected (reverse-geocoded) or typed address — added in migration `0014`; nullable at the DB level only because it was added to an existing table, the API requires it |
| latitude / longitude | double precision, nullable | set when the address came from "Use My Current Location"; null for a typed address |
| status | enum `problem_post_status` (`open`, `accepted`, `work_done`, `completed`; `closed` unused) | job flow — see `docs/api.md`'s Problems Module; `accepted`/`work_done`/`completed` added in migration `0015` |
| accepted_worker_id | uuid FK → worker_profiles.id, ON DELETE SET NULL, nullable | set atomically when a worker wins the accept (`WHERE status = 'open'` row lock) |
| accepted_at / work_done_at / completed_at | timestamptz, nullable | when each transition happened |
| worker_rating | smallint, nullable, `CHECK (1..5)` | the customer's star rating of the worker, set once when confirming finished (migration `0016`) |
| worker_review | text, nullable | optional short review with that rating |
| booking_request_id | uuid FK → booking_requests.id, ON DELETE SET NULL, nullable | the trip this job runs as once accepted (migration `0019`); cleared when the customer cancels the trip and the post reopens |
| created_at | timestamptz | |

Migration `0019_problem_jobs_as_trips_and_reviews.sql` also added `booking_requests.problem_post_id` (FK → problem_posts, ON DELETE SET NULL) and `booking_requests.quotation_amount`, plus partial indexes on `(accepted_worker_id, completed_at DESC) WHERE status = 'completed'` on both tables for the reviews queries.

Migrations `0013_create_problem_posts.sql`, `0014_problem_posts_location_address.sql`, `0015_problem_posts_job_flow.sql`. Indexes: `(status, created_at DESC)` and `(accepted_worker_id, created_at DESC)` (both 0015) for the worker-side nearby/assigned queries, plus `(account_id, created_at DESC)` for `GET /problems/mine`, and a GIN index on `skill_categories` for the future "show open posts to matching workers" query.

### shop_orders / shop_order_items (Orders module — implemented)
Migration `0021_shop_orders_favorites_shop_ratings.sql`. A list the customer sends to one shop; the flow and rules are in `docs/api.md`'s Orders Module.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts.id, ON DELETE CASCADE | the customer |
| business_id | uuid FK → business_profiles.id, ON DELETE CASCADE | the shop |
| fulfillment | enum `shop_order_fulfillment` (`pickup`, `delivery`) | delivery only if the shop offers it |
| status | enum `shop_order_status` (`placed`, `accepted`, `preparing`, `packed`, `ready_for_pickup`, `out_for_delivery`, `completed`, `cancelled`, `declined`, `expired`) | every change is a guarded `UPDATE … WHERE status = …`; `placed` orders expire after 30 min (lazily) |
| latitude / longitude / location_address | double precision / text | where the customer is (delivery address) |
| distance_meters | double precision | customer ↔ shop, at order time |
| delivery_charge | numeric(10,2) | shop's price per km × distance, fixed at order time |
| items_total / total_amount | numeric(10,2), nullable | the bill, set when packed |
| note | text, nullable | the customer's note |
| pin / pin_attempts | text, nullable / integer | pickup/delivery PIN, set at handover, cleared once verified; locked at 5 |
| cancelled_by / cancel_reason | text, nullable | `customer` or `shop` |
| shop_rating / shop_review / rated_at | smallint 1–5 / text / timestamptz, nullable | the customer's rating, once |
| accepted_at, packed_at, ready_at, completed_at, cancelled_at, declined_at, expired_at, created_at, updated_at | timestamptz | |

`shop_order_items`: `id`, `order_id` (FK, cascade), `position`, `name`, `quantity` (text, kept as spoken/typed), `unit`, `status` enum `shop_order_item_status` (`pending`, `packed`, `unavailable`), `price` numeric(10,2) (packed items only); `UNIQUE (order_id, position)`. Indexes: `(account_id, created_at DESC)`, `(business_id, created_at DESC)`, partial `(created_at) WHERE status = 'placed'` for expiry.

The same migration added `business_profiles.rating_sum/rating_count` (shop ratings, same pattern as workers), the `favorites` table (`account_id`, `target_type` enum `favorite_target_type` (`worker`, `business`), `target_id`, `created_at`; PK on all three) and the `order_*` notification types.

### job_seeker_posts (Job Seekers module — implemented, migration `0022`)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid, UNIQUE, FK → accounts (cascade) | one post per account |
| category | enum `job_seeker_category` | teacher, cook, housekeeper, nanny, elder_care, driver, security_guard, gardener, office_assistant, shop_assistant, other |
| title | text | e.g. "Maths tutor" |
| pay_amount | integer > 0 | rupees |
| pay_period | enum `job_seeker_pay_period` | daily, monthly |
| availability | enum `job_seeker_availability` | full_time, part_time, live_in |
| experience_years | integer ≥ 0 | |
| skills | text[] | |
| description | text, nullable | |
| latitude / longitude | double precision, NOT NULL | GPS, for nearby search |
| location_address | text | |
| photo_url | text, nullable | profile photo (Cloudinary), migration `0023` |
| is_active | boolean, default true | hidden posts drop out of search |
| created_at / updated_at | timestamptz | updated_at set on every save |

Partial index `(category) WHERE is_active`. No admin review: a post is live as soon as it's saved.

### Admin controls (migration `0025`)

- `booking_requests.cancelled_by` and `shop_orders.cancelled_by` also accept `'admin'` (the admin stopped it; `cancel_reason` holds their reason).
- `problem_posts.closed_reason`, `closed_at`: an open post the admin took down (`status = 'closed'`, unused before).
- `notification_type` gained `'admin_notice'` (suspension, ban, reactivation, removed profiles, closed problem, hidden/removed job post).
- `idx_accounts_status` for the admin's account filters.

## Planned Tables (subsequent modules — outline only, refine when implemented)

- **business_staff**: business_profile_id FK, account_id FK, permissions jsonb.
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
