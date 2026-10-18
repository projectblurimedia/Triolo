-- A video shrunk in the admin's browser before upload can come out a fraction of a second
-- longer than the original, so a 30-second ad is allowed up to 31 seconds.
ALTER TABLE ads DROP CONSTRAINT ads_video_seconds_check;
ALTER TABLE ads ADD CONSTRAINT ads_video_seconds_check CHECK (video_seconds IS NULL OR video_seconds <= 31);
