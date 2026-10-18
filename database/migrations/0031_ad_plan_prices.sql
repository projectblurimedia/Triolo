-- Ad prices are set by the admin now (they were fixed in code). Each ad keeps the amount it
-- was booked at, so a price change only affects new bookings.
ALTER TABLE ad_settings
  ADD COLUMN plan_prices JSONB NOT NULL DEFAULT '{"1": 20, "3": 50, "7": 100, "30": 300}';
