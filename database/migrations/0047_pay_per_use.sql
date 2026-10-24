-- Pay per use, for people without a subscription while plans are on (prices set by the admin).
-- Customers: booking a worker (Quick Book or one in particular), ordering from a shop, and seeing
-- a job seeker's phone number. Partners: accepting a booking / problem / shop order, and
-- publishing a job post. One paid "pass" covers one use; a booking or order that ends before
-- anyone accepts it gives its pass back. A phone number, once paid for, stays unlocked.
ALTER TABLE subscription_settings
  ADD COLUMN IF NOT EXISTS customer_fees JSONB NOT NULL DEFAULT '{"book": 10, "order": 10, "staffContact": 10}'::jsonb,
  ADD COLUMN IF NOT EXISTS partner_fees JSONB NOT NULL DEFAULT '{"accept": 10, "jobPost": 20}'::jsonb;

CREATE TABLE IF NOT EXISTS pay_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('book', 'order', 'staff_contact', 'accept', 'job_post')),
  -- staff_contact: the job post whose phone number it unlocks.
  target_id TEXT,
  amount INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'used')),
  -- What used it (a booking / order / job post id); cleared when it's given back.
  used_ref TEXT,
  razorpay_link_id TEXT,
  razorpay_link_url TEXT,
  razorpay_payment_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_passes_account ON pay_passes (account_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_pay_passes_used_ref ON pay_passes (used_ref) WHERE used_ref IS NOT NULL;
