-- Quick Orders can ask for a shop kind a shop typed itself (e.g. "Fancy"), not only the fixed
-- kinds: those names are kept here and matched against business_profiles.other_category_description.
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS custom_categories TEXT[] NOT NULL DEFAULT '{}';

-- A delivery staff member's name as the owner typed it, per shop. The number may even be the
-- owner's own (so the OTP comes to the owner); the name shown is still the one typed here.
ALTER TABLE shop_staff ADD COLUMN IF NOT EXISTS full_name TEXT;
