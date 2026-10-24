-- Quick Book can ask for a partner-made skill (one a worker typed under "other"), matched against
-- worker_profiles.other_skill_description.
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS custom_skills TEXT[] NOT NULL DEFAULT '{}';
