-- Waiting Time: Quick Order gets its own time, separate from Quick Book (default 15 min).
ALTER TABLE accounts
  ADD COLUMN wait_quick_order_minutes INTEGER NOT NULL DEFAULT 15
    CONSTRAINT accounts_wait_quick_order_minutes_check CHECK (wait_quick_order_minutes BETWEEN 5 AND 1440);
