import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { pushTokenService } from '@/services/pushTokenService';
import { useAuthStore } from '@/state/authStore';

// Without this, a push arriving while the app is already open/foregrounded shows no banner
// at all in current expo-notifications versions. No user-facing notification type targets a
// user-app account yet (see this hook's own doc comment below) — this handler is here so
// the plumbing behaves correctly the moment one does, without needing a second app update.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for real push notifications, mirroring `partner-app`'s own
 * `usePushNotifications()` hook byte-for-byte (see that file's doc comment for the full
 * rationale — direct FCM HTTP v1 send via `firebase-admin`, native device token rather than
 * an Expo push token, defensive no-op on any failure). Ported here per explicit request to
 * have the same push infrastructure available in `user-app`, even though **no backend event
 * currently targets a user account** — `notifyProfileViewed()` is the only push-sending call
 * site today, and it always targets the Worker/Business being viewed, never the viewer. This
 * hook still registers the device's token against the shared `push_tokens` table (keyed by
 * `account_id`, not by which app/capability owns it — see `.cloud/architecture.md`'s
 * Notification Architecture section), so a future user-facing event (e.g. a booking status
 * update) only needs backend wiring to start reaching this app; no further client work.
 */
export function usePushNotifications() {
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken || Platform.OS !== 'android') {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
        });

        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted || cancelled) {
          return;
        }

        const { data: token } = await Notifications.getDevicePushTokenAsync();
        if (cancelled) {
          return;
        }
        await pushTokenService.register(token);
      } catch {
        // Permission denied, not yet on a build with real Firebase/native config, or a
        // transient failure — silently skipped, since nothing in this app currently
        // depends on push having registered successfully.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);
}
