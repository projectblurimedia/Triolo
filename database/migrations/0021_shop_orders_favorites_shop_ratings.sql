-- Shop orders from a prepared list (Bazaar), favorites, and shop ratings.
--
-- Order flow (docs/product-specification.md §3):
--   placed → accepted (shop starts reviewing) → preparing (marking items) → packed (bill sent)
--     → ready_for_pickup | out_for_delivery → completed (customer's PIN verified by the shop)
--   placed → declined (shop) | expired (no answer in time) | cancelled (customer, only while placed)
--   any step before completed → cancelled (shop)

CREATE TYPE shop_order_status AS ENUM (
  'placed', 'accepted', 'preparing', 'packed', 'ready_for_pickup', 'out_for_delivery',
  'completed', 'cancelled', 'declined', 'expired'
);
CREATE TYPE shop_order_fulfillment AS ENUM ('pickup', 'delivery');
CREATE TYPE shop_order_item_status AS ENUM ('pending', 'packed', 'unavailable');

CREATE TABLE shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  fulfillment shop_order_fulfillment NOT NULL,
  status shop_order_status NOT NULL DEFAULT 'placed',
  -- Where the customer is (delivery address, and distance for the delivery charge).
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_address TEXT,
  distance_meters DOUBLE PRECISION NOT NULL,
  -- Rupees. delivery_charge is fixed when ordering (shop's price per km × distance).
  delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 0,
  items_total NUMERIC(10, 2),
  total_amount NUMERIC(10, 2),
  note TEXT,
  -- Pickup/Delivery PIN: set when the order is ready for pickup / out for delivery, shown
  -- only to the customer, cleared once verified (single use).
  pin TEXT,
  pin_attempts INTEGER NOT NULL DEFAULT 0,
  cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'shop')),
  cancel_reason TEXT,
  shop_rating SMALLINT CHECK (shop_rating BETWEEN 1 AND 5),
  shop_review TEXT,
  accepted_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  rated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_orders_account ON shop_orders (account_id, created_at DESC);
CREATE INDEX idx_shop_orders_business ON shop_orders (business_id, created_at DESC);
CREATE INDEX idx_shop_orders_placed ON shop_orders (created_at) WHERE status = 'placed';

CREATE TABLE shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '1',
  unit TEXT,
  status shop_order_item_status NOT NULL DEFAULT 'pending',
  -- Price the shop charges for this line (packed items only).
  price NUMERIC(10, 2),
  UNIQUE (order_id, position)
);

-- Shop ratings: the running total lives on the profile (owned by businesses), same pattern as
-- worker_profiles (migration 0016); individual ratings live on the order.
ALTER TABLE business_profiles
  ADD COLUMN rating_sum INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN rating_count INTEGER NOT NULL DEFAULT 0;

-- A customer's saved workers and shops.
CREATE TYPE favorite_target_type AS ENUM ('worker', 'business');
CREATE TABLE favorites (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_type favorite_target_type NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, target_type, target_id)
);

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_placed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_declined';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_packed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_ready';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_out_for_delivery';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_cancelled';
