-- Whether the customer paid the shop at handover. The shop picks it when the PIN is entered
-- (default paid); "unpaid" can later become "paid" (never back). Nearby customers often pay later.
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS payment_status text CHECK (payment_status IN ('paid', 'unpaid'));
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
-- The shop's last "please pay" reminder to the customer (they can send one every few hours).
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS payment_reminded_at timestamptz;

-- Orders completed before this change were paid in the usual way.
UPDATE shop_orders SET payment_status = 'paid', paid_at = completed_at
WHERE status = 'completed' AND payment_status IS NULL;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_payment_due';
