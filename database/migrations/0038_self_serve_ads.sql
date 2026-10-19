-- Businesses book their own ads on the Triolo Ads website. Such an ad belongs to the account
-- that made it and waits for the admin's review: only an approved ad is ever shown in the apps.
-- Ads the admin books in admin-web are approved from the start (the default below), as are
-- all earlier ads. Online payment is not built yet: a self-booked ad is marked
-- payment_method = 'pending' until the admin records how it was paid.

ALTER TABLE ads
  ADD COLUMN owner_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN review_note TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ;

DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name FROM pg_constraint
   WHERE conrelid = 'ads'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%payment_method%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ads DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
ALTER TABLE ads ADD CONSTRAINT ads_payment_method_check CHECK (payment_method IN ('cash', 'upi', 'other', 'pending'));

CREATE INDEX idx_ads_owner ON ads (owner_account_id, created_at DESC) WHERE owner_account_id IS NOT NULL;
CREATE INDEX idx_ads_in_review ON ads (created_at) WHERE review_status = 'pending' AND deleted_at IS NULL;
