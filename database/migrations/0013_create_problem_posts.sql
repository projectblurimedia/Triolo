-- "Post a Problem" (user-app → Services menu) — a user describes a non-emergency issue with
-- up to 5 photos, the kind(s) of worker it needs, and the price they're offering
-- (`quotation_amount`, whole rupees). Saved only for now — showing open posts to nearby
-- workers (so they can accept) is the follow-up slice; `latitude`/`longitude` are captured
-- best-effort now so that radius matching can build on them without another migration.
CREATE TYPE problem_post_status AS ENUM ('open', 'closed');

CREATE TABLE problem_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  skill_categories worker_skill_category[] NOT NULL,
  description TEXT,
  quotation_amount INTEGER NOT NULL CHECK (quotation_amount > 0),
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status problem_post_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_problem_posts_account ON problem_posts (account_id, created_at DESC);
CREATE INDEX idx_problem_posts_skill_categories ON problem_posts USING GIN (skill_categories);
