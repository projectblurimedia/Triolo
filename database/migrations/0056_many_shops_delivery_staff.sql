-- A partner may own several shops (like several job posts): the one-shop-per-account rule goes.
ALTER TABLE business_profiles DROP CONSTRAINT IF EXISTS business_profiles_account_id_key;
CREATE INDEX IF NOT EXISTS idx_business_profiles_account ON business_profiles (account_id, created_at);

-- A shop's delivery staff: people the owner added by phone. They sign in with their own OTP
-- and see only the deliveries given to them — never the shop's orders, bills or earnings.
CREATE TABLE IF NOT EXISTS shop_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_staff_account ON shop_staff (account_id);

-- Who is taking a delivery order (null: the owner), and who handed it over.
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS delivery_staff_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS delivery_assigned_at TIMESTAMPTZ;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS delivered_by_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shop_orders_delivery_staff ON shop_orders (delivery_staff_account_id) WHERE delivery_staff_account_id IS NOT NULL;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delivery_assigned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delivery_completed';
