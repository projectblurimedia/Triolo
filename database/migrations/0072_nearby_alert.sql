-- "Almost there": the customer is told once when the worker / delivery comes within 100 m.
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS near_notified_at timestamptz;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS near_notified_at timestamptz;
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_nearby';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_nearby';
