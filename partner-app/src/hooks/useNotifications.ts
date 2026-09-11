import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services/notificationsService';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];
// No FCM/push yet (see docs/api.md's Notifications Module) — this polling interval is what
// makes new notifications (e.g. "Someone viewed your profile") show up close to real-time
// while the app is open. Paired with App.tsx's existing AppState->focusManager wiring, which
// already refetches every mounted query on foreground, so backgrounding and returning also
// picks up anything that arrived while away, not just this interval.
const POLL_INTERVAL_MS = 8000;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: notificationsService.list,
    refetchInterval: POLL_INTERVAL_MS,
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
