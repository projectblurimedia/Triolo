-- Ads can be bought by days (as before) or by views: the business picks how many views
-- (500 – 10,000) at the admin's price per view, and the ad stops once they are used up (within
-- 90 days of its start). A views ad stores plan_days = 90.
ALTER TABLE ads ADD COLUMN IF NOT EXISTS billing TEXT NOT NULL DEFAULT 'days';
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_billing_check;
ALTER TABLE ads ADD CONSTRAINT ads_billing_check CHECK (billing IN ('days', 'views'));
ALTER TABLE ads ADD COLUMN IF NOT EXISTS view_limit INTEGER;
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_view_limit_check;
ALTER TABLE ads ADD CONSTRAINT ads_view_limit_check
  CHECK ((billing = 'days' AND view_limit IS NULL) OR (billing = 'views' AND view_limit BETWEEN 500 AND 10000));
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_plan_days_check;
ALTER TABLE ads ADD CONSTRAINT ads_plan_days_check CHECK (plan_days IN (1, 3, 7, 30, 90));

-- The admin's price for one view (₹), and the Home carousel switch per app.
ALTER TABLE ad_settings ADD COLUMN IF NOT EXISTS price_per_view NUMERIC(8, 2) NOT NULL DEFAULT 0.20;
ALTER TABLE ad_settings ADD COLUMN IF NOT EXISTS home_user BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ad_settings ADD COLUMN IF NOT EXISTS home_partner BOOLEAN NOT NULL DEFAULT false;
