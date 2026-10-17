-- A customer's own profile photo (user-app registration and Edit Profile). Worker and shop
-- photos live on their own profiles (migration 0027); this one belongs to the account itself.
ALTER TABLE accounts ADD COLUMN profile_photo_url TEXT;
