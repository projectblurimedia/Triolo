-- Accepting a job or an order is instant and free. What the partner owes comes after (unless
-- they're on the plan for that side): an ad while ads run there, else the one-time fee. Until
-- it's done (unlocked_at) the customer's number stays hidden; an accept left unpaid for a few
-- minutes is released to other partners again. NULL unlock_needed = nothing owed.
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS unlock_needed TEXT;
ALTER TABLE booking_requests DROP CONSTRAINT IF EXISTS booking_requests_unlock_needed_check;
ALTER TABLE booking_requests ADD CONSTRAINT booking_requests_unlock_needed_check CHECK (unlock_needed IN ('ad', 'pay'));
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
UPDATE booking_requests SET unlocked_at = accepted_at WHERE accepted_at IS NOT NULL AND unlocked_at IS NULL;

ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS unlock_needed TEXT;
ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS shop_orders_unlock_needed_check;
ALTER TABLE shop_orders ADD CONSTRAINT shop_orders_unlock_needed_check CHECK (unlock_needed IN ('ad', 'pay'));
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
UPDATE shop_orders SET unlocked_at = accepted_at WHERE accepted_at IS NOT NULL AND unlocked_at IS NULL;

-- Subscribed workers hear about new work 30 seconds before everyone else (was 60).
UPDATE subscription_settings SET head_start_seconds = 30 WHERE head_start_seconds = 60;
ALTER TABLE subscription_settings ALTER COLUMN head_start_seconds SET DEFAULT 30;
