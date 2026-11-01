-- Pay per use, one price per action (customers: Quick Book, booking a particular worker, Quick
-- Order, ordering from a particular shop, posting a problem, a staff phone number; partners:
-- accepting a job / order someone booked them for personally, publishing a job post, and seeing
-- who viewed a job post or a profile, with their number). Quick Book and Quick Order accepts are
-- free but limited per month without a plan (no limit while empty). Ads are only the Home slider.

ALTER TABLE pay_passes DROP CONSTRAINT IF EXISTS pay_passes_kind_check;
UPDATE pay_passes SET kind = 'quick_book' WHERE kind = 'book';
UPDATE pay_passes SET kind = 'shop_order' WHERE kind = 'order';
ALTER TABLE pay_passes ADD CONSTRAINT pay_passes_kind_check CHECK (kind IN (
  'quick_book', 'direct_book', 'quick_order', 'shop_order', 'post_problem', 'staff_contact',
  'accept', 'job_post', 'job_post_viewer', 'profile_viewer'
));

UPDATE subscription_settings SET customer_fees = jsonb_build_object(
  'quickBook', COALESCE((customer_fees->>'quickBook')::int, (customer_fees->>'book')::int, 10),
  'directBook', COALESCE((customer_fees->>'directBook')::int, (customer_fees->>'book')::int, 10),
  'quickOrder', COALESCE((customer_fees->>'quickOrder')::int, (customer_fees->>'order')::int, 10),
  'shopOrder', COALESCE((customer_fees->>'shopOrder')::int, (customer_fees->>'order')::int, 10),
  'postProblem', COALESCE((customer_fees->>'postProblem')::int, 10),
  'staffContact', COALESCE((customer_fees->>'staffContact')::int, 10)
);
UPDATE subscription_settings SET partner_fees = jsonb_build_object(
  'accept', COALESCE((partner_fees->>'accept')::int, 10),
  'jobPost', COALESCE((partner_fees->>'jobPost')::int, 20),
  'jobPostViewer', COALESCE((partner_fees->>'jobPostViewer')::int, 10),
  'profileViewer', COALESCE((partner_fees->>'profileViewer')::int, 10)
);
ALTER TABLE subscription_settings ALTER COLUMN customer_fees SET DEFAULT
  '{"quickBook": 10, "directBook": 10, "quickOrder": 10, "shopOrder": 10, "postProblem": 10, "staffContact": 10}'::jsonb;
ALTER TABLE subscription_settings ALTER COLUMN partner_fees SET DEFAULT
  '{"accept": 10, "jobPost": 20, "jobPostViewer": 10, "profileViewer": 10}'::jsonb;

-- Free Quick Book / Quick Order accepts per month for partners without a plan (NULL = no limit).
ALTER TABLE subscription_settings
  ADD COLUMN IF NOT EXISTS quick_book_limit INT CHECK (quick_book_limit IS NULL OR quick_book_limit >= 0),
  ADD COLUMN IF NOT EXISTS quick_order_limit INT CHECK (quick_order_limit IS NULL OR quick_order_limit >= 0);

-- Every ad is a Home slider ad now (no ads before actions).
UPDATE ads SET show_on = 'home' WHERE show_on <> 'home';
ALTER TABLE ads ALTER COLUMN show_on SET DEFAULT 'home';
