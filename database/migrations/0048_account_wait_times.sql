-- How long a customer's requests wait for an answer before they end by themselves, set by the
-- customer (Profile menu → Waiting Time). Read live by the "still open?" checks, so a change
-- also applies to requests already waiting.
ALTER TABLE accounts
  ADD COLUMN wait_quick_book_minutes INTEGER NOT NULL DEFAULT 10
    CHECK (wait_quick_book_minutes BETWEEN 2 AND 120),
  ADD COLUMN wait_direct_minutes INTEGER NOT NULL DEFAULT 300
    CHECK (wait_direct_minutes BETWEEN 10 AND 1440),
  ADD COLUMN wait_order_minutes INTEGER NOT NULL DEFAULT 600
    CHECK (wait_order_minutes BETWEEN 30 AND 1440);
