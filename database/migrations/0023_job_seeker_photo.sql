-- A profile photo on a job seeker post (Cloudinary URL, uploaded separately from the post).
ALTER TABLE job_seeker_posts ADD COLUMN photo_url TEXT;
