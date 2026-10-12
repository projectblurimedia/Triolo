-- Post a Problem gained a Location field (GPS-detected or typed). Nullable at the DB level
-- since the column is added to an existing table; the API requires it for every new post.
ALTER TABLE problem_posts ADD COLUMN location_address TEXT;
