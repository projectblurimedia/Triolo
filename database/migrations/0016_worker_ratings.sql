-- Worker ratings. A customer gives the worker 1–5 stars (plus an optional short review) when
-- confirming a problem job finished. The individual rating lives on the job itself
-- (problem_posts — one rating per job, can't be repeated). The running total lives on
-- worker_profiles, owned by the workers module, so the nearby search can sort by rating
-- without the workers module ever reading the problems module's table — the problems service
-- calls WorkersService.recordRating() to update it.
ALTER TABLE problem_posts
  ADD COLUMN worker_rating SMALLINT CHECK (worker_rating BETWEEN 1 AND 5),
  ADD COLUMN worker_review TEXT;

ALTER TABLE worker_profiles
  ADD COLUMN rating_sum INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN rating_count INTEGER NOT NULL DEFAULT 0;
