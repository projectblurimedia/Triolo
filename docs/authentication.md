# Authentication

## Overview

Mobile OTP is the only credential for Users, Workers, and Businesses. JWT access + refresh tokens back the session. Admin auth may additionally use email/password (see `docs/product-specification.md` §4).

## Registration Flow

```
POST /api/v1/auth/register/request-otp   { fullName, mobileNumber, role, preferredLanguage? }
POST /api/v1/auth/register/verify-otp    { mobileNumber, otp }
  → creates account (status: active for user, pending_verification for worker/business)
  → preferred_language set from the registration request (defaults to 'en')
  → issues access + refresh JWT
```

`preferredLanguage` is carried through the OTP record between the two steps (see `docs/database.md` §otp_verifications) so it's available when the account row is actually created. See `docs/localization.md` for the full language-preference model, including how it syncs with device storage and `PATCH /auth/me/language`.

Workers/Businesses then call their profile-completion endpoints (`/api/v1/workers/profile`, `/api/v1/businesses/profile`) — see respective module docs once implemented.

## Login Flow

```
POST /api/v1/auth/login/request-otp   { mobileNumber }
POST /api/v1/auth/login/verify-otp    { mobileNumber, otp }
  → issues access + refresh JWT
  → response includes account role so client routes to the correct dashboard
```

## Tokens

- **Access token**: short-lived (e.g. 15 min), JWT, includes `accountId`, `role`, `status`.
- **Refresh token**: longer-lived (e.g. 30 days), opaque, stored hashed server-side in `refresh_tokens`, revocable.
- `POST /api/v1/auth/refresh` exchanges a valid refresh token for a new access token; rotates the refresh token.
- `POST /api/v1/auth/logout` revokes the refresh token.

## OTP Rules

- 6-digit numeric, expires in a short configurable window (e.g. 5 min).
- Single-use — consumed on successful verification.
- Rate-limited per mobile number to prevent abuse.
- Never logged in plaintext; stored hashed.

## Authorization

Every protected route checks:
1. Valid, non-expired access token.
2. Account `status = active` (blocked/suspended accounts are rejected at this layer, not just hidden in UI).
3. Role/permission matches the route's requirement.

## Account Status Values

`active`, `pending_verification` (worker/business awaiting admin approval — can use their own dashboard but are not searchable), `suspended` (temporary, admin-reversible), `blocked` (permanent until admin restores).
