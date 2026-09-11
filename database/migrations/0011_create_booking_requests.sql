-- Quick Book broadcast booking — first slice of the Worker module's booking remainder
-- (Pending Module 4). A user requests one or more skills; every verified worker within
-- `radius_km` who has ALL of those skills (array containment, not overlap) gets a
-- `booking_offers` row + a push notification. Whoever accepts first wins — `acceptOffer`
-- (see bookings/repository.ts) atomically flips the request to 'accepted' and every other
-- still-pending offer to 'lost' in one transaction, so exactly one worker can ever win a
-- given request regardless of how many accept-taps race each other. No PIN verification,
-- cancellation, or full status pipeline yet — that's still pending, see
-- .cloud/project-context.md.
CREATE TYPE booking_request_status AS ENUM ('broadcasting', 'accepted');
CREATE TYPE booking_offer_status AS ENUM ('pending', 'accepted', 'lost');

CREATE TABLE booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  skill_categories worker_skill_category[] NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_km NUMERIC NOT NULL,
  status booking_request_status NOT NULL DEFAULT 'broadcasting',
  accepted_worker_id UUID REFERENCES worker_profiles(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_requests_account ON booking_requests (account_id, created_at DESC);

-- One row per invited worker — lets the accept-race be resolved atomically (see above) and
-- lets a worker's pending-offers list (partner-app's Bookings tab) be queried directly by
-- worker_id/status instead of re-deriving eligibility every poll.
CREATE TABLE booking_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  status booking_offer_status NOT NULL DEFAULT 'pending',
  distance_meters DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_request_id, worker_id)
);

CREATE INDEX idx_booking_offers_worker_status ON booking_offers (worker_id, status);
CREATE INDEX idx_booking_offers_request ON booking_offers (booking_request_id);
