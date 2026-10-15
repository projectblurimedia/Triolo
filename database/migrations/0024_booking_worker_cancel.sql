-- Who cancelled a booking ('customer' or 'worker') and, for a worker, an optional reason.
-- A worker may cancel a job they accepted up to (not including) PIN verification.
ALTER TABLE booking_requests
  ADD COLUMN cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'worker')),
  ADD COLUMN cancel_reason TEXT;

-- Every cancellation before this migration came from the customer.
UPDATE booking_requests SET cancelled_by = 'customer' WHERE status = 'cancelled';
