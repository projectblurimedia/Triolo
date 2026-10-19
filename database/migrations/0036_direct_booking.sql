-- Book a particular worker: a customer opens a worker's profile and sends the request to that
-- worker only (instead of every worker nearby). It is the same booking from then on — accept,
-- trip, PIN, rating — but only the named worker can see or accept it, it stays open longer
-- than a Quick Book broadcast, and the worker declining it ends it (the customer is told).

ALTER TABLE booking_requests
  ADD COLUMN target_worker_id UUID REFERENCES worker_profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_booking_requests_target_worker ON booking_requests (target_worker_id)
  WHERE target_worker_id IS NOT NULL;
