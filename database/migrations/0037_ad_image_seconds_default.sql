-- An image ad shows for 15 seconds by default (was 5) before it can be closed.
ALTER TABLE ads ALTER COLUMN display_seconds SET DEFAULT 15;
