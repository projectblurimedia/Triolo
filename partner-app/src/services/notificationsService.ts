import { apiClient } from './apiClient';

export type NotificationType = 'profile_view';

export interface AppNotification {
  id: string;
  accountId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: AppNotification[];
  unreadCount: number;
}

export const notificationsService = {
  list: () => apiClient.get<NotificationListResult>('/notifications', true),
  markRead: (id: string) => apiClient.patch<null>(`/notifications/${id}/read`, undefined, true),
  markAllRead: () => apiClient.post<null>('/notifications/read-all', undefined, true),
};
