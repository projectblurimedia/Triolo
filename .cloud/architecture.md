# Architecture

## Style

Modular Monolith. Three layers:

```
Presentation (mobile app / admin web)
        ↓
Business Logic (Express controllers → services)
        ↓
Data Access (repositories → PostgreSQL)
```

The UI never talks to the database directly; every request goes through backend APIs.

## Backend Module Boundaries

Each feature is an independent module under `backend/src/modules/<name>/`:

```
auth/
users/
workers/
businesses/
staff/
booking/
orders/
notifications/
admin/
ratings/
reviews/
search/
verification/
audit-logs/
```

Each module contains:

```
routes.ts
controller.ts
service.ts
repository.ts
validation.ts
dto.ts
interfaces.ts
tests/
```

Modules communicate only through each other's service interfaces — never by reaching into another module's repository or internal state directly. This is the boundary that makes future microservice extraction possible without a rewrite.

## Frontend Structure (mobile/)

Feature-based, mirroring backend modules:

```
src/
  screens/        (auth, home, user, worker, business, orders, booking, notifications, profile, settings, admin)
  components/     (shared: buttons, cards, inputs, dialogs, loaders, icons)
  navigation/
  services/       (API clients per module)
  hooks/
  state/          (Zustand stores)
  theme/
  localization/   (en, te)
  utils/
  constants/
  assets/
```

## Auth Flow

1. Mobile number entered → OTP sent.
2. OTP verified → account created/logged in.
3. JWT access + refresh tokens issued.
4. User → dashboard immediately. Worker/Business → profile completion → `pending_verification` until admin approves.

## Authorization

Role-based: `user`, `worker`, `business_owner`, `business_staff`, `admin` (+ future admin sub-roles). Every protected endpoint checks authentication (valid JWT) and authorization (role/permission) before executing business logic.

## Search Architecture

Area-based for MVP: users select village/town, workers/businesses define service areas. Search service is isolated behind an interface so GPS-based radius search can be swapped in later without touching booking/order business logic.

## Verification (PIN) Architecture

```
Booking/Order created → backend generates unique single-use PIN → stored securely
    → customer shares PIN with worker/business staff → PIN submitted → backend verifies
    → status updates only on successful verification
```

Never SMS OTP for this step — in-app only, free, per-booking/per-order.

## Notification Architecture

Firebase Cloud Messaging via a dedicated `notifications` service — never triggered directly from controllers. Other modules call `notifications.service` to enqueue a send.

## Database

PostgreSQL, normalized. Core entities: users, workers, businesses, business_staff, worker_profiles, business_profiles, bookings, orders, order_items, notifications, reviews, ratings, verification_requests, audit_logs. Foreign keys enforce relationships; index mobile_number, profession, business_category, service_area (and other frequently-filtered columns). Full DDL lives in `docs/database.md` / `database/migrations/`.

## Future Microservices Migration

When a module needs independent scaling (e.g., Notifications or Search under load), extract it because:

- It already exposes a clean service-layer interface.
- It owns its own tables/repository (no cross-module direct queries).
- Its inter-module calls are already abstracted, so they become network calls (REST/queue) instead of in-process calls with minimal contract change.

No module should ever query another module's tables directly — this is the rule that keeps the split cheap later.
