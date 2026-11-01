-- Customers' monthly free uses, split like the partners' free accepts: one limit for bookings
-- (Quick Book, booking a particular worker, problem posts) and one for orders (Quick Order,
-- ordering from a particular shop). NULL = none free (pay from the first).
ALTER TABLE subscription_settings
  ADD COLUMN IF NOT EXISTS customer_free_bookings INT CHECK (customer_free_bookings IS NULL OR customer_free_bookings >= 0),
  ADD COLUMN IF NOT EXISTS customer_free_orders INT CHECK (customer_free_orders IS NULL OR customer_free_orders >= 0);

UPDATE subscription_settings
SET customer_free_bookings = COALESCE(customer_free_bookings, customer_free_uses),
    customer_free_orders = COALESCE(customer_free_orders, customer_free_uses);
