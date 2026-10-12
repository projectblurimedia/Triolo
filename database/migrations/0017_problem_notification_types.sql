-- Your Problems job updates become real in-app notifications (not just pushes), so they show
-- in both apps' notification lists: the customer gets "worker found" / "work done", the
-- worker gets "job finished". Same transitions as problems/service.ts.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'problem_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'problem_work_done';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'problem_completed';
