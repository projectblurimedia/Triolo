-- Ads are now one piece of media — a single image or a single video — in a vertical (reel,
-- 9:16) or horizontal (16:9) format, always with a link. They show full screen when an app
-- opens and before key actions (no more Home card), and can be closed only after their time:
-- an image for `display_seconds` (default 5), a video for its length (at most 30 seconds).

ALTER TABLE ads
  ADD COLUMN orientation TEXT NOT NULL DEFAULT 'horizontal' CHECK (orientation IN ('vertical', 'horizontal')),
  ADD COLUMN display_seconds INTEGER NOT NULL DEFAULT 5 CHECK (display_seconds BETWEEN 3 AND 30),
  ADD COLUMN video_seconds NUMERIC(5, 1) CHECK (video_seconds IS NULL OR video_seconds <= 30.5);

ALTER TABLE ads DROP CONSTRAINT ads_at_most_four_images;
ALTER TABLE ads ADD CONSTRAINT ads_one_media CHECK (
  cardinality(image_urls) <= 1 AND NOT (cardinality(image_urls) = 1 AND video_url IS NOT NULL)
);

-- The Home card is gone; its switches now mean "before key actions".
ALTER TABLE ad_settings RENAME COLUMN home_user TO action_user;
ALTER TABLE ad_settings RENAME COLUMN home_partner TO action_partner;
