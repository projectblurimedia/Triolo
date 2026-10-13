-- Your Problems jobs now run on Quick Book's trip flow. When a worker accepts a problem, an
-- already-accepted booking_requests row is created for it (map, live tracking, arrival PIN,
-- work done, rating), and the two rows point at each other. Each module writes only its own
-- side: problems owns problem_posts.booking_request_id, bookings owns
-- booking_requests.problem_post_id / quotation_amount.

ALTER TABLE booking_requests
  -- Set for a trip started from an accepted problem (Quick Book broadcasts leave it NULL).
  ADD COLUMN problem_post_id UUID REFERENCES problem_posts(id) ON DELETE SET NULL,
  -- The problem's agreed quotation, shown on both trip screens.
  ADD COLUMN quotation_amount INTEGER;

ALTER TABLE problem_posts
  ADD COLUMN booking_request_id UUID REFERENCES booking_requests(id) ON DELETE SET NULL;

-- Worker reviews (GET /reviews/...) read finished, rated jobs per worker from both tables.
CREATE INDEX idx_booking_requests_worker_reviews
  ON booking_requests (accepted_worker_id, completed_at DESC) WHERE status = 'completed';
CREATE INDEX idx_problem_posts_worker_reviews
  ON problem_posts (accepted_worker_id, completed_at DESC) WHERE status = 'completed';
