-- Replaces the single free-text `location_address` column on worker_profiles/business_profiles
-- with structured fields — a plain manual address string wasn't precise enough (no reliable
-- way to filter/search by city/district/pincode from free text), per explicit product
-- decision. `area` (locality/landmark) stays optional; city/district/state/pincode are
-- required going forward. Existing rows are wiped rather than migrated (explicit product
-- decision) — there's no reliable way to split old free-text addresses into these fields
-- automatically, and this is still pre-launch test data.
TRUNCATE worker_profiles, business_profiles;

ALTER TABLE worker_profiles
  DROP COLUMN location_address,
  ADD COLUMN area TEXT,
  ADD COLUMN city TEXT NOT NULL,
  ADD COLUMN district TEXT NOT NULL,
  ADD COLUMN state TEXT NOT NULL,
  ADD COLUMN pincode TEXT NOT NULL CHECK (pincode ~ '^[0-9]{6}$');

ALTER TABLE business_profiles
  DROP COLUMN location_address,
  ADD COLUMN area TEXT,
  ADD COLUMN city TEXT NOT NULL,
  ADD COLUMN district TEXT NOT NULL,
  ADD COLUMN state TEXT NOT NULL,
  ADD COLUMN pincode TEXT NOT NULL CHECK (pincode ~ '^[0-9]{6}$');

-- Area-based search (see docs/architecture "Search Architecture") will filter on these.
CREATE INDEX idx_worker_profiles_city ON worker_profiles (city);
CREATE INDEX idx_worker_profiles_pincode ON worker_profiles (pincode);
CREATE INDEX idx_business_profiles_city ON business_profiles (city);
CREATE INDEX idx_business_profiles_pincode ON business_profiles (pincode);
