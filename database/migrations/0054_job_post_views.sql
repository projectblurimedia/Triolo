-- How many times customers opened a job post (the partner sees it as "profile visits").
ALTER TABLE job_seeker_posts ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
