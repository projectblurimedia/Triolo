-- Worker is now an optional capability a `user` account adds, not an exclusive role
-- chosen at registration (see .cloud/project-context.md "Planned Next" -> now landed).
-- This table's own `id` serves as the worker's distinct identifier (worker_id).
CREATE TYPE worker_skill_category AS ENUM (
  'electrician', 'plumber', 'painter', 'carpenter', 'mechanic', 'cleaner', 'mason', 'other'
);

-- Shared by worker_profiles and business_profiles: the base account is active
-- immediately on registration, but a Worker/Business capability still needs admin
-- review before it's trustworthy to surface in search/booking.
CREATE TYPE profile_verification_status AS ENUM ('pending_verification', 'verified', 'rejected');

CREATE TABLE worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  skill_category worker_skill_category NOT NULL,
  experience_years INT NOT NULL DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_address TEXT,
  portfolio_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  verification_status profile_verification_status NOT NULL DEFAULT 'pending_verification',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_worker_profiles_skill_category ON worker_profiles (skill_category);
