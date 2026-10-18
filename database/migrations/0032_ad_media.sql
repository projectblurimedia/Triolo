-- Ads can carry up to 4 images and one video (played muted first, then the images as a
-- carousel). When an ad ends or is deleted its media is removed from Cloudinary and these
-- columns are cleared (media_cleared_at); the ad itself stays in the history with its bill.

ALTER TABLE ads
  ADD COLUMN image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN video_url TEXT,
  ADD COLUMN media_cleared_at TIMESTAMPTZ;

UPDATE ads SET image_urls = ARRAY[image_url] WHERE image_url IS NOT NULL;
ALTER TABLE ads DROP COLUMN image_url;

ALTER TABLE ads ADD CONSTRAINT ads_at_most_four_images CHECK (cardinality(image_urls) <= 4);
