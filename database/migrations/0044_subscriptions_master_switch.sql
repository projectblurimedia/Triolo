-- One main switch for subscriptions (like ads): customer and partner plans show only while it's on.
ALTER TABLE subscription_settings ADD COLUMN IF NOT EXISTS subscriptions_enabled BOOLEAN NOT NULL DEFAULT false;
UPDATE subscription_settings SET subscriptions_enabled = (customer_enabled OR partner_enabled) WHERE id = 1;
