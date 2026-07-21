-- Workers and businesses can have more than one skill/category, and need a free-text
-- description when "other" is picked (no fixed category fits). Also adds delivery
-- pricing to business_profiles (already outlined in docs/database.md's original
-- "Planned Tables" sketch: "delivery_available bool").
ALTER TABLE worker_profiles
  ADD COLUMN skill_categories worker_skill_category[] NOT NULL DEFAULT '{}',
  ADD COLUMN other_skill_description TEXT;

UPDATE worker_profiles SET skill_categories = ARRAY[skill_category] WHERE skill_category IS NOT NULL;

ALTER TABLE worker_profiles DROP COLUMN skill_category;

ALTER TABLE business_profiles
  ADD COLUMN shop_categories business_shop_category[] NOT NULL DEFAULT '{}',
  ADD COLUMN other_category_description TEXT,
  ADD COLUMN delivery_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN delivery_price_per_km DOUBLE PRECISION;

UPDATE business_profiles SET shop_categories = ARRAY[shop_category] WHERE shop_category IS NOT NULL;

ALTER TABLE business_profiles DROP COLUMN shop_category;

DROP INDEX IF EXISTS idx_worker_profiles_skill_category;
CREATE INDEX idx_worker_profiles_skill_categories ON worker_profiles USING GIN (skill_categories);

DROP INDEX IF EXISTS idx_business_profiles_shop_category;
CREATE INDEX idx_business_profiles_shop_categories ON business_profiles USING GIN (shop_categories);
