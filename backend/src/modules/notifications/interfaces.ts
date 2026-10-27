export type NotificationType =
  | 'profile_view'
  | 'problem_accepted'
  | 'problem_work_done'
  | 'problem_completed'
  | 'booking_accepted'
  | 'booking_on_the_way'
  | 'booking_arrived'
  | 'booking_work_done'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'order_placed'
  | 'order_accepted'
  | 'order_declined'
  | 'order_packed'
  | 'order_ready'
  | 'order_out_for_delivery'
  | 'order_completed'
  | 'order_cancelled'
  | 'admin_notice'
  | 'badge_removed'
  | 'job_post_view';

export const MAX_BULK_DELETE = 100;

export interface AppNotification {
  id: string;
  accountId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  /**
   * profile_view: who viewed — given only to subscribed partners (their app shows the name and
   * a Call button); null otherwise.
   */
  /**
   * profile_view (on that profile's plan): the viewer's name only. job_post_view (on the job post
   * plan): name and number, since the poster is looking for work and wants to call back.
   */
  viewer?: { name: string; mobile?: string | null } | null;
  /** What it is about: a profile kind, or a job post with its id. */
  ref?: { kind: string; id: string | null } | null;
  /** job_post_view without the job post plan: who it was is hidden (the app offers the plan). */
  locked?: boolean;
}

export interface NotificationListResult {
  items: AppNotification[];
  unreadCount: number;
}

/** Which app a device token belongs to. */
export type PushApp = 'user' | 'partner';

/**
 * Which app a notification is for: the customer side ('user'), the worker / shop side
 * ('partner'), or every app the account is signed in to ('any').
 */
export type PushAudience = PushApp | 'any';

/**
 * Default app for each notification type. A few types go to either side depending on who
 * caused them (a cancellation) — those are 'any' here and the sender passes the exact app.
 */
export const AUDIENCE_BY_TYPE: Record<NotificationType, PushAudience> = {
  profile_view: 'partner',
  problem_accepted: 'user',
  problem_work_done: 'user',
  problem_completed: 'partner',
  booking_accepted: 'user',
  booking_on_the_way: 'user',
  booking_arrived: 'user',
  booking_work_done: 'user',
  booking_completed: 'partner',
  booking_cancelled: 'any',
  order_placed: 'partner',
  order_accepted: 'user',
  order_declined: 'user',
  order_packed: 'user',
  order_ready: 'user',
  order_out_for_delivery: 'user',
  order_completed: 'user',
  order_cancelled: 'any',
  admin_notice: 'any',
  badge_removed: 'partner',
  job_post_view: 'partner',
};
