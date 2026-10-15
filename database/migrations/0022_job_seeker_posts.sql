-- Job seekers: people looking for regular work (a home cook, a tutor, a driver, a nanny…)
-- rather than one-off service jobs. A partner posts what they do, their expected pay
-- (per day or per month), skills and experience; customers search nearby posts and call.
--
-- One post per account. Posts go live immediately (no admin review); the poster can hide
-- one (is_active = false) without deleting it.

CREATE TYPE job_seeker_category AS ENUM (
  'teacher', 'cook', 'housekeeper', 'nanny', 'elder_care', 'driver',
  'security_guard', 'gardener', 'office_assistant', 'shop_assistant', 'other'
);
CREATE TYPE job_seeker_pay_period AS ENUM ('daily', 'monthly');
CREATE TYPE job_seeker_availability AS ENUM ('full_time', 'part_time', 'live_in');

CREATE TABLE job_seeker_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  category job_seeker_category NOT NULL,
  -- What they call themselves, e.g. "Maths & Science Tutor", "South Indian home cook".
  title TEXT NOT NULL,
  pay_amount INTEGER NOT NULL CHECK (pay_amount > 0),
  pay_period job_seeker_pay_period NOT NULL,
  availability job_seeker_availability NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  skills TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  -- GPS is required so the post shows up in nearby search.
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_address TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_seeker_posts_active ON job_seeker_posts (category) WHERE is_active;
