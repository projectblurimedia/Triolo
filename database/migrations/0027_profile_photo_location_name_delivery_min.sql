-- Worker/shop registration changes:
-- * A profile photo (the worker's face / the shop's logo), uploaded in its own request.
-- * Location is picked only from GPS or a map pin now. The full reverse-geocoded address is
--   still stored (area, city, district, state, pincode) but may be missing for a spot the
--   geocoder knows little about, so those columns become nullable. `location_name` is the
--   place name people see (the village / town / locality) — never the pincode or a code.
-- * Shops that deliver set a minimum delivery charge as well as a price per km.
ALTER TABLE worker_profiles
  ADD COLUMN location_name TEXT,
  ADD COLUMN profile_photo_url TEXT,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN district DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN pincode DROP NOT NULL;

ALTER TABLE business_profiles
  ADD COLUMN location_name TEXT,
  ADD COLUMN profile_photo_url TEXT,
  ADD COLUMN delivery_min_charge NUMERIC(10, 2),
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN district DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN pincode DROP NOT NULL;

UPDATE worker_profiles SET location_name = city WHERE location_name IS NULL;
UPDATE business_profiles SET location_name = city WHERE location_name IS NULL;
