-- Quick Book becomes a full Rapido-style trip once a worker accepts:
--   broadcasting → accepted → on_the_way (worker tapped Start Trip, live location shared)
--   → arrived → in_progress (worker entered the customer's 4-digit PIN) → work_done
--   → completed (customer confirms, with a 1–5 star rating and optional feedback)
-- The customer can cancel any time before the PIN is verified ('cancelled'); after that the
-- job is locked in, per the product rule that cancellation locks once PIN verification
-- begins.
ALTER TYPE booking_request_status ADD VALUE IF NOT EXISTS 'on_the_way';
ALTER TYPE booking_request_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE booking_request_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE booking_request_status ADD VALUE IF NOT EXISTS 'work_done';
ALTER TYPE booking_request_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE booking_request_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE booking_requests
  -- The customer's address, reverse-geocoded on their device when booking (display only).
  ADD COLUMN location_address TEXT,
  -- Generated when a worker accepts. Kept readable (not hashed) because the customer must be
  -- able to see it again at any time until the worker arrives; it is only ever returned to
  -- the customer, never to the worker, is single-use (cleared the moment it's verified), and
  -- allows at most 5 wrong attempts.
  ADD COLUMN arrival_pin TEXT,
  ADD COLUMN pin_attempts INTEGER NOT NULL DEFAULT 0,
  -- The accepted worker's latest position while travelling — the latest point only, no history.
  ADD COLUMN worker_latitude DOUBLE PRECISION,
  ADD COLUMN worker_longitude DOUBLE PRECISION,
  ADD COLUMN worker_location_at TIMESTAMPTZ,
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN arrived_at TIMESTAMPTZ,
  ADD COLUMN pin_verified_at TIMESTAMPTZ,
  ADD COLUMN work_done_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN worker_rating SMALLINT CHECK (worker_rating BETWEEN 1 AND 5),
  ADD COLUMN worker_review TEXT;

-- A worker's jobs (active + history): partner-app's Bookings tab.
CREATE INDEX idx_booking_requests_accepted_worker ON booking_requests (accepted_worker_id, created_at DESC);

-- Each trip step is saved as an in-app notification for the other person, as well as pushed.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_on_the_way';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_arrived';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_work_done';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_cancelled';
