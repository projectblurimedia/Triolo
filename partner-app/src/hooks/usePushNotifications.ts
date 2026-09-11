import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { pushTokenService } from '@/services/pushTokenService';
import { useAuthStore } from '@/state/authStore';

// Without this, a push arriving while the app is already open/foregrounded shows no banner
// at all in current expo-notifications versions — WhatsApp-style delivery means a
// notification should show the same way whether the app is closed, backgrounded, or open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for real push notifications — reaches the recipient even with the
 * app fully closed, unlike `useNotifications()`'s polling (which only works while the app is
 * open). Uses the device's raw native FCM registration token (`getDevicePushTokenAsync()`),
 * not an Expo push token — the backend sends directly to Google's FCM HTTP v1 API via
 * `firebase-admin` rather than through Expo's own push relay (see
 * `backend/src/modules/notifications/pushSender.ts`'s doc comment for why). Requires the
 * app to be built with `google-services.json`/the `expo-notifications` config plugin wired
 * in `app.json` — until that native config + a fresh APK build land, this silently no-ops
 * (permission/token calls throw in an unconfigured build; caught and ignored, since a
 * missing push registration must never break the rest of the app — the in-app polling
 * fallback keeps working regardless).
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
        // Dedicated channel for Quick Book's broadcast offers (see backend's
        // modules/bookings) — separate from 'default' so a job offer reads as visibly more
        // urgent (its own vibration pattern, heads-up at Android's channel ceiling, HIGH —
        // there's no channel-level importance above that; FCM's own per-message
        // `notification.priority: 'max'`, set server-side, is what actually pushes display
        // priority to the top *within* that ceiling). The server sets this channel id and a
        // `tag` equal to the booking request id on every push for one broadcast, so a
        // follow-up "job taken" push replaces the original in place via native Android
        // notification-tag behavior instead of needing a custom dismiss handler here.
        await Notifications.setNotificationChannelAsync('booking-offers', {
          name: 'Job Offers',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 400, 200, 400],
          sound: 'default',
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
        // Not yet configured with real Firebase credentials (no google-services.json /
        // expo-notifications native config in this build yet), permission denied, or a
        // transient failure — either way, the in-app polling notifications still work, so
        // this is silently skipped rather than surfaced anywhere.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);
}
