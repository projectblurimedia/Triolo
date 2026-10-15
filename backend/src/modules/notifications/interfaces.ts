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
