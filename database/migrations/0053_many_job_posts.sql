-- A partner can keep more than one "looking for work" post (e.g. a teacher who also cooks),
-- each published (and paid for) on its own. The one-post-per-account rule goes; posts are
-- listed per account, oldest first.
ALTER TABLE job_seeker_posts DROP CONSTRAINT IF EXISTS job_seeker_posts_account_id_key;
CREATE INDEX IF NOT EXISTS idx_job_seeker_posts_account ON job_seeker_posts (account_id, created_at);
