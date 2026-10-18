-- Ads get a place (GPS point or a map pin) and are shown only to people within its radius
-- (5 km). The separate "phone for the Call button" is gone: the business phone is used.

UPDATE ads SET advertiser_phone = COALESCE(advertiser_phone, contact_phone);
ALTER TABLE ads DROP COLUMN contact_phone;

-- Nullable only for ads booked before this change (those keep showing everywhere).
ALTER TABLE ads
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION,
  ADD COLUMN radius_km NUMERIC(5, 1) NOT NULL DEFAULT 5;
