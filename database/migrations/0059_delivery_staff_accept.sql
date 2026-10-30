-- A delivery handed to staff waits for them to accept it ('pending'); only then does the order go
-- out for delivery (customer gets the PIN) and the staff member see the map and PIN step.
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS delivery_staff_status TEXT
  CHECK (delivery_staff_status IN ('pending', 'accepted'));
UPDATE shop_orders SET delivery_staff_status = 'accepted'
  WHERE delivery_staff_account_id IS NOT NULL AND delivery_staff_status IS NULL;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delivery_declined';
