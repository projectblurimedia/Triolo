-- Customers' monthly free uses now read like the partners' free accepts: NULL = no limit (every
-- booking / order free), 0 = none free. Before, NULL meant none, so those become 0.
UPDATE subscription_settings SET customer_free_bookings = 0 WHERE customer_free_bookings IS NULL;
UPDATE subscription_settings SET customer_free_orders = 0 WHERE customer_free_orders IS NULL;
