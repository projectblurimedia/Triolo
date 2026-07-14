# Software Requirements Specification (SRS)

## 1. Purpose

Defines functional and non-functional requirements for the MVP local-services marketplace platform (Users, Workers, Businesses, Admin). Derived from `docs/product-specification.md`.

## 2. Scope

Mobile app (React Native) for Users/Workers/Businesses; backend API (Node/Express); admin panel (web, backend-shared). MVP region: Telugu-speaking states. Language: English + Telugu.

## 3. Functional Requirements

### FR-1 Authentication
- FR-1.1 Any account registers with Full Name, Mobile Number, OTP.
- FR-1.2 Workers/Businesses complete a mandatory Stage 2 profile before becoming searchable.
- FR-1.3 Login via mobile + OTP; system routes to the correct dashboard by account type.
- FR-1.4 JWT access token + refresh token issued on successful auth.

### FR-2 Worker Discovery & Booking
- FR-2.1 Broadcast search notifies matching verified/online workers within an expanding radius.
- FR-2.2 Manual search allows filtering by profession, ratings, experience, availability.
- FR-2.3 Booking progresses through the defined status pipeline (Requested → Closed).
- FR-2.4 Arrival requires backend-generated single-use PIN verification.
- FR-2.5 Users rate and review workers after job completion.

### FR-3 Business Ordering
- FR-3.1 Users submit a free-text shopping list to a selected business.
- FR-3.2 Business marks each item Available / Partially Available / Out of Stock.
- FR-3.3 Order proceeds through New → Review Started → Preparing → Packed → (Pickup|Delivery) → Completed.
- FR-3.4 Pickup and Delivery each require their own backend-generated PIN verification.
- FR-3.5 Cancellation is user-initiated only before Review Started; business/admin-initiated after.

### FR-4 Admin
- FR-4.1 Admin verifies/rejects Worker and Business registrations.
- FR-4.2 Admin manages user/worker/business lifecycle: warn, suspend, block, restore.
- FR-4.3 Admin manages complaints end-to-end.
- FR-4.4 Admin sends targeted announcements.
- FR-4.5 All admin actions are recorded in an immutable audit log.

### FR-5 Notifications
- FR-5.1 Push notifications (FCM) for all events listed in `docs/product-specification.md` §6.

### FR-6 Localization
- FR-6.1 UI provides a language setting supporting English and Telugu; switch applies without requiring re-login.

## 4. Non-Functional Requirements

- **NFR-1 Performance**: API responses for search/booking endpoints should target <500ms under MVP load.
- **NFR-2 Scalability**: Modular monolith with clean module boundaries; no cross-module direct DB access, enabling future microservice extraction.
- **NFR-3 Security**: All protected endpoints require JWT; role-based authorization; input validated at API boundary; PINs/tokens never logged.
- **NFR-4 Availability**: Target standard commercial availability for MVP (no formal SLA yet); errors degrade gracefully, not silently.
- **NFR-5 Maintainability**: Feature-based module structure; documentation updated alongside every feature.
- **NFR-6 Localization readiness**: All user-facing strings externalized for translation from day one, not retrofitted.
- **NFR-7 Low infrastructure cost**: MVP infra choices favor low operating cost over premature scale (see `docs/deployment.md`).

## 5. Constraints

- No live GPS in MVP (village/town area matching only).
- No SMS OTP for service-completion verification (PIN only).
- No in-app payments in MVP (cash/external UPI only).

## 6. Out of Scope (MVP)

See `docs/product-specification.md` §7 (Future Enhancements).
