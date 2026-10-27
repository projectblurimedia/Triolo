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
  | 'badge_removed'
  | 'job_post_view';

export interface AppNotification {
  id: string;
  accountId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  /**
   * Who viewed — profile_view on that profile's plan (name only), job_post_view on the job post
   * plan (name and number). Null otherwise.
   */
  viewer?: { name: string; mobile?: string | null } | null;
  /** What it is about: a profile kind ('service' / 'shop'), or a job post with its id. */
  ref?: { kind: string; id: string | null } | null;
  /** job_post_view without the job post plan: who it was is hidden. */
  locked?: boolean;
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
