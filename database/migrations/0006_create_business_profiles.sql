-- Business is the same additive-capability pattern as worker_profiles (see that
-- migration's comment). This table's own `id` serves as the business's distinct
-- identifier (business_id).
CREATE TYPE business_shop_category AS ENUM (
  'grocery', 'restaurant', 'pharmacy', 'electronics', 'clothing', 'hardware', 'salon', 'other'
);

CREATE TABLE business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  shop_category business_shop_category NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_address TEXT,
  shop_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  verification_status profile_verification_status NOT NULL DEFAULT 'pending_verification',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_profiles_shop_category ON business_profiles (shop_category);
