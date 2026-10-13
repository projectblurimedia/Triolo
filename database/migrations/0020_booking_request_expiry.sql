-- A Quick Book broadcast that no worker accepts within a few minutes ends as 'expired'
-- (it used to stay 'broadcasting' forever — still "finding a worker" days later, and still
-- offered to workers). Expiry is applied lazily by the bookings repository whenever
-- bookings are read or accepted; see BROADCAST_TTL_MINUTES in bookings/interfaces.ts.
ALTER TYPE booking_request_status ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE booking_requests ADD COLUMN expired_at TIMESTAMPTZ;

-- Keeps the lazy "expire stale broadcasts" update cheap.
CREATE INDEX idx_booking_requests_broadcasting ON booking_requests (created_at) WHERE status = 'broadcasting';
