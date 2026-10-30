-- Delivery staff are invited first: the person accepts (or declines) in the Partner app before
-- any delivery can be handed to them. Everyone already added stays able to deliver.
ALTER TABLE shop_staff ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'invited'
  CHECK (status IN ('invited', 'active', 'declined'));
UPDATE shop_staff SET status = 'active' WHERE status = 'invited' AND created_at < now();
CREATE INDEX IF NOT EXISTS idx_shop_staff_account_status ON shop_staff (account_id, status);

-- Where the staff member taking a delivery is (sent from their phone while delivering),
-- so the owner can see them on the map.
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS staff_latitude DOUBLE PRECISION;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS staff_longitude DOUBLE PRECISION;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS staff_location_at TIMESTAMPTZ;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'staff_invite';
