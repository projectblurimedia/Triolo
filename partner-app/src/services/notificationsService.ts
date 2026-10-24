import { apiClient } from './apiClient';

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
  | 'badge_removed';

export interface AppNotification {
  id: string;
  accountId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  /** profile_view, for a subscribed partner: who it was (their name only). Null otherwise. */
  viewer?: { name: string } | null;
}

export interface NotificationListResult {
  items: AppNotification[];
  unreadCount: number;
}

export const notificationsService = {
  list: () => apiClient.get<NotificationListResult>('/notifications', true),
  markRead: (id: string) => apiClient.patch<null>(`/notifications/${id}/read`, undefined, true),
  markAllRead: () => apiClient.post<null>('/notifications/read-all', undefined, true),
  deleteMany: (ids: string[]) => apiClient.post<{ deleted: number }>('/notifications/delete', { ids }, true),
};
