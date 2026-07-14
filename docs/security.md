# Security

## Principles

- Validate all input at the API boundary — never trust client data.
- Least privilege: role-based authorization on every protected endpoint, checked server-side.
- Never expose internal error details to clients; log full detail server-side only.

## Credentials & Secrets

- OTPs and PINs stored hashed, never plaintext, never logged.
- Refresh tokens stored hashed server-side, revocable.
- All secrets (DB creds, JWT signing keys, FCM keys) via environment variables — never committed. See `docs/environment.md` and `.env.example`.

## Transport & Rate Limiting

- HTTPS enforced in staging/production.
- Rate limiting on authentication endpoints (OTP request/verify) to prevent brute force and SMS-cost abuse.

## PIN Verification Integrity

- Every booking/order PIN: random, unique, single-use, tied to exactly one booking/order.
- Retry limit enforced server-side; exceeding it should require regenerating rather than infinite retries.
- Verification endpoint checks account role (only the assigned worker/business staff can submit a PIN for that booking/order).

## Admin Security

- Admin routes require the `admin` role at minimum; future sub-roles (Section 4 of product-specification) get finer-grained permission checks.
- All admin actions (approve/reject/suspend/block/warn/announce/cancel-on-behalf) are recorded in `audit_logs`, which is append-only — no update or delete path exists in the API.

## Data Access

- Users/Workers/Businesses can only read/modify their own records (and, for business staff, records belonging to their business) — enforced in the service layer, not just hidden in the UI.
- Admin read access to user data is scoped to what's needed for verification, support, and moderation — not unrestricted.

## Dependency & Config Hygiene

- `.env` files never committed (`.gitignore` covers this); `.env.example` documents required variables without values.
- Dependencies kept current; security advisories addressed promptly once the project has a release cadence.
