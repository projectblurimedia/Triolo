-- Where an ad is shown: before key actions (full screen) or in Home's carousel (wide only),
-- and who removed a deleted ad (the business itself, or the Triolo admin).
ALTER TABLE ads ADD COLUMN IF NOT EXISTS show_on TEXT NOT NULL DEFAULT 'action' CHECK (show_on IN ('action', 'home'));
ALTER TABLE ads ADD COLUMN IF NOT EXISTS deleted_by TEXT CHECK (deleted_by IN ('owner', 'admin'));

-- Deleted before this: a self-booked ad withdrawn while waiting for review was the business's
-- own doing; every other deleted ad was removed by the admin.
UPDATE ads SET deleted_by = CASE
  WHEN owner_account_id IS NOT NULL AND review_status IN ('pending', 'rejected') THEN 'owner'
  ELSE 'admin' END
WHERE deleted_at IS NOT NULL AND deleted_by IS NULL;
