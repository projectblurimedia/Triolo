-- Customers without a plan: this many bookings / orders / problem posts free each month (any
-- mix), then each costs its own fee — or Triolo Plus. NULL = none free (pay from the first).
ALTER TABLE subscription_settings
  ADD COLUMN IF NOT EXISTS customer_free_uses INT CHECK (customer_free_uses IS NULL OR customer_free_uses >= 0);
