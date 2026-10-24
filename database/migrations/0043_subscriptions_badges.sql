-- Subscriptions (customers and partners), "Trusted by Triolo" badges per profile, and the
-- pieces other modules need for them. Everything starts switched off.
--
-- Customers who subscribe: no ads; Quick Book, booking a particular worker and ordering from a
-- shop (locked without a subscription while customer subscriptions are on).
-- Partners who subscribe: Quick Book offers and new problems head_start_seconds before other
-- workers; no ads; their shops / job posts / services first in search; who viewed their
-- profile (with a Call button).
-- Badges: bought per profile (worker, shop or job post) at the admin's price; the admin removes
-- one (with a reason) when its rating drops below badge_min_rating.
-- Payment: Razorpay payment links (opened from the apps).

CREATE TABLE subscription_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  customer_enabled BOOLEAN NOT NULL DEFAULT false,
  partner_enabled BOOLEAN NOT NULL DEFAULT false,
  customer_prices JSONB NOT NULL DEFAULT '{"1": 49, "3": 129, "6": 239, "12": 449}'::jsonb,
  partner_prices JSONB NOT NULL DEFAULT '{"1": 99, "3": 269, "6": 499, "12": 899}'::jsonb,
  head_start_seconds INT NOT NULL DEFAULT 60 CHECK (head_start_seconds BETWEEN 0 AND 600),
  badge_enabled BOOLEAN NOT NULL DEFAULT false,
  badge_price INT NOT NULL DEFAULT 199 CHECK (badge_price BETWEEN 0 AND 100000),
  badge_min_rating NUMERIC(2, 1) NOT NULL DEFAULT 3.0 CHECK (badge_min_rating BETWEEN 1 AND 5),
  badge_min_ratings INT NOT NULL DEFAULT 3 CHECK (badge_min_ratings BETWEEN 1 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO subscription_settings (id) VALUES (1);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'partner')),
  months INT NOT NULL CHECK (months IN (1, 3, 6, 12)),
  amount INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'active', 'cancelled')),
  razorpay_link_id TEXT,
  razorpay_link_url TEXT,
  razorpay_payment_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_active ON subscriptions (account_id, audience, ends_at) WHERE status = 'active';

CREATE TABLE profile_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'business', 'job_post')),
  profile_id UUID NOT NULL,
  amount INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'active', 'removed')),
  razorpay_link_id TEXT,
  razorpay_link_url TEXT,
  razorpay_payment_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_profile_badges_one_active ON profile_badges (kind, profile_id) WHERE status = 'active';
CREATE INDEX idx_profile_badges_account ON profile_badges (account_id, created_at DESC);

-- Quick Book offers to non-subscribed workers wait for the head start: visible (and pushed)
-- from visible_after; pushed_at marks the push as sent.
ALTER TABLE booking_offers
  ADD COLUMN visible_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN pushed_at TIMESTAMPTZ;
UPDATE booking_offers SET pushed_at = created_at;

-- Who caused a notification (the viewer of a profile): shown to subscribed partners.
ALTER TABLE notifications ADD COLUMN actor_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'badge_removed';

-- A boost (profile ad) bought from the partner app is paid through a payment link.
ALTER TABLE ads ADD COLUMN razorpay_link_id TEXT;
