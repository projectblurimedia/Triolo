# API Documentation

Conventions: see [[.cloud/api-guidelines.md]]. Base path: `/api/v1`.

## Auth Module

### POST /auth/register/request-otp
Request OTP for a new account. Every self-registered account is a plain `user` — there is no `role` field; Worker/Business are optional capabilities added later via the Workers/Businesses modules (see below), not chosen at registration.
- Auth: none
- Body: `{ fullName: string, mobileNumber: string, email?: string, latitude?: number, longitude?: number, locationAddress?: string, preferredLanguage?: "en" | "te" }` — `email`/`latitude`/`longitude`/`locationAddress` are all optional (a client can register with just `fullName`/`mobileNumber`; `user-app` still collects and sends all of them, `partner-app` sends only name/mobile — see `.cloud/project-context.md`'s Account Model note on why). `preferredLanguage` defaults to `en` if omitted; the client should always send the app's currently active language (see `docs/localization.md`).
- 200: `{ success: true, message: "OTP sent", data: { mobileNumber } }`
- 400: validation error (invalid email format if provided, `fullName`/`mobileNumber` missing, etc.)
- 409: mobile number already registered

### POST /auth/register/verify-otp
Verify OTP and create the account (always `role: "user"`, `status: "active"` immediately).
- Auth: none
- Body: `{ mobileNumber: string, otp: string }`
- 201: `{ success: true, message: "Account created", data: { accessToken, refreshToken, account: { id, fullName, mobileNumber, email, role, status, preferredLanguage } } }`
- 400: invalid/expired/already-consumed OTP, or `OTP_CONTEXT_MISSING` if registration details are missing

### POST /auth/login/request-otp
Request OTP for login.
- Auth: none
- Body: `{ mobileNumber: string }`
- 200: `{ success: true, message: "OTP sent" }`
- 404: no account for this mobile number

### POST /auth/login/verify-otp
Verify OTP and log in.
- Auth: none
- Body: `{ mobileNumber: string, otp: string }`
- 200: `{ success: true, message: "Login successful", data: { accessToken, refreshToken, account: { id, fullName, role, status } } }`
- 400: invalid/expired OTP
- 403: account suspended or blocked

### POST /auth/refresh
Exchange a valid refresh token for a new access token.
- Auth: refresh token in body
- Body: `{ refreshToken: string }`
- 200: `{ success: true, data: { accessToken, refreshToken } }`
- 401: invalid/expired/revoked refresh token

### POST /auth/logout
Revoke the current refresh token.
- Auth: Bearer access token
- Body: `{ refreshToken: string }`
- 200: `{ success: true, message: "Logged out" }`

### GET /auth/me
Return the authenticated account's basic info.
- Auth: Bearer access token
- 200: `{ success: true, data: { id, fullName, mobileNumber, email, role, status, preferredLanguage } }`

### PATCH /auth/me/language
Update the authenticated account's language preference.
- Auth: Bearer access token
- Body: `{ preferredLanguage: "en" | "te" }`
- 200: `{ success: true, message: "Language updated", data: { preferredLanguage } }`
- 400: unsupported language code

---

## Workers Module

Adds the Worker capability to the authenticated (already self-registered) `user` account — see the account-model note in `docs/database.md`.

### POST /workers/me/profile
Create the caller's worker profile. `multipart/form-data`, not JSON — the only such endpoint in this API so far, since it carries image files.
- Auth: Bearer access token
- Body (multipart fields): `skillCategories: string` — a JSON-stringified array of 1+ of `"electrician"|"plumber"|"painter"|"carpenter"|"mechanic"|"cleaner"|"mason"|"other"` (a worker can have multiple skills), `otherSkillDescription?: string` (required when `skillCategories` includes `"other"`), `experienceYears: number`, `latitude?: number`, `longitude?: number`, `area?: string`, `city: string`, `district: string`, `state: string`, `pincode: string` (required, 6 digits — replaced a single free-text `locationAddress` field, which wasn't precise enough to filter/search on), plus 0-6 image files under the field name `portfolioPhotos` (JPEG/PNG/WEBP, 8MB each max).
- 201: `{ success: true, message: "Worker profile created", data: { id, accountId, skillCategories, otherSkillDescription, experienceYears, latitude, longitude, area, city, district, state, pincode, portfolioPhotoUrls, verificationStatus, createdAt, updatedAt } }`
- 400: validation error (including `otherSkillDescription` missing when `"other"` is selected), or `CLOUDINARY_NOT_CONFIGURED` if image uploads aren't set up on this server yet
- 409: `WORKER_PROFILE_EXISTS` — one worker profile per account

### GET /workers/me/profile
Return the caller's worker profile, or `null` if they haven't created one.
- Auth: Bearer access token
- 200: `{ success: true, data: WorkerProfile | null }`

### PATCH /workers/me/profile
Update the caller's existing worker profile. `multipart/form-data`, same field shape as `POST`, plus `existingPhotoUrls: string` (a JSON-stringified array of already-uploaded portfolio photo URLs to keep — anything omitted is dropped). Newly uploaded files under `portfolioPhotos` are appended to the kept URLs, capped at 6 total. Keeps the profile's existing `verificationStatus` as-is (no longer resets to `pending_verification` — a reversed decision; admin still sees when a profile was edited via its `updatedAt` timestamp, surfaced as information only).
- Auth: Bearer access token
- 200: `{ success: true, message: "Worker profile updated", data: WorkerProfile }`
- 400: validation error
- 404: `WORKER_PROFILE_NOT_FOUND` — no profile exists yet to update

### DELETE /workers/me/profile
Permanently remove the caller's worker profile.
- Auth: Bearer access token
- 200: `{ success: true, message: "Worker profile deleted", data: null }`
- 404: `WORKER_PROFILE_NOT_FOUND`

### GET /workers/nearby
Search for verified workers near a given point — backs both Home's Nearby Workers search and the Services tab. Distance is computed server-side (Haversine, in SQL) — this is not a client-side filter over a full list. Excludes the caller's own worker profile, if any.
- Auth: Bearer access token
- Query params: `latitude: number` (required, -90..90), `longitude: number` (required, -180..180), `radiusKm?: number` (default 10, 0.1-50), `query?: string` (optional free-text, matched against the worker's name, skill category, `otherSkillDescription`, city, and area), `skillCategory?: string` (only workers who have this skill; a valid `worker_skill_category`), `sort?: "distance" | "rating"` (default `distance`; `rating` = best average first, unrated workers last, more ratings then distance breaking ties), `limit?: number` (default 20, max 50)
- Every `WorkerProfile` (this endpoint and `/workers/me/profile`) now carries `ratingAverage: number | null` (1 decimal; null before the first rating) and `ratingCount: number` — from customers rating finished Your Problems jobs (`POST /problems/:id/complete`)
- 200: `{ success: true, data: Array<WorkerProfile & { distanceMeters: number; accountFullName: string }> }` — only `verification_status: "verified"` profiles with a captured `latitude`/`longitude` are returned; `accountFullName` is included so a result has a "who" (mobile/email are deliberately not exposed here — no booking/contact flow exists yet)
- 400: `VALIDATION_ERROR` — missing/invalid `latitude`/`longitude`, or an out-of-range `radiusKm`/`limit`

### POST /workers/:id/view
Records that the caller viewed this worker's profile (fired by `user-app` when opening a Nearby Workers result's detail card) and raises a `profile_view` notification for the worker's own account — see the Notifications Module below. A no-op (no notification) if the caller is viewing their own profile.
- Auth: Bearer access token
- 200: `{ success: true, message: "Profile view recorded", data: null }`
- 404: `WORKER_PROFILE_NOT_FOUND`

## Businesses Module

Adds the Business capability to the authenticated `user` account — mirrors the Workers module exactly, shop-shaped instead of skill-shaped.

### POST /businesses/me/profile
Create the caller's business profile. `multipart/form-data`.
- Auth: Bearer access token
- Body (multipart fields): `shopName: string`, `shopCategories: string` — a JSON-stringified array of 1+ of `"grocery"|"restaurant"|"pharmacy"|"electronics"|"clothing"|"hardware"|"salon"|"other"` (a shop can belong to multiple categories), `otherCategoryDescription?: string` (required when `shopCategories` includes `"other"`), `latitude?: number`, `longitude?: number`, `area?: string`, `city: string`, `district: string`, `state: string`, `pincode: string` (required, 6 digits — replaced a single free-text `locationAddress` field, same as the Workers endpoint), `deliveryAvailable: "true"|"false"`, `deliveryPricePerKm?: number` (required when `deliveryAvailable` is `"true"`), plus 0-6 image files under the field name `shopPhotos`.
- 201: `{ success: true, message: "Business profile created", data: { id, accountId, shopName, shopCategories, otherCategoryDescription, latitude, longitude, area, city, district, state, pincode, shopPhotoUrls, deliveryAvailable, deliveryPricePerKm, verificationStatus, createdAt, updatedAt } }`
- 400 / 409: same shape as the Workers endpoint (`BUSINESS_PROFILE_EXISTS` instead of `WORKER_PROFILE_EXISTS`; also validates `otherCategoryDescription`/`deliveryPricePerKm` requirements)

### GET /businesses/me/profile
Return the caller's business profile, or `null` if they haven't created one.
- Auth: Bearer access token
- 200: `{ success: true, data: BusinessProfile | null }`

### PATCH /businesses/me/profile
Update the caller's existing business profile. `multipart/form-data`, same field shape as `POST`, plus `existingPhotoUrls: string` (a JSON-stringified array of already-uploaded shop photo URLs to keep). Newly uploaded files under `shopPhotos` are appended to the kept URLs, capped at 6 total. Keeps the profile's existing `verificationStatus` as-is (see the Workers `PATCH` endpoint above for the same note).
- Auth: Bearer access token
- 200: `{ success: true, message: "Business profile updated", data: BusinessProfile }`
- 400 / 404: same shape as the Workers endpoint (`BUSINESS_PROFILE_NOT_FOUND` instead of `WORKER_PROFILE_NOT_FOUND`)

### DELETE /businesses/me/profile
Permanently remove the caller's business profile.
- Auth: Bearer access token
- 200: `{ success: true, message: "Business profile deleted", data: null }`
- 404: `BUSINESS_PROFILE_NOT_FOUND`

### GET /businesses/nearby
Search for verified businesses near a given point, ordered nearest-first — mirrors `GET /workers/nearby` exactly, shop-shaped instead of skill-shaped. Excludes the caller's own business profile, if any.
- Auth: Bearer access token
- Query params: `latitude: number` (required, -90..90), `longitude: number` (required, -180..180), `radiusKm?: number` (default 10, 0.1-50), `query?: string` (optional free-text, matched against shop name, shop category, `otherCategoryDescription`, city, and area), `limit?: number` (default 20, max 50), `shopCategory?: string` (only shops in this category), `delivery?: "true"` (only shops that deliver), `sort?: "distance" | "rating"` (default `distance`; `rating` = best average first, unrated last)
- 200: `{ success: true, data: Array<BusinessProfile & { distanceMeters: number }> }` — only `verification_status: "verified"` profiles with a captured `latitude`/`longitude` are returned. Every `BusinessProfile` carries `ratingAverage: number | null` and `ratingCount` (customers rating completed orders, migration `0021`)
- 400: `VALIDATION_ERROR` — missing/invalid `latitude`/`longitude`, or an out-of-range `radiusKm`/`limit`

### POST /businesses/:id/view
Records that the caller viewed this business's profile (fired by `user-app` when opening a Nearby Shops result's detail card) and raises a `profile_view` notification for the business's own account — mirrors `POST /workers/:id/view` exactly.
- Auth: Bearer access token
- 200: `{ success: true, message: "Profile view recorded", data: null }`
- 404: `BUSINESS_PROFILE_NOT_FOUND`

## Admin Module

Every route requires `authorize('admin')` in addition to `authenticate` — a valid access token for a non-`admin` account gets `403 FORBIDDEN`. `admin` accounts are provisioned via `backend/scripts/seedAdmin.ts` (`npm run seed:admin -- <mobileNumber> <fullName> [email]`), never self-registered, and log in through `/auth/login/*`. The module owns no tables: every read and change goes through the owning module's service (see `.cloud/architecture.md`).

Lists all take `page` (default 1), `limit` (default 20, max 100) and `q` (free-text search), and return `{ items, total, page, limit }`. Every action that affects someone tells them (saved notification + push, in their language) — with the admin's `reason` when one is given (≤300 chars).

### GET /admin/stats
Dashboard numbers: `{ accounts: { total, active, suspended, blocked, newToday }, workers: { total, pending, verified, rejected }, businesses: {…same}, jobPosts: { total, live }, bookings: { active, searching, completed, cancelled, today }, orders: { new, active, completed, cancelled, today }, problems: { open, inProgress, completed, closed } }` (admin accounts are not counted).

### Accounts
- `GET /admin/accounts` — `q` (name, mobile, email), `status?: active|suspended|blocked`. Items are `Account` incl. `suspendedUntil`, `statusReason`.
- `GET /admin/accounts/:id` — `{ account, workerProfile, businessProfile, jobPost, bookings: AdminBooking[], orders: AdminOrder[], problems: AdminProblem[] }` (latest 25 of each, as customer or provider).
- `PATCH /admin/accounts/:id/status` — body `{ action: "suspend" | "ban" | "reactivate", days?: 1–365 (required for suspend), reason? }`. Suspend/ban: status `suspended` (until now + days) or `blocked`; every refresh token is revoked; their unfinished bookings and shop orders are cancelled (the other side told) and their open problem posts closed. 403 `ADMIN_ACCOUNT_PROTECTED` for an admin.
- `POST /admin/accounts/:id/remove-profiles` — body `{ reason? }`. "Delete": cancels their unfinished activity, deletes their worker, shop and job post profiles (with photos), and bans the account. Past bookings/orders are kept. Returns `{ account, removed: { worker, shop, jobPost } }`.

A suspended or banned account gets `403 ACCOUNT_SUSPENDED` (details `{ until, reason }`) or `403 ACCOUNT_BLOCKED` (details `{ reason }`) from `/auth/login/request-otp`, `/auth/login/verify-otp`, and — via `authenticate` — from every authenticated endpoint within ~30 s of the change (per-instance cache). A suspension whose end has passed is lifted automatically on the next login or request.

### Workers and shops (verification)
- `GET /admin/workers`, `GET /admin/businesses` — `status?: pending_verification|verified|rejected`, `q` (name, mobile; shops also shop name). Items include `accountFullName`, `accountMobileNumber`, `accountEmail`, `accountStatus`.
- `GET /admin/workers/:id`, `GET /admin/businesses/:id` — one profile with the same account fields. 404 `WORKER_PROFILE_NOT_FOUND` / `BUSINESS_PROFILE_NOT_FOUND`.
- `PATCH /admin/workers/:id/verification`, `PATCH /admin/businesses/:id/verification` — body `{ status: "verified" | "rejected" }`.

Suspended or banned workers, shops and job posters no longer appear in customer search, nearby lists or Quick Book broadcasts.

### Bookings (Quick Book and problem trips)
- `GET /admin/bookings` — `kind?: quick|problem`, `group?: active|completed|cancelled|expired`, `q` (customer/worker name or mobile, address, skill). Items: `AdminBooking` = the booking fields (incl. `cancelledBy: customer|worker|admin`, `cancelReason`) + `customer { accountId, fullName, mobileNumber }`, `worker { accountId, workerId, fullName, mobileNumber } | null`, `offerCount`. Never the arrival PIN.
- `GET /admin/bookings/:id` — plus `offers: [{ workerId, fullName, mobileNumber, distanceMeters, status, createdAt }]`.
- `POST /admin/bookings/:id/cancel` — body `{ reason? }`. Any unfinished step (`broadcasting` … `work_done`) → `cancelled`, `cancelledBy: "admin"`; the customer and the worker are both told ("Booking Cancelled by Triolo" + reason); a problem trip reopens its problem. 409 `BOOKING_INVALID_STATE` once finished.

### Shop orders
- `GET /admin/orders` — `group?: new|active|completed|cancelled` (cancelled includes declined and expired), `q` (customer, shop, owner). Items: `AdminOrder` = the order with its items + `customer {…}`, `shop { businessId, accountId, name, ownerName, mobileNumber }`. Never the PIN.
- `GET /admin/orders/:id`
- `POST /admin/orders/:id/cancel` — body `{ reason? }`. Any unfinished status → `cancelled`, `cancelledBy: "admin"`; the customer and the shop owner are both told. 409 `ORDER_INVALID_STATE` once finished.

### Problem posts
- `GET /admin/problems` — `group?: open|in_progress|completed|closed`, `q`. Items: the post + `customerFullName`, `customerMobileNumber`, `workerFullName`, `workerMobileNumber`, `closedReason`, `closedAt`.
- `GET /admin/problems/:id`
- `POST /admin/problems/:id/close` — body `{ reason? }`. Only an `open` post (`closed`; the customer is told). A post a worker took is stopped by cancelling its booking, which reopens it. 409 `PROBLEM_NOT_OPEN`.

### Job posts
- `GET /admin/job-posts` — `active?: true|false`, `q` (name, mobile, work, area). Items: the post + `fullName`, `mobileNumber`, `accountStatus`.
- `GET /admin/job-posts/:id`
- `PATCH /admin/job-posts/:id/active` — body `{ isActive, reason? }` (hide / show; the poster is told).
- `POST /admin/job-posts/:id/remove` — body `{ reason? }`. Deletes the post and its photo; the poster is told.

## Notifications Module

First slice of the planned Notifications module (Pending Module 6) — currently raises exactly one event type, `profile_view`, fired by `POST /workers/:id/view` / `POST /businesses/:id/view` above. Other backend modules reach this one through `NotificationsService`, never the `notifications`/`push_tokens` tables directly — the same module-boundary pattern `admin` already established for reaching into `workers`/`businesses`. Delivered two ways at once: an in-app row the client polls (`partner-app`'s `useNotifications` hook, ~8s interval) **and**, if the recipient has registered a device via `PUT /notifications/push-token`, a real push notification sent directly to Google's FCM HTTP v1 API (`firebase-admin`, not Expo's own push relay — see `backend/src/modules/notifications/pushSender.ts`'s own doc comment for why) so it reaches the device even with the app fully closed. Push requires the server's `FIREBASE_SERVICE_ACCOUNT_JSON` env var to be configured; if it isn't, `notifyProfileViewed` silently skips the push send and the in-app row still works normally — push is a supplementary delivery channel, never a dependency of the base feature.

### PATCH /notifications/push-token
Registers this phone for push notifications in one app.
- Auth: Bearer access token
- Body: `{ token: string, app?: "user" | "partner" }`. App versions from before migration 0026 don't send `app`; their tokens are stored as `legacy` and used only as a fallback.
- Registering a token removes it from every other account, so the account that logged in on the phone most recently gets its notifications. Each account has at most one token per app.
- 200: `{ success: true, message: "Push token registered", data: null }`

### POST /notifications/push-token/remove
Called on logout: this phone stops getting the account's notifications in that app.
- Auth: Bearer access token
- Body: `{ app: "user" | "partner", token?: string }`
- 200: `{ success: true, message: "Push token removed", data: null }`

Each push goes to the right app by notification type (`AUDIENCE_BY_TYPE` in `notifications/interfaces.ts`): offers, new orders, profile views → partner app; booking and order updates → user app; cancellations → the side that should hear about it; admin notices → both.

### GET /notifications
List the caller's own notifications, newest first, plus their unread count.
- Auth: Bearer access token
- 200: `{ success: true, data: { items: Array<{ id, accountId, type: "profile_view", title, body, isRead, createdAt }>, unreadCount: number } }` — capped at the 50 most recent

### PATCH /notifications/:id/read
Mark one notification as read. Scoped to the caller's own account — an `id` belonging to a different account is silently a no-op (no leak, no error), not a 404, since the query itself is `WHERE id = $1 AND account_id = $2`.
- Auth: Bearer access token
- 200: `{ success: true, message: "Notification marked as read", data: null }`

### POST /notifications/read-all
Mark every one of the caller's unread notifications as read.
- Auth: Bearer access token
- 200: `{ success: true, message: "All notifications marked as read", data: null }`

### POST /notifications/delete
Delete several of the caller's notifications at once (both apps' selection mode).
- Auth: Bearer access token
- Body: `{ ids: string[] }` — 1–100 UUIDs. Ids that aren't the caller's (or don't exist) are silently skipped, never deleted.
- 200: `{ success: true, message: "Notifications deleted", data: { deleted: number } }`
- 400: `VALIDATION_ERROR`

### DELETE /notifications/:id
Delete one of the caller's notifications (no-op if it isn't theirs).
- Auth: Bearer access token
- 200: `{ success: true, message: "Notification deleted", data: null }`

Notification `type` values: `profile_view` (worker/shop profile viewed), and — since migration `0017` — `problem_accepted` / `problem_work_done` (to the customer) and `problem_completed` (to the worker). The Your Problems job updates are saved as in-app notifications **and** pushed (`NotificationsService.notify()`), so they appear in both apps' notification lists.

## Bookings Module

Quick Book — a Rapido-style booking from broadcast to rating. A user requests one or more skills within a radius; every verified worker with **all** of those skills (array containment, not overlap) gets a `booking_offers` row plus a big, actionable push (channel `booking-offers`, Accept/Reject buttons, localized per recipient). Those offer pushes are **data-only** — `partner-app` composes the notification itself so it can carry action buttons (see `.cloud/architecture.md`'s Notification Architecture). First accept wins (race-safe, see `BookingsRepository.acceptOffer`); every other pending offer flips to `lost` and gets a replacing "job taken" push.

**Status flow** (`booking_request_status`):

```
broadcasting → accepted → on_the_way → arrived → in_progress → work_done → completed
broadcasting → expired   (no worker accepted within BROADCAST_TTL_MINUTES = 3)
       └──────────────┴──────────┴──────────┴──→ cancelled   (customer only, before the PIN is verified)
```

- **Arrival PIN** — 4 digits (`crypto.randomInt`), generated when a worker accepts. Returned **only to the customer** (`arrivalPin`, and only while the trip is in `accepted`/`on_the_way`/`arrived`), never to the worker and never in a push. The worker types it in on arrival; it's single-use (cleared once verified), compared with `timingSafeEqual`, and locked after 5 wrong attempts (`pin_attempts`, counted under a `SELECT … FOR UPDATE` row lock).
- **Live location** — while the trip is `accepted`/`on_the_way`/`arrived`, the worker app sends its position (`PUT /bookings/:id/location`, every ~8s/15m from an Android foreground service, so it keeps going when minimised); the customer app polls `GET /bookings/:id` (4s during the trip) and reads `worker.latitude/longitude`. The worker's position is only exposed during those three statuses.
- **Notifications** — every customer-facing step (accepted, on the way, arrived, work done) and every worker-facing one (cancelled, completed) is saved to the recipient's notification list and pushed (`NotificationsService.notify`, channel `default`, `data: { kind, bookingId }`). The data key is `bookingId`, not `bookingRequestId` — `partner-app` treats `bookingRequestId` as a *new offer* to pop up. Texts come from `bookings/pushTemplates.ts`' `tripTemplate(event, language)` (en + te). Verifying the PIN sends nothing — both people are standing together.
- **Rating** — the customer confirms finished (`POST /bookings/:id/complete`) with an optional 1–5 star rating and review (the app makes the rating required). Stored on the booking and added to the worker's running average via `WorkersService.recordRating()` — the same average Your Problems ratings feed.

Common errors on the trip endpoints: `404 BOOKING_REQUEST_NOT_FOUND` (no such booking, or not yours), `409 BOOKING_INVALID_STATE` (the booking isn't in a status that allows this step — e.g. arriving twice, cancelling after the PIN), `404 WORKER_PROFILE_NOT_FOUND` (worker endpoints, caller has no worker profile).

### Customer side

#### POST /bookings/quick
Broadcast a Quick Book request.
- Auth: Bearer access token
- Body: `{ skillCategories: string[], latitude: number, longitude: number, radiusKm?: number, locationAddress?: string }` — `radiusKm` defaults to `50` (also the max; testing value); `locationAddress` (≤300 chars) is a reverse-geocoded label shown to the worker
- 201: `{ success: true, data: { bookingRequestId: string, matchedWorkerCount: number } }` — the app cancels the request straight away when `matchedWorkerCount` is 0
- 400: `VALIDATION_ERROR`

#### GET /bookings/mine
The caller's own bookings, newest first (max 50) — feeds `user-app`'s My Bookings and Home's live-booking card.
- Auth: Bearer access token
- 200: `{ success: true, data: CustomerBooking[] }` (shape below)

#### GET /bookings/:id
One booking the caller made — polled by `user-app`'s tracker (dynamic interval: 3s while broadcasting, 4s during the trip, slower afterwards).
- Auth: Bearer access token; scoped to the caller's own request
- 200: `{ success: true, data: CustomerBooking }`:
  `{ id, accountId, skillCategories, latitude, longitude, locationAddress, radiusKm, status, acceptedWorkerId, acceptedAt, startedAt, arrivedAt, pinVerifiedAt, workDoneAt, completedAt, cancelledAt, cancelledBy: "customer"|"worker"|null, cancelReason: string|null, workerRating, workerReview, createdAt, arrivalPin: string|null, worker: { fullName, mobileNumber, skillCategories, ratingAverage, ratingCount, latitude, longitude, locationUpdatedAt } | null, acceptedWorkerFullName, acceptedWorkerSkillCategories }` — `arrivalPin` and `worker.latitude/longitude` are null outside `accepted`/`on_the_way`/`arrived`; the two `acceptedWorker*` fields are kept for older app builds
- 404: `BOOKING_REQUEST_NOT_FOUND`

#### POST /bookings/:id/cancel
Cancel while `broadcasting`, `accepted`, `on_the_way` or `arrived` (not once the PIN is verified). Any still-pending offers flip to `lost`; an assigned worker is notified (`booking_cancelled`).
- Auth: Bearer access token (the requester)
- 200: `{ success: true, message: "Booking cancelled", data: null }`
- 404 / 409 as above

#### POST /bookings/:id/complete
Confirm the job is finished — only once the worker has marked it `work_done`, so no step is skipped (the app shows Mark as Finished only then). Notifies the worker (`booking_completed`).
- Auth: Bearer access token (the requester)
- Body: `{ rating?: 1..5, review?: string (≤300) }`
- 200: `{ success: true, message: "Booking completed", data: null }`
- 400: `VALIDATION_ERROR`; 404 / 409 as above

### Worker side

#### GET /bookings/offers/mine
The caller's own still-open offers (only requests still `broadcasting`) — `partner-app`'s Bookings → Requests tab and `IncomingJobModal`.
- Auth: Bearer access token; returns `[]` if the caller has no worker profile
- 200: `{ success: true, data: Array<{ offerId, bookingRequestId, skillCategories: string[], distanceMeters: number, customerFullName: string, locationAddress: string|null, createdAt }> }` — the customer's phone is only shared after accepting

#### POST /bookings/:id/accept
Accept an offer — exactly one worker can win. Generates the arrival PIN, notifies the customer (`booking_accepted`), pushes "job taken" to every other invited worker.
- Auth: Bearer access token; caller must have a worker profile
- 200: `{ success: true, message: "Job accepted", data: null }`
- 404: `WORKER_PROFILE_NOT_FOUND`; 409: `BOOKING_ALREADY_TAKEN`

#### POST /bookings/:id/decline
Decline this worker's own offer only. Backs the notification's Reject button.
- Auth: Bearer access token; caller must have a worker profile
- 200: `{ success: true, message: "Job declined", data: null }` — also a silent no-op if the offer is already gone
- 404: `WORKER_PROFILE_NOT_FOUND`

#### GET /bookings/jobs/mine
Every Quick Book job this worker won — active ones first, then newest first. `partner-app`'s Bookings → Active / History tabs.
- Auth: Bearer access token; caller must have a worker profile
- 200: `{ success: true, data: WorkerJob[] }`

#### GET /bookings/jobs/:id
One job this worker won — polled by `partner-app`'s job screen (6s while active).
- 200: `{ success: true, data: WorkerJob }`:
  `{ ...the BookingRequest fields above (no arrivalPin), customerFullName, customerMobileNumber, distanceMeters: number|null, workerLatitude, workerLongitude, pinAttemptsLeft }`
- 404: `BOOKING_REQUEST_NOT_FOUND`

#### POST /bookings/:id/start
`accepted` → `on_the_way`. Notifies the customer (`booking_on_the_way`). The app then starts background location sharing and opens Google Maps directions (a plain `https://www.google.com/maps/dir/?api=1&destination=…` link — free, no API key).
- 200: `{ success: true, message: "Trip started", data: null }`

#### PUT /bookings/:id/location
Report the worker's current position during the trip.
- Body: `{ latitude: -90..90, longitude: -180..180 }`
- 200: `{ success: true, message: "Location updated", data: null }`
- 409: `BOOKING_TRIP_NOT_ACTIVE` — the trip is over (cancelled, PIN verified, …); the app stops its location service when it sees this

#### POST /bookings/:id/arrive
`accepted` or `on_the_way` → `arrived`. Notifies the customer (`booking_arrived`) to have their PIN ready.
- 200: `{ success: true, message: "Marked as arrived", data: null }`

#### POST /bookings/:id/verify-pin
`arrived` → `in_progress`, if the PIN matches.
- Body: `{ pin: "dddd" }` (exactly 4 digits)
- 200: `{ success: true, message: "PIN verified", data: null }`
- 400: `BOOKING_PIN_INVALID` with `error.details: { attemptsLeft }`
- 409: `BOOKING_PIN_LOCKED` — 5 wrong attempts; the customer has to cancel and rebook

#### POST /bookings/:id/work-done
`in_progress` → `work_done`. Notifies the customer (`booking_work_done`) to confirm and rate.
- 200: `{ success: true, message: "Work marked done", data: null }`

#### POST /bookings/offers/search
Worker's "Find Jobs Now". Adds an offer for this worker on every Quick Book request still `broadcasting` (and under 3 minutes old) that needs only skills they have, lies within that request's own radius of the worker, and isn't their own — a request they declined comes back as pending; one they lost stays gone (unique request+worker). Then returns their open offers, same shape as `GET /bookings/offers/mine`. Safe to call repeatedly.
- Auth: Bearer access token (a worker; unverified workers get `[]`)
- Body: `{ latitude?, longitude? }` — the device's position; the profile's service location is used without it
- 200: `{ success: true, data: PendingOffer[] }`

#### POST /bookings/:id/worker-cancel
The accepted worker backs out while `accepted`, `on_the_way` or `arrived` (not once the PIN is verified). Sets `cancelledBy: "worker"` and the optional reason, clears the PIN, and notifies the customer (`booking_cancelled`, "Worker Cancelled"). A trip started from a Your Problems post reopens that post for other workers.
- Auth: Bearer access token (the accepted worker)
- Body: `{ reason?: string }` (≤200 chars)
- 200: `{ success: true, message: "Job cancelled", data: null }`
- 404: `BOOKING_REQUEST_NOT_FOUND`, `WORKER_PROFILE_NOT_FOUND`
- 409: `BOOKING_INVALID_STATE` — not this worker's job, or past the PIN

## Problems Module

"Your Problems" (`user-app` → Services menu, formerly "Post a Problem"): a user lists, adds, edits, and deletes their own problem posts. Each post saves a non-emergency issue — location, the worker type(s) it needs, their quotation, and up to 5 photos. Verified workers nearby see open posts and the first to accept gets the job, which then runs as a Quick Book-style trip (see `POST /problems/:id/accept`). Photos are attached **one per request** after the post is created — Vercel rejects any request body over 4.5MB before it reaches the app, and several phone-camera photos in one multipart body routinely exceed that. The client deletes the post again if any photo upload fails, so a failed submit never leaves a half-saved post behind.

`ProblemPost` shape: `{ id, accountId, skillCategories: string[], description: string|null, quotationAmount: number, photoUrls: string[], locationAddress: string|null, latitude: number|null, longitude: number|null, status, acceptedWorkerId: string|null, acceptedAt, workDoneAt, completedAt, workerRating, workerReview, bookingRequestId: string|null, createdAt }`

**Job flow** (`status`): `open` → `accepted` (a verified worker with a matching skill accepts — first accept wins) → `work_done` (that worker marks it done) → `completed` (the **customer** confirms it finished — they can also confirm straight from `accepted`). Edit and photo changes are only allowed while `open`; delete is allowed while `open` or `completed`, never mid-job. Each transition pushes the other side (`kind`: `problem_accepted` / `problem_work_done` → customer, `problem_completed` → worker; text localized per recipient). `closed` exists in the DB enum but is unused.

Customer-side endpoints:

### POST /problems
Create a problem post (no photos yet).
- Auth: Bearer access token
- Body (JSON): `{ skillCategories: string[] (non-empty, each a valid worker_skill_category), quotationAmount: number (whole rupees, 1–1000000), locationAddress: string (3–300 chars), description?: string (≤500), latitude?: number, longitude?: number }`
- 201: `{ success: true, message: "Problem posted", data: ProblemPost }`
- 400: `VALIDATION_ERROR`

### PATCH /problems/:id
Edit the caller's own post. New photos are added afterwards via `POST /problems/:id/photos`, same as on create.
- Auth: Bearer access token
- Body (JSON): same fields as `POST /problems`, plus `keepPhotoUrls: string[]` (≤5) — which of the post's current photos to keep. Any current photo not listed is removed from the post and deleted from Cloudinary; URLs the post doesn't actually have are ignored.
- 200: `{ success: true, message: "Problem updated", data: ProblemPost }`
- 400: `VALIDATION_ERROR`
- 404: `PROBLEM_POST_NOT_FOUND`

### POST /problems/:id/photos
Attach one photo to the caller's own post.
- Auth: Bearer access token
- Content-Type: `multipart/form-data`, single file field `photo` (JPEG/PNG/WEBP, ≤8MB, effectively ≤4.5MB on Vercel), uploaded to Cloudinary under `triolo/problems`
- 200: `{ success: true, message: "Photo added", data: ProblemPost }`
- 400: `PHOTO_REQUIRED`, `FILE_UPLOAD_ERROR`, `INVALID_FILE_TYPE`
- 404: `PROBLEM_POST_NOT_FOUND` — no such post, or it belongs to another account
- 409: `PROBLEM_PHOTO_LIMIT` — already has 5 photos (enforced atomically in the `UPDATE`)

### DELETE /problems/:id
Delete the caller's own post and its Cloudinary photos. Silent no-op if the post doesn't exist or isn't the caller's.
- Auth: Bearer access token
- 200: `{ success: true, message: "Problem post deleted", data: null }`

### GET /problems/mine
The caller's own problem posts, newest first (max 50) — backs the "Your Problems" list.
- Auth: Bearer access token
- 200: `{ success: true, data: Array<ProblemPost & { acceptedWorkerFullName: string|null, acceptedWorkerMobileNumber: string|null }> }`

### POST /problems/:id/complete
Customer confirms the job is finished (`accepted` or `work_done` → `completed`) and rates the worker. Pushes the worker.
- Auth: Bearer access token; caller must own the post
- Body (JSON, optional): `{ rating?: 1-5 (integer), review?: string (≤300) }` — stored once on the job (`workerRating`/`workerReview`) and added to the worker's `ratingAverage`/`ratingCount`. The API accepts no rating; `user-app` always requires one.
- 200: `{ success: true, message: "Problem marked finished", data: ProblemPost }`
- 404: `PROBLEM_POST_NOT_FOUND`; 409: `PROBLEM_INVALID_STATE` (no worker yet, already finished, or not the caller's)

Edit/delete lock errors: `PATCH /problems/:id` and `POST /problems/:id/photos` return 409 `PROBLEM_NOT_EDITABLE` once a worker has accepted; `DELETE /problems/:id` returns 409 `PROBLEM_IN_PROGRESS` while `accepted`/`work_done`.

Worker-side endpoints (`partner-app` Home):

### GET /problems/nearby
Open problems within 50km (testing radius, same as Quick Book) that need **at least one** of the caller's worker skills, nearest first (max 50). Excludes the caller's own posts and posts with no GPS coordinates (typed-only location). Returns `[]` if the worker profile has no GPS location.
- Auth: Bearer access token; caller must have a **verified** worker profile
- 200: `{ success: true, data: Array<{ id, skillCategories, description, quotationAmount, photoUrls, locationAddress, distanceMeters, createdAt }> }` — no customer identity before accepting
- 403: `WORKER_NOT_VERIFIED`; 404: `WORKER_PROFILE_NOT_FOUND`

### GET /problems/assigned
Problems this worker accepted (active first, then finished; max 50), with the customer's contact details.
- Auth: Bearer access token (returns `[]` without a worker profile)
- 200: `{ success: true, data: Array<ProblemPost & { customerFullName: string, customerMobileNumber: string }> }`

### POST /problems/:id/accept
Accept an open problem. Race-safe — `UPDATE ... WHERE status = 'open'` lets exactly one worker win. **The job then runs as a trip:** the problems module asks bookings (`BookingsService.createForAcceptedProblem`) to create an already-`accepted` booking for it, with an arrival PIN, the worker's distance, `problem_post_id` and the quotation. From there it's the Quick Book flow — start trip / live location / arrive / PIN / work done / customer finishes with a rating (see the Bookings Module). If creating the trip fails, the post is reopened. The customer gets a `problem_accepted` notification whose `data.bookingId` opens the tracker.
- Auth: Bearer access token; verified worker profile; can't be the caller's own post
- 200: `{ success: true, message: "Problem accepted", data: ProblemPost }` — `data.bookingRequestId` is the new trip
- 403: `WORKER_NOT_VERIFIED`; 404: `PROBLEM_POST_NOT_FOUND` / `WORKER_PROFILE_NOT_FOUND`; 409: `PROBLEM_ALREADY_TAKEN`

**Trip-linked problems** (`bookingRequestId` set): `GET /problems/mine` and `GET /problems/assigned` add `bookingStatus` (the trip's live status, e.g. `on_the_way`). When the trip completes, the post becomes `completed` with the trip's rating/review copied over. When the customer cancels the trip, the post goes back to `open` (unlinked) for other workers. Bookings tells problems through a `BookingLifecycleListener` registered in the routes files, so neither module touches the other's table. The two endpoints below only apply to jobs accepted before this change (they 409 `PROBLEM_INVALID_STATE` for a trip-linked post).

### POST /problems/:id/work-done
The accepted worker marks the work done (`accepted` → `work_done`). Pushes the customer to confirm.
- Auth: Bearer access token; must be the worker who accepted it
- 200: `{ success: true, message: "Work marked done", data: ProblemPost }`
- 404: `PROBLEM_POST_NOT_FOUND` / `WORKER_PROFILE_NOT_FOUND`; 409: `PROBLEM_INVALID_STATE`

## Reviews Module

A worker's ratings and written feedback, for the profile screens (partner-app Profile tab, user-app worker profile). Owns no tables: it reads finished, rated jobs through `BookingsService` (Quick Book trips and trip-linked problems) and `ProblemsService` (problem jobs finished before they became trips — trip-linked ones are skipped there so nothing is counted twice).

`WorkerReviewsSummary`: `{ ratingAverage: number|null, ratingCount: number, distribution: [n1, n2, n3, n4, n5], reviews: Array<{ rating: number|null, review: string|null, customerName, skillCategories, completedAt }> }`. `ratingAverage`/`ratingCount` come from the worker profile's running totals. `distribution` counts ratings per star (index 0 = 1 star) over the last 200 rated jobs. `reviews` holds the newest 30. `customerName` is the first name plus last initial only ("Ravi K.").

### GET /reviews/workers/:workerId
A worker's public ratings and reviews.
- Auth: Bearer access token
- 200: `{ success: true, data: WorkerReviewsSummary }`
- 404: `WORKER_PROFILE_NOT_FOUND` (also for a malformed id)

### GET /reviews/me
The signed-in worker's own ratings and reviews.
- Auth: Bearer access token; caller must have a worker profile
- 200: `{ success: true, data: WorkerReviewsSummary }`
- 404: `WORKER_PROFILE_NOT_FOUND`

### GET /reviews/businesses/:businessId · GET /reviews/my-shop
A shop's ratings and feedback (any signed-in user / the shop's owner), from its completed, rated orders. Same `WorkerReviewsSummary` shape as workers (`skillCategories` is always `[]`).
- 404: `SHOP_NOT_FOUND` / `BUSINESS_PROFILE_NOT_FOUND`

## Orders Module

Bazaar shop orders — the customer sends a prepared list (Prepare List) to one nearby shop; the shop packs it item by item and sends the bill. Follows `docs/product-specification.md` §3:

```
placed → accepted (review started) → preparing → packed (bill sent) → ready_for_pickup | out_for_delivery → completed
placed → declined (shop) | expired (no answer in 30 min) | cancelled (customer — only while placed)
any step before completed → cancelled (shop)
```

- **Items**: each list item is `pending` until the shop marks it `packed` (with a price, rupees) or `unavailable`. Packing needs every item decided, a price on every packed item, and at least one packed item. The bill is `itemsTotal` (sum of packed prices) + `deliveryCharge` (delivery orders only) = `totalAmount`; unavailable items stay on the order so the customer sees them separately.
- **Delivery charge**: fixed when ordering — the shop's `deliveryPricePerKm` × distance (whole rupees). Delivery can only be chosen if the shop offers it.
- **PIN**: 4 digits, generated when the order is ready for pickup / out for delivery, shown only to the customer (`pin`), entered by the shop to complete; single use, locked after 5 wrong attempts. Never sent to the shop or in a push.
- **Contact**: the shop's phone is shown to the customer only once the shop accepts.
- **Notifications** (saved + pushed, recipient's language, `data: { kind, orderId }`): `order_placed` → shop owner; `order_accepted` / `order_declined` / `order_packed` (with the packed count and total) / `order_ready` / `order_out_for_delivery` / `order_completed` / `order_cancelled` → the other side.
- **Rating**: the customer rates the shop once after completion (`POST /orders/:id/rate`), added to `business_profiles.rating_sum/rating_count`.
- **Payment** is outside the app (cash/UPI at handover).

Common errors: `404 ORDER_NOT_FOUND` (also for a malformed id), `409 ORDER_INVALID_STATE` (not in a status that allows the step), `404 BUSINESS_PROFILE_NOT_FOUND` (shop steps without a shop).

`CustomerOrder`: `{ id, businessId, fulfillment: "pickup"|"delivery", status, latitude, longitude, locationAddress, distanceMeters, deliveryCharge, itemsTotal, totalAmount, note, cancelledBy, cancelReason, shopRating, shopReview, acceptedAt, packedAt, readyAt, completedAt, cancelledAt, declinedAt, expiredAt, createdAt, items: Array<{ id, position, name, quantity, unit, status: "pending"|"packed"|"unavailable", price }>, shop: { name, photoUrl, ratingAverage, ratingCount, latitude, longitude, address, mobileNumber|null }, pin: string|null }`. `ShopSideOrder` is the same order fields plus `customerFullName`, `customerMobileNumber`, `pinAttemptsLeft` (no `pin`, no `shop`).

### Customer
- `POST /orders` — body `{ businessId, fulfillment, items: Array<{ name, quantity?, unit? }> (1–100), latitude, longitude, locationAddress?, note? }` → 201 `CustomerOrder`. 404 `SHOP_NOT_FOUND` (unknown/unverified), 400 `ORDER_OWN_SHOP`, 400 `ORDER_DELIVERY_UNAVAILABLE`.
- `GET /orders/mine` → newest first (max 50). `GET /orders/:id` → `CustomerOrder`.
- `POST /orders/:id/cancel` — only while `placed`.
- `POST /orders/:id/rate` — body `{ rating: 1..5, review? }`, once, only when `completed`.

### Shop (the caller's own business profile)
- `GET /orders/shop/mine` — active first, then history (`[]` without a shop). `GET /orders/shop/:id` → `ShopSideOrder`.
- `POST /orders/:id/accept` · `POST /orders/:id/decline` (body `{ reason? }`) — only while `placed` (and not expired).
- `PUT /orders/:id/items` — body `{ items: Array<{ id, status, price? }> }`; while `accepted`/`preparing` (moves to `preparing`) → `ShopSideOrder`.
- `POST /orders/:id/packed` — sends the bill. 400 `ORDER_ITEMS_PENDING` / `ORDER_PRICE_MISSING` / `ORDER_NOTHING_PACKED`.
- `POST /orders/:id/ready` — `packed` → `ready_for_pickup` or `out_for_delivery` (by fulfillment), PIN generated.
- `POST /orders/:id/verify-pin` — body `{ pin }` → `completed`. 400 `ORDER_PIN_INVALID` (`details.attemptsLeft`), 409 `ORDER_PIN_LOCKED`.
- `POST /orders/:id/shop-cancel` — body `{ reason? }`, any step before `completed`.

## Favorites Module

A customer's saved workers and shops (Services/Bazaar menus → Favorites, and the heart on a profile).
- `GET /favorites` → `{ workers: Array<WorkerProfile & { accountFullName }>, businesses: BusinessProfile[] }` — newest saved first, verified profiles only.
- `PUT /favorites/:type/:id` · `DELETE /favorites/:type/:id` — `type` is `worker` or `business`; idempotent. 400 `VALIDATION_ERROR` for a bad type/id.

## Job Seekers Module

People looking for regular work (a home cook, a tutor, a driver, a nanny…), posted from the partner app and found from the user app's **Hire Staff**. One post per account; posts are live immediately (no admin review) and the poster can hide one. All routes require a login.

- `GET /job-seekers/me` → the caller's post, or `null`.
- `PUT /job-seekers/me` → creates or replaces the caller's post (keeps its shown/hidden state). Body: `category` (`teacher`, `cook`, `housekeeper`, `nanny`, `elder_care`, `driver`, `security_guard`, `gardener`, `office_assistant`, `shop_assistant`, `other`), `title` (2–80), `payAmount` (whole ₹, ≥1), `payPeriod` (`daily` | `monthly`), `availability` (`full_time` | `part_time` | `live_in`), `experienceYears` (0–60, default 0), `skills` (≤15 strings, trimmed and de-duplicated), `description?` (≤500), `latitude`, `longitude` (required), `locationAddress` (3–300). 400 `VALIDATION_ERROR`.
- `PATCH /job-seekers/me/active` `{ isActive }` → show or hide. 404 `JOB_POST_NOT_FOUND` with no post.
- `DELETE /job-seekers/me` → also removes the photo from storage. 404 `JOB_POST_NOT_FOUND` with no post.
- `PUT /job-seekers/me/photo` (multipart, field `photo`, one image ≤8MB) → the post with its new `photoUrl`; the previous photo is deleted from storage. 400 `PHOTO_REQUIRED`, 404 `JOB_POST_NOT_FOUND`.
- `DELETE /job-seekers/me/photo` → the post with `photoUrl: null`. 404 `JOB_POST_NOT_FOUND`.
- Every post (own and search results) carries `photoUrl` (string or null). The apps no longer ask for a separate title: they send the work itself as `title` (the person's own words when `category` is `other`).
- `GET /job-seekers/search?latitude&longitude&radiusKm(0.1–50, default 25)&category?&payPeriod?&availability?&query?&sort(distance|pay)&limit(≤50, default 30)` → shown posts within the radius, never the caller's own, each with `fullName`, `mobileNumber` (so the customer can call) and `distanceMeters`. `query` matches the title, name, description and skills. `sort=pay` compares a daily rate as 26 working days. 400 `VALIDATION_ERROR` for bad parameters.

---

**Localization note**: `message` fields and validation error text on any endpoint are for logs/debugging, not for display — the client resolves `error.code` to a localized string itself. See `docs/localization.md`.

Further modules (Users, Booking, Orders) documented here as they're implemented — never left to drift from the actual routes. Admin currently covers only listing/verifying Worker/Business profiles; the rest of its planned scope (user/worker/business management, complaints, warnings, suspension, announcements, audit logs — see `.cloud/project-context.md`) is still pending. Notifications currently covers only the `profile_view` event described above; push (FCM) delivery and other event types are still pending.
