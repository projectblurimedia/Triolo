-- What tapping an ad does. 'none' = the ad just promotes; 'link' opens link_url; 'location'
-- shows directions to action_latitude/longitude (named action_place); 'service' / 'business' /
-- 'job_post' open a Triolo profile (promoted_id = the worker profile, shop profile or job post)
-- with Book Now / Order from this Shop / Contact. promoted_name is the profile's name when the
-- ad was saved; promote_mobile is the phone number the admin typed to find it (kept to refill
-- the form). Earlier ads that had a link become 'link' ads.

ALTER TABLE ads
  ADD COLUMN action_type TEXT NOT NULL DEFAULT 'none'
    CHECK (action_type IN ('none', 'link', 'location', 'service', 'business', 'job_post')),
  ADD COLUMN action_latitude DOUBLE PRECISION,
  ADD COLUMN action_longitude DOUBLE PRECISION,
  ADD COLUMN action_place TEXT,
  ADD COLUMN promoted_id UUID,
  ADD COLUMN promoted_name TEXT,
  ADD COLUMN promote_mobile TEXT;

UPDATE ads SET action_type = 'link' WHERE link_url IS NOT NULL;
