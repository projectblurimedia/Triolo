-- A list can be photos of a written (paper) list instead of, or as well as, typed items. The shop
-- reads the photos and types the items in while packing (each with its price), so the bill is
-- still item by item; those rows are marked as added by the shop.
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS list_photo_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE shop_order_items ADD COLUMN IF NOT EXISTS added_by_shop BOOLEAN NOT NULL DEFAULT false;
