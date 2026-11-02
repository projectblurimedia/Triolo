-- The shop's bill can carry photos (e.g. a written bill) and a voice message, and a bill total
-- typed in when the items aren't priced one by one. The customer sees and hears them.
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS bill_photo_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS bill_voice_url text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS bill_voice_seconds integer;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS bill_amount numeric(12, 2);
