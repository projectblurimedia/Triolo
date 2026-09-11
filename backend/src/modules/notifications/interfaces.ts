export type NotificationType = 'profile_view';

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
