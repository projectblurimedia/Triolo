export type NotificationType = 'profile_view' | 'problem_accepted' | 'problem_work_done' | 'problem_completed';

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
