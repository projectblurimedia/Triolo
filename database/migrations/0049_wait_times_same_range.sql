-- Waiting Time: the same choices for all three (5 min … 1 day) and 30 min as the default for
-- each. Accounts still on the first defaults (nobody has changed them yet) move to 30 min.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_wait_quick_book_minutes_check;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_wait_direct_minutes_check;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_wait_order_minutes_check;

UPDATE accounts SET wait_quick_book_minutes = 30 WHERE wait_quick_book_minutes = 10;
UPDATE accounts SET wait_direct_minutes = 30 WHERE wait_direct_minutes = 300;
UPDATE accounts SET wait_order_minutes = 30 WHERE wait_order_minutes = 600;

ALTER TABLE accounts
  ALTER COLUMN wait_quick_book_minutes SET DEFAULT 30,
  ALTER COLUMN wait_direct_minutes SET DEFAULT 30,
  ALTER COLUMN wait_order_minutes SET DEFAULT 30,
  ADD CONSTRAINT accounts_wait_quick_book_minutes_check CHECK (wait_quick_book_minutes BETWEEN 5 AND 1440),
  ADD CONSTRAINT accounts_wait_direct_minutes_check CHECK (wait_direct_minutes BETWEEN 5 AND 1440),
  ADD CONSTRAINT accounts_wait_order_minutes_check CHECK (wait_order_minutes BETWEEN 5 AND 1440);
