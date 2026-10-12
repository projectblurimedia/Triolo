-- Your Problems → job flow. A verified worker whose skills match and who is within range
-- sees an open problem on partner-app's Home and can accept it (first accept wins — the
-- `UPDATE ... WHERE status = 'open'` row lock guarantees exactly one winner, same pattern as
-- Quick Book). Then: the worker marks the work done, and the customer confirms it finished
-- (the customer can also confirm straight from 'accepted' if the worker forgets).
--   open → accepted → work_done → completed
-- 'closed' (from 0013) stays in the enum unused; Postgres can't drop enum values cheaply.
ALTER TYPE problem_post_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE problem_post_status ADD VALUE IF NOT EXISTS 'work_done';
ALTER TYPE problem_post_status ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE problem_posts
  ADD COLUMN accepted_worker_id UUID REFERENCES worker_profiles(id) ON DELETE SET NULL,
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD COLUMN work_done_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ;

CREATE INDEX idx_problem_posts_status ON problem_posts (status, created_at DESC);
CREATE INDEX idx_problem_posts_accepted_worker ON problem_posts (accepted_worker_id, created_at DESC);
