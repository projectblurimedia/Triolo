-- The minimum gap between two ads for the same person, in seconds (so 30 seconds or 1 minute
-- can be chosen). Replaces action_gap_minutes; the saved value carries over.

ALTER TABLE ad_settings
  ADD COLUMN action_gap_seconds INT NOT NULL DEFAULT 0 CHECK (action_gap_seconds BETWEEN 0 AND 86400);

UPDATE ad_settings SET action_gap_seconds = action_gap_minutes * 60;

ALTER TABLE ad_settings DROP COLUMN action_gap_minutes;
