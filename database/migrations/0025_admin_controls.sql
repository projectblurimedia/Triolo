-- Admin controls: account suspension/bans, admin cancellation of bookings and orders,
-- admin closing of problem posts, and a notification type for admin notices.

-- Accounts: a suspension ends at suspended_until ('suspended'); 'blocked' is permanent.
ALTER TABLE accounts
  ADD COLUMN suspended_until TIMESTAMPTZ,
  ADD COLUMN status_reason TEXT,
  ADD COLUMN status_changed_at TIMESTAMPTZ;

-- Bookings and orders can now also be cancelled by the admin ('admin').
DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'booking_requests'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cancelled_by%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE booking_requests DROP CONSTRAINT %I', c); END IF;

  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'shop_orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cancelled_by%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE shop_orders DROP CONSTRAINT %I', c); END IF;
END $$;

ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_cancelled_by_check CHECK (cancelled_by IN ('customer', 'worker', 'admin'));
ALTER TABLE shop_orders
  ADD CONSTRAINT shop_orders_cancelled_by_check CHECK (cancelled_by IN ('customer', 'shop', 'admin'));

-- An open problem post closed by the admin (status 'closed', unused until now).
ALTER TABLE problem_posts
  ADD COLUMN closed_reason TEXT,
  ADD COLUMN closed_at TIMESTAMPTZ;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_notice';

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status);
