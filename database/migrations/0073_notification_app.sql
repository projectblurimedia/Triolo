-- Which app a notification belongs to, so an account signed in to both apps sees each app's own
-- list (a shop's new orders in the partner app, its own bookings in the customer app).
-- NULL = both apps (admin notices; older cancellations whose side can't be told any more).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS app text CHECK (app IN ('user', 'partner'));

UPDATE notifications SET app = CASE
  WHEN type IN ('profile_view', 'problem_completed', 'booking_completed', 'order_placed', 'badge_removed',
                'job_post_view', 'delivery_assigned', 'delivery_completed', 'staff_invite', 'delivery_declined')
    THEN 'partner'
  WHEN type IN ('problem_accepted', 'problem_work_done', 'booking_accepted', 'booking_on_the_way', 'booking_arrived',
                'booking_work_done', 'booking_nearby', 'order_nearby', 'order_accepted', 'order_declined', 'order_packed',
                'order_ready', 'order_out_for_delivery', 'order_completed')
    THEN 'user'
  ELSE NULL
END
WHERE app IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_account_app ON notifications (account_id, app, created_at DESC);
