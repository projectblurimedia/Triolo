-- One push token per account *per app*. The user app and the partner app are separate apps
-- with separate device tokens; with one row per account, whichever app was opened last
-- replaced the other's token, so a worker's job offers could be sent to their user app
-- (which can't show them) and never reach the partner app.
--
-- app: 'user' | 'partner', or 'legacy' for rows registered before the apps sent it (used
-- only as a fallback; replaced as soon as that device registers again with its app).
ALTER TABLE push_tokens ADD COLUMN app TEXT NOT NULL DEFAULT 'legacy'
  CHECK (app IN ('user', 'partner', 'legacy'));
ALTER TABLE push_tokens DROP CONSTRAINT push_tokens_pkey;
ALTER TABLE push_tokens ADD PRIMARY KEY (account_id, app);
-- A device token belongs to whoever logged in on that phone last.
CREATE INDEX idx_push_tokens_token ON push_tokens (token);
