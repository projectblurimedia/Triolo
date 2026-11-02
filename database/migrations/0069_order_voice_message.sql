-- A voice message with a shop order: the customer can speak their list instead of (or as well
-- as) typing it or sending photos of it. Uploaded first (POST /orders/list-voice).
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS list_voice_url text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS list_voice_seconds integer;

-- Free monthly uses that were given back used to stay as ₹0 "paid" credits; they are simply
-- taken back now (the month gets them again).
DELETE FROM pay_passes WHERE razorpay_payment_id LIKE 'month-free-%' AND status = 'paid';
