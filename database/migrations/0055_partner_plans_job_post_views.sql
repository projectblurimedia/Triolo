-- Partner plans are bought per profile: one for services (a worker), one for a shop and one for
-- job posts, each with its own perks and prices. Older partner plans ('all') keep covering
-- everything until they end. Customer plans are 'all' too.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'all'
  CHECK (plan IN ('all', 'service', 'shop', 'job_post'));
DROP INDEX IF EXISTS idx_subscriptions_active;
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions (account_id, audience, plan, ends_at) WHERE status = 'active';

-- Prices per partner plan; until the admin sets them, each plan uses the old partner prices.
ALTER TABLE subscription_settings ADD COLUMN IF NOT EXISTS partner_plan_prices JSONB;

-- Every time a customer opens a job post (never the poster's own). seen_at: the poster opened
-- the post's views, so it no longer counts as new.
CREATE TABLE IF NOT EXISTS job_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES job_seeker_posts(id) ON DELETE CASCADE,
  viewer_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_job_post_views_post ON job_post_views (post_id, created_at DESC);

-- What a notification is about (a profile kind, or a job post with its id), so the app opens the
-- right thing and the server knows which plan reveals the viewer.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ref_kind TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ref_id UUID;
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'job_post_view';
