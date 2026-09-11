-- New `notifications` module — starts with a single event type (`profile_view`, fired when
-- a user opens a Worker/Business's detail card from Nearby Workers/Shops search) as the
-- first slice of Pending Module 6. In-app only for this pass (polled by partner-app, see
-- .cloud/project-context.md) — no FCM/push wiring yet, that's a separate, much larger native
-- lift (Pending Module 6's own remaining scope) layered on top of this same table later.
CREATE TYPE notification_type AS ENUM ('profile_view');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every read pattern is "this account's notifications, newest first" or "this account's
-- unread count" — one composite index covers both.
CREATE INDEX idx_notifications_account_id_created_at ON notifications (account_id, created_at DESC);
