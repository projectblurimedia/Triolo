-- Owned by the `notifications` module, not `auth`/`accounts` — a push token exists purely
-- to let this module reach a device, so it belongs with the thing that sends notifications,
-- not the account record itself (keeps this module self-contained: no cross-module reach
-- into `accounts` needed to send a push). One row per account (last-registered device wins)
-- — deliberately no multi-device support yet, not asked for and adds real complexity
-- (fan-out sends, per-device delivery tracking) for no current benefit.
CREATE TABLE push_tokens (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
