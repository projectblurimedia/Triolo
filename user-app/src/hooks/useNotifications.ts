import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotificationListResult, notificationsService } from '@/services/notificationsService';
import { useAuthStore } from '@/state/authStore';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];
// Push delivers the alert itself; this poll keeps the in-app list and the bell's unread
// badge current while the app is open (App.tsx's AppState→focusManager wiring also
// refetches on return to the foreground).
const POLL_INTERVAL_MS = 15000;

export function useNotifications() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: notificationsService.list,
    refetchInterval: POLL_INTERVAL_MS,
    enabled: !!accessToken,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });
}

/** Optimistic — rows disappear immediately; restored if the request fails. */
export function useDeleteNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => notificationsService.deleteMany(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationListResult>(NOTIFICATIONS_QUERY_KEY);
      if (previous) {
        const removing = new Set(ids);
        const items = previous.items.filter((item) => !removing.has(item.id));
        const unreadRemoved = previous.items.filter((item) => removing.has(item.id) && !item.isRead).length;
        queryClient.setQueryData<NotificationListResult>(NOTIFICATIONS_QUERY_KEY, {
          items,
          unreadCount: Math.max(0, previous.unreadCount - unreadRemoved),
        });
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });
}
