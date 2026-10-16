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
  | 'admin_notice';

export const MAX_BULK_DELETE = 100;

export interface AppNotification {
  id: string;
  accountId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
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
};
