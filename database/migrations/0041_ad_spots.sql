-- Ads only before key actions now: the full-screen ad when an app opens is gone (its switches
-- are turned off and no longer used). The admin chooses which actions show an ad
-- (action_spots: spot key → on/off; a spot not listed is on) and a minimum gap between two ads
-- for the same person (action_gap_minutes, 0 = no gap), tracked per account and app in
-- ad_viewer_state.

UPDATE ad_settings SET launch_user = false, launch_partner = false;

ALTER TABLE ad_settings
  ADD COLUMN action_spots JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN action_gap_minutes INT NOT NULL DEFAULT 0 CHECK (action_gap_minutes BETWEEN 0 AND 1440);

CREATE TABLE ad_viewer_state (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK (app IN ('user', 'partner')),
  last_action_ad_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (account_id, app)
);
