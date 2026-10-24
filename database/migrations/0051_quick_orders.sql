-- Quick Order: a list sent to every matching shop nearby at once (by kind of shop, pickup or
-- delivery); the first shop to accept gets it. Until then the order has no shop
-- (business_id NULL) and one offer row per shop asked. After the accept it is an ordinary
-- shop order.
ALTER TABLE shop_orders
  ALTER COLUMN business_id DROP NOT NULL,
  ADD COLUMN quick BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN shop_categories business_shop_category[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT shop_orders_shop_or_quick CHECK (business_id IS NOT NULL OR (quick AND status IN ('placed', 'cancelled', 'expired')));

CREATE TYPE quick_order_offer_status AS ENUM ('pending', 'won', 'lost', 'declined');

CREATE TABLE quick_order_offers (
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  distance_meters DOUBLE PRECISION NOT NULL,
  status quick_order_offer_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, business_id)
);

CREATE INDEX idx_quick_order_offers_business ON quick_order_offers (business_id) WHERE status = 'pending';
