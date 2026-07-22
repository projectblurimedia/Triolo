# API Documentation

Conventions: see [[.cloud/api-guidelines.md]]. Base path: `/api/v1`.

## Auth Module

### POST /auth/register/request-otp
Request OTP for a new account. Every self-registered account is a plain `user` — there is no `role` field; Worker/Business are optional capabilities added later via the Workers/Businesses modules (see below), not chosen at registration.
- Auth: none
- Body: `{ fullName: string, mobileNumber: string, email: string, latitude?: number, longitude?: number, locationAddress: string, preferredLanguage?: "en" | "te" }` — `latitude`/`longitude` are omitted when the client only has a manually-typed address (no GPS fix); `locationAddress` is always required. `preferredLanguage` defaults to `en` if omitted; the client should always send the app's currently active language (see `docs/localization.md`).
- 200: `{ success: true, message: "OTP sent", data: { mobileNumber } }`
- 400: validation error (missing/invalid email, location, etc.)
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
- Body (multipart fields): `skillCategories: string` — a JSON-stringified array of 1+ of `"electrician"|"plumber"|"painter"|"carpenter"|"mechanic"|"cleaner"|"mason"|"other"` (a worker can have multiple skills), `otherSkillDescription?: string` (required when `skillCategories` includes `"other"`), `experienceYears: number`, `latitude?: number`, `longitude?: number`, `locationAddress?: string`, plus 0-6 image files under the field name `portfolioPhotos` (JPEG/PNG/WEBP, 8MB each max).
- 201: `{ success: true, message: "Worker profile created", data: { id, accountId, skillCategories, otherSkillDescription, experienceYears, latitude, longitude, locationAddress, portfolioPhotoUrls, verificationStatus, createdAt, updatedAt } }`
- 400: validation error (including `otherSkillDescription` missing when `"other"` is selected), or `CLOUDINARY_NOT_CONFIGURED` if image uploads aren't set up on this server yet
- 409: `WORKER_PROFILE_EXISTS` — one worker profile per account

### GET /workers/me/profile
Return the caller's worker profile, or `null` if they haven't created one.
- Auth: Bearer access token
- 200: `{ success: true, data: WorkerProfile | null }`

### PATCH /workers/me/profile
Update the caller's existing worker profile. `multipart/form-data`, same field shape as `POST`, plus `existingPhotoUrls: string` (a JSON-stringified array of already-uploaded portfolio photo URLs to keep — anything omitted is dropped). Newly uploaded files under `portfolioPhotos` are appended to the kept URLs, capped at 6 total. Resets `verificationStatus` to `pending_verification` — edited details haven't been reviewed yet.
- Auth: Bearer access token
- 200: `{ success: true, message: "Worker profile updated", data: WorkerProfile }`
- 400: validation error
- 404: `WORKER_PROFILE_NOT_FOUND` — no profile exists yet to update

### DELETE /workers/me/profile
Permanently remove the caller's worker profile.
- Auth: Bearer access token
- 200: `{ success: true, message: "Worker profile deleted", data: null }`
- 404: `WORKER_PROFILE_NOT_FOUND`

## Businesses Module

Adds the Business capability to the authenticated `user` account — mirrors the Workers module exactly, shop-shaped instead of skill-shaped.

### POST /businesses/me/profile
Create the caller's business profile. `multipart/form-data`.
- Auth: Bearer access token
- Body (multipart fields): `shopName: string`, `shopCategories: string` — a JSON-stringified array of 1+ of `"grocery"|"restaurant"|"pharmacy"|"electronics"|"clothing"|"hardware"|"salon"|"other"` (a shop can belong to multiple categories), `otherCategoryDescription?: string` (required when `shopCategories` includes `"other"`), `latitude?: number`, `longitude?: number`, `locationAddress?: string`, `deliveryAvailable: "true"|"false"`, `deliveryPricePerKm?: number` (required when `deliveryAvailable` is `"true"`), plus 0-6 image files under the field name `shopPhotos`.
- 201: `{ success: true, message: "Business profile created", data: { id, accountId, shopName, shopCategories, otherCategoryDescription, latitude, longitude, locationAddress, shopPhotoUrls, deliveryAvailable, deliveryPricePerKm, verificationStatus, createdAt, updatedAt } }`
- 400 / 409: same shape as the Workers endpoint (`BUSINESS_PROFILE_EXISTS` instead of `WORKER_PROFILE_EXISTS`; also validates `otherCategoryDescription`/`deliveryPricePerKm` requirements)

### GET /businesses/me/profile
Return the caller's business profile, or `null` if they haven't created one.
- Auth: Bearer access token
- 200: `{ success: true, data: BusinessProfile | null }`

### PATCH /businesses/me/profile
Update the caller's existing business profile. `multipart/form-data`, same field shape as `POST`, plus `existingPhotoUrls: string` (a JSON-stringified array of already-uploaded shop photo URLs to keep). Newly uploaded files under `shopPhotos` are appended to the kept URLs, capped at 6 total. Resets `verificationStatus` to `pending_verification`.
- Auth: Bearer access token
- 200: `{ success: true, message: "Business profile updated", data: BusinessProfile }`
- 400 / 404: same shape as the Workers endpoint (`BUSINESS_PROFILE_NOT_FOUND` instead of `WORKER_PROFILE_NOT_FOUND`)

### DELETE /businesses/me/profile
Permanently remove the caller's business profile.
- Auth: Bearer access token
- 200: `{ success: true, message: "Business profile deleted", data: null }`
- 404: `BUSINESS_PROFILE_NOT_FOUND`

---

**Localization note**: `message` fields and validation error text on any endpoint are for logs/debugging, not for display — the client resolves `error.code` to a localized string itself. See `docs/localization.md`.

Further modules (Users, Workers, Businesses, Booking, Orders, Notifications, Admin) documented here as they're implemented — never left to drift from the actual routes.
