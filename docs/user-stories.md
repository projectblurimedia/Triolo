# User Stories & Acceptance Criteria

## Authentication

**US-1** As a new user, I can register with my name, mobile number, and OTP so I can access the platform.
- AC: Invalid/expired OTP is rejected with a clear error. Duplicate mobile number registration is rejected (409).

**US-2** As a worker, I can complete a professional profile after basic registration so I can eventually appear in search.
- AC: Profile is incomplete → status stays `incomplete`; complete + submitted → status becomes `pending_verification`; worker is not returned by any search endpoint in this state.

**US-3** As a business owner, I can complete a business profile so I can start receiving shopping lists once verified.
- AC: Same pending/verified gating as US-2, scoped to businesses.

**US-4** As any account holder, I can log in with mobile + OTP and land on the dashboard matching my account type.
- AC: Wrong OTP rejected; correct OTP + valid account routes to User, Worker, or Business dashboard respectively.

## Worker Discovery & Booking

**US-5** As a user, I can broadcast a service request so nearby verified workers are notified.
- AC: Only verified + online workers matching profession + area receive the notification; radius expands automatically if nobody accepts within the configured window.

**US-6** As a user, I can manually browse and filter worker profiles.
- AC: Filters include profession, rating, experience, availability; unverified workers never appear.

**US-7** As a worker, I can accept a request and have the customer confirm the booking.
- AC: Accepting generates a single-use PIN tied to that booking only.

**US-8** As a worker, I verify my arrival using the customer's PIN.
- AC: Correct PIN transitions status to Work Started; incorrect PIN leaves status unchanged and counts against a retry limit.

**US-9** As a user, I can rate and review a worker after job completion.
- AC: Rating only allowed once per completed booking; average recalculated and shown on the worker's public profile.

## Business Ordering

**US-10** As a user, I can send a shopping list to a nearby business.
- AC: List requires at least one item; business receives it with status `New Order`.

**US-11** As a business, I can review each item and mark it Available / Partial / Out of Stock.
- AC: Marking any item transitions the order to `Review Started`; user is notified with the full breakdown.

**US-12** As a user, I can cancel my order only before review starts.
- AC: Cancellation attempt after `Review Started` is rejected by the API with a clear message directing the customer to contact the business.

**US-13** As a business owner/staff, I can cancel an order after review has started.
- AC: Only `business_owner`/`business_staff` roles (with permission) can perform this; action is audit-logged.

**US-14** As a user, I provide a PIN to confirm pickup or delivery.
- AC: Pickup and delivery PINs are distinct and single-use; verification failure does not change order status.

## Admin

**US-15** As an admin, I can approve or reject worker/business verification requests.
- AC: Rejection requires a reason; approved accounts become searchable immediately; rejected accounts are notified with the reason.

**US-16** As an admin, I can suspend, block, or restore any account.
- AC: Blocked accounts cannot authenticate; every action is recorded in the audit log with actor, target, timestamp, reason.

**US-17** As an admin, I can send a targeted announcement.
- AC: Announcement reaches only the selected audience (role/village/town/category) via push + in-app notification center.

## Localization

**US-18** As a user, I can switch the app language between English and Telugu from settings.
- AC: All screens reflect the selected language without requiring app restart or re-login; preference persists across sessions.
