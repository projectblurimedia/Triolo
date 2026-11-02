-- Deleting an account (asked for by the person): it stops at once and is kept 30 days, then its
-- personal details are wiped (name, number, email, place, photo) — orders and jobs other people
-- were part of stay, showing "Deleted user".
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_accounts_deletion ON accounts (deletion_requested_at) WHERE deletion_requested_at IS NOT NULL AND deleted_at IS NULL;

-- An order's list photos / voice message and its bill photos / voice message are removed 30 days
-- after the order ended; this says when (the apps explain the gap).
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS media_deleted_at timestamptz;
