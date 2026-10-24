-- Waiting Time defaults: Quick Book 15 min, a worker booked personally and a list sent to a
-- shop 1 day. Accounts still on the previous default (30 min) move to these.
UPDATE accounts SET wait_quick_book_minutes = 15 WHERE wait_quick_book_minutes = 30;
UPDATE accounts SET wait_direct_minutes = 1440 WHERE wait_direct_minutes = 30;
UPDATE accounts SET wait_order_minutes = 1440 WHERE wait_order_minutes = 30;

ALTER TABLE accounts
  ALTER COLUMN wait_quick_book_minutes SET DEFAULT 15,
  ALTER COLUMN wait_direct_minutes SET DEFAULT 1440,
  ALTER COLUMN wait_order_minutes SET DEFAULT 1440;
