# Product Specification (MVP)

Consolidated functional specification for the platform: Authentication, Worker Module, Business Module, and Admin Module. This is the source of truth for business logic — keep it synchronized with implementation.

---

## 1. Authentication & Account Types

### Account Types

- **User** — no verification required, immediately active after registration.
- **Worker** — two-stage registration, `pending_verification` until admin approval.
- **Business** — two-stage registration, `pending_verification` until admin approval.

### Registration (all types, Stage 1)

Full Name → Mobile Number → OTP Verification → account created → JWT issued.

### Worker Registration (Stage 2 — Professional Profile)

Profession, Experience, Skills, Service Areas, Working Hours, Address, Identity Documents, Profile Photo, optional Portfolio Photos → status `Pending Verification` → invisible in search until approved.

### Business Registration (Stage 2 — Business Profile)

Business Name, Category, Owner Name, Address, Village/Town, Working Hours, Weekly Holiday, Delivery Availability (Y/N), Contact Info, Verification Documents, Shop Photos → status `Pending Verification` → invisible in search until approved.

### Business Staff

- One Owner per business; Owner invites Staff.
- Staff permissions (configurable): View Orders, Accept Orders, Review Shopping Lists, Update Order Status, Verify Customer PIN, Mark Delivery Completed.
- Owner has full control. All staff share one dashboard with real-time synced updates.

### Login

Mobile number + OTP → system detects account type (User/Worker/Business) → routes to the correct dashboard.

### Authorization Roles

`user`, `worker`, `business_owner`, `business_staff`, `admin` (admin sub-roles planned post-MVP — see Section 4).

---

## 2. Worker Module

### Worker Profile Fields

Profession, skills/services, years of experience, service description, village/town + service areas, working hours, availability status, profile photo, ID documents, optional work photos, contact number.

### Worker Dashboard

Availability toggle, new service requests, active/upcoming/completed jobs, ratings & reviews, notifications, profile management, job history.

### Availability States

- **Online** — receives new requests.
- **Busy** — hidden from new requests.
- **Offline** — receives nothing.

Only **verified + online** workers can receive broadcast requests.

### Worker Discovery — Two Modes

1. **Broadcast Search**: user requests a service → notification sent to matching verified/online workers in the user's village/area → workers get a configurable response window (e.g. 1–2 min) → if none accept, search radius expands to nearby villages/towns, repeating until accepted or a max distance is reached.
2. **Manual Search**: user browses worker profiles directly (skills, experience, ratings, reviews, service areas, availability) and contacts/books directly.

### Booking Flow

```
Requested → Accepted → Customer Confirmed → Worker Traveling → Arrived
  → PIN Verified → Work Started → Work Completed → Payment Completed
  → Rated → Closed
```

1. User submits request → eligible workers notified.
2. Worker accepts → user gets worker details → phone contact via device dialer.
3. User confirms booking in-app → unique in-app verification PIN generated.
4. Worker travels; on arrival asks customer for the PIN.
5. Customer reads PIN from app; worker enters it; backend verifies.
   - Correct → status → `Work Started` / `Verified On-site`.
   - Incorrect → no status change; retry within configured limit.
6. Worker marks job completed → user reviews, pays (cash/external UPI in MVP), rates (1–5) and reviews.

### Cancellation Rules

- Before worker accepts: user may cancel freely.
- After accept, before arrival: cancellable per platform rules (to be finalized — see project-context "Open Questions").
- After PIN verification: booking is active; no in-app cancellation except exceptional admin action.

### Worker Search Eligibility

Must be: verified, online, profession matches request, service area matches user location. No acceptance within window → radius auto-expands.

---

## 3. Business Module

### Business Dashboard

New / Preparing / Packed / Ready-for-Pickup / Out-for-Delivery / Completed / Cancelled orders, notifications, profile, staff management, order history.

### Business Search

Users search by category (Grocery, Medical, Hardware, Bakery, Electrical, Vegetable, etc.); results show name, area/distance, hours, open/closed, ratings, reviews, contact, delivery availability. Village/town based, not GPS.

### Shopping List Workflow

User builds a list (item + quantity) → selects a nearby business → sends list → business reviews **every item**, marking each:

- **Available**
- **Partially Available**
- **Out of Stock**

User is notified of the review outcome including unavailable/partial items.

### Order Status Flow

```
New Order → Review Started → Preparing → Packed
  → (Ready for Pickup | Out for Delivery) → PIN Verified → Completed
```

### Cancellation Rules

- User may cancel **only before** `Review Started`.
- Once review starts, in-app customer cancellation is disabled. Customer must contact the business directly; **only the Business Owner or authorized Staff** can cancel from that point.

### Pickup Workflow

Business marks `Ready for Pickup` → backend generates unique **Pickup PIN** → customer visits shop → owner/staff requests PIN → customer reads PIN from app → staff enters it → backend verifies → order → `Completed`.

### Door Delivery Workflow

Business assigns delivery to owner/staff → `Out for Delivery` → delivery person reaches customer → customer provides **Delivery PIN** → entered by delivery person → backend verifies → `Delivered` → `Completed`.

### Verification PIN Rules (shared with Worker Module)

Random, unique, single-use, per-booking/per-order, backend-generated, free, stored securely. Never SMS OTP for verification.

### Ratings & Reviews

After completion, customer rates and reviews the business; average rating shown publicly.

### Business Search Eligibility

Verified, active, open (optional filter), category matches, village/service area matches.

---

## 4. Admin Module

### Purpose

Internal-only control system: platform safety, verification, user/worker/business management, complaints, announcements, fraud prevention, growth monitoring. Not accessible to normal users.

### Admin Auth

Mobile/email + password or OTP, JWT session, role-based authorization. Only authenticated admins reach the dashboard.

### Dashboard Metrics

Total users/workers/businesses, pending worker/business verifications, active/completed jobs and orders, complaints, daily registrations/active users.

### User Management

View/search users, view booking/order/complaint history, send warnings, suspend (temporary), block (permanent), restore.

### Worker Management

Review registration & documents, approve/reject/request-resubmission, suspend/block/restore, view completed jobs/ratings/complaints. Only approved workers are searchable.

### Business Management

Review registration & documents, approve/reject, suspend/block/restore, view staff, monitor performance and complaints. Only verified businesses are searchable.

### Complaint Management

```
Complaint Received → Review Complaint → Review Evidence
  → Contact Involved Parties (if needed) → Decision
  → Warning / Suspension / Rejection / Closure
```

All actions recorded.

### Warning System

Sendable to Users/Workers/Businesses; appears in notification center; repeated warnings may escalate to suspension/blocking.

### Suspension & Blocking

- **Temporary suspension**: investigation in progress, document issues, repeated complaints.
- **Permanent block**: fraud, fake identity, serious violations, repeated abuse.
- Blocked accounts cannot log in until restored by an authorized admin.

### Announcements

Targetable to: All Users / Only Workers / Only Businesses / Specific Villages / Specific Towns / Specific Categories. Delivered via push + in-app notification center.

### Verification Queues

Separate queues for Worker and Business verification, each showing submitted documents, registration info, current status. Actions: Approve / Reject / Request Resubmission. History retained.

### Order & Booking Monitoring

Visibility into active/completed/cancelled/failed bookings and orders — monitor only, don't interfere unless required.

### Platform Analytics

Daily/monthly registrations, active workers/businesses, completed jobs/orders, most-searched professions/categories.

### Audit Logs

Every admin action recorded immutably: timestamp, action, target, reason. Never editable.

### Future Admin Roles (not MVP)

Super Admin, Operations Admin, Verification Admin, Support Admin, Finance Admin — role-based permission system designed to support this without rework.

---

## 5. Cross-Cutting Rules

- Workers/Businesses invisible in search until verified.
- Every booking and every order generates its own unique, single-use, backend-generated PIN — never SMS OTP.
- Cancellation locks once business review (orders) or PIN verification (bookings) begins; only business/admin can act past that point.
- Business staff operate on one shared, real-time-synced dashboard with permission-scoped actions.
- Location is village/town-based for MVP; architecture must allow GPS to be added later without redesigning search, booking, or order logic.
- UI must support English and Telugu from launch.

## 6. Notifications Summary

| Recipient | Events |
|---|---|
| User | Worker accepted, worker arrival, order received/reviewed, items unavailable, packed, ready for pickup, out for delivery, completed, business cancellation, admin announcements |
| Worker | New nearby requests, booking confirmations, customer cancellation (pre-work), verification/profile status, admin announcements |
| Business | New shopping list, customer cancellation (pre-review), pickup confirmation, delivery updates, staff updates, verification status, admin announcements |

## 7. Future Enhancements (explicitly out of MVP scope)

Live GPS tracking, in-app chat, digital wallet, online payments, worker earnings dashboard, service scheduling, emergency requests, subscriptions, featured listings, product catalog/inventory, barcode scanning, stock alerts, coupons, GST billing/invoicing, delivery-partner assignment, multi-role admin, fraud detection, AI analytics, support ticketing.
