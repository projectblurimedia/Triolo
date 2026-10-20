-- Businesses pay for the ads they book on the Triolo Ads website online (Razorpay), right
-- after booking. needs_payment marks such an ad (set for every new self-booked ad): until it's
-- paid it is 'unpaid' and not in the admin's review queue. Ads booked before this, and ads the
-- admin books, don't need it. payment_method 'online' = paid through Razorpay; a rejected or
-- withdrawn online payment is refunded (refund_id / refunded_at) and the ad goes back to
-- payment_method 'pending' (an edit then needs a new payment).

ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_payment_method_check;
ALTER TABLE ads
  ADD CONSTRAINT ads_payment_method_check CHECK (payment_method IN ('cash', 'upi', 'other', 'pending', 'online'));

ALTER TABLE ads
  ADD COLUMN needs_payment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN razorpay_order_id TEXT,
  ADD COLUMN razorpay_payment_id TEXT,
  ADD COLUMN paid_at TIMESTAMPTZ,
  ADD COLUMN refund_id TEXT,
  ADD COLUMN refunded_at TIMESTAMPTZ;

-- One Razorpay payment pays for one ad.
CREATE UNIQUE INDEX idx_ads_razorpay_payment ON ads (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
