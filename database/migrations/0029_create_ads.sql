-- Ads booked by local businesses (shops, openings, offers) outside the marketplace. The
-- admin books every ad by hand in admin-web after the business pays; nothing is self-serve.
--
-- Where ads show is controlled by one settings row: a master switch, then the app-open
-- full-screen banner and the Home banner card, each on/off separately for the customer app
-- and the partner app.

CREATE TABLE ad_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ads_enabled BOOLEAN NOT NULL DEFAULT false,
  launch_user BOOLEAN NOT NULL DEFAULT true,
  launch_partner BOOLEAN NOT NULL DEFAULT true,
  home_user BOOLEAN NOT NULL DEFAULT true,
  home_partner BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO ad_settings (id) VALUES (1);

-- Bill numbers run 1, 2, 3… and are never reused, even if an ad is deleted.
CREATE SEQUENCE ad_bill_number_seq START 1;

CREATE TABLE ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number INTEGER NOT NULL UNIQUE DEFAULT nextval('ad_bill_number_seq'),
  -- Who booked it (goes on the bill).
  advertiser_name TEXT NOT NULL,
  advertiser_phone TEXT,
  -- What people see.
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  contact_phone TEXT,
  location_text TEXT,
  -- What was bought. Prices are fixed per plan (see ads/interfaces.ts); amount is kept as
  -- charged so an old bill never changes if prices change later.
  plan_days INTEGER NOT NULL CHECK (plan_days IN (1, 3, 7, 30)),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'other')),
  -- Runs from start_date to end_date inclusive (India time).
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  -- Deleted ads stop showing but stay in the history with their bill.
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_ads_running ON ads (start_date, end_date) WHERE deleted_at IS NULL;

-- Views per ad per day. Each time a banner is shown, the running ad with the fewest views
-- today is picked, so every paid ad gets an equal share of each day.
CREATE TABLE ad_daily_stats (
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ad_id, day)
);
