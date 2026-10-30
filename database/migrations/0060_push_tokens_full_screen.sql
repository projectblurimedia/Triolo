-- A partner app build that can show a full-screen pop-up for a new job / order (even when the
-- app is closed) says so when it registers its token; such phones get those requests as data
-- messages the app turns into the pop-up. Older builds keep getting a normal notification.
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS full_screen BOOLEAN NOT NULL DEFAULT false;
