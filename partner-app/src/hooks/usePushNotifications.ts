import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { pushTokenService } from '@/services/pushTokenService';
import { bookingOffersService } from '@/services/bookingOffersService';
import { useAuthStore } from '@/state/authStore';
import { usePendingOfferStore } from '@/state/pendingOfferStore';
import { navigateToBookings } from '@/navigation/navigationRef';
import { showToast } from '@/state/toastStore';
import { ACCEPT_ACTION, BOOKING_OFFER_CATEGORY, BOOKING_OFFER_CHANNEL, DECLINE_ACTION } from '@/constants/bookingNotifications';

// Without this, a push arriving while the app is already open/foregrounded shows no banner
// at all in current expo-notifications versions — WhatsApp-style delivery means a
// notification should show the same way whether the app is closed, backgrounded, or open.
// This also governs Quick Book's offer notifications once backgroundNotificationTask.ts has
// composed them locally (see that file) — they go through this same foreground path too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface OfferActionLabels {
  accepted: string;
  declined: string;
  error: string;
}

/** Handles an Accept/Reject tap that reached JS while the app is alive (foreground or
 * backgrounded-but-not-killed) — the fully-killed case is handled independently, headlessly,
 * by backgroundNotificationTask.ts, which cannot show a toast (there's no mounted UI), so
 * this success/error feedback is genuinely a "when it can be shown" bonus, not load-bearing. */
async function handleOfferAction(actionIdentifier: string, bookingRequestId: string, labels: OfferActionLabels) {
  try {
    if (actionIdentifier === ACCEPT_ACTION) {
      await bookingOffersService.accept(bookingRequestId);
      showToast({ variant: 'success', title: labels.accepted });
    } else if (actionIdentifier === DECLINE_ACTION) {
      await bookingOffersService.decline(bookingRequestId);
      showToast({ variant: 'info', title: labels.declined });
    }
  } catch {
    showToast({ variant: 'error', title: labels.error });
  }
}

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
  const { t } = useTranslation();
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
        // Dedicated channel for Quick Book's broadcast offers — separate from 'default' so a
        // job offer reads as visibly more urgent (its own vibration pattern, heads-up at
        // Android's channel ceiling, HIGH — there's no channel-level importance above that).
        // The notifications themselves arrive as FCM data-only pushes and are composed +
        // displayed locally by backgroundNotificationTask.ts (which runs even with this app
        // fully closed) — see that file and pushSender.ts's `dataOnly` option for why: FCM's
        // own `notification` payload type has no field for action buttons on Android.
        await Notifications.setNotificationChannelAsync(BOOKING_OFFER_CHANNEL, {
          name: 'Job Offers',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 400, 200, 400],
          sound: 'default',
        });

        // Accept/Reject buttons on the notification itself, per explicit request — both
        // `opensAppToForeground: false` ("silent": tapping either never brings the app to
        // the foreground). Persisted by expo-notifications across restarts/headless runs
        // (SharedPreferences-backed on Android), so registering it once here is enough —
        // backgroundNotificationTask.ts doesn't need to re-register it before using it.
        await Notifications.setNotificationCategoryAsync(BOOKING_OFFER_CATEGORY, [
          { identifier: ACCEPT_ACTION, buttonTitle: t('bookings.accept'), options: { opensAppToForeground: false } },
          { identifier: DECLINE_ACTION, buttonTitle: t('bookings.decline'), options: { opensAppToForeground: false } },
        ]);

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
  }, [accessToken, t]);

  // Handles a notification response while this app's JS is alive (foreground, or
  // backgrounded-but-not-killed) — the fully-killed case for Accept/Reject is instead
  // handled headlessly by backgroundNotificationTask.ts, since `opensAppToForeground:
  // false` means those two actions don't necessarily relaunch the app (and this listener
  // along with it) at all in that state.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { bookingRequestId?: string } | undefined;
      const bookingRequestId = data?.bookingRequestId;
      if (!bookingRequestId) {
        return;
      }

      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // The notification body itself was tapped (this does foreground the app) — open
        // straight to that specific job instead of just the general Bookings list.
        usePendingOfferStore.getState().setFocusedOffer(bookingRequestId);
        navigateToBookings();
        return;
      }

      handleOfferAction(response.actionIdentifier, bookingRequestId, {
        accepted: t('bookings.acceptedToastTitle'),
        declined: t('bookings.declinedToastTitle'),
        error: t('common.errorTitle'),
      });
    });

    return () => subscription.remove();
  }, [t]);

  // Covers the specific case `addNotificationResponseReceivedListener` above can miss: the
  // exact tap that *launched* the app (the listener wasn't attached yet at that instant) —
  // per expo-notifications' own documented pattern for this.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (Platform.OS !== 'android' || !lastResponse) {
      return;
    }
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    const data = lastResponse.notification.request.content.data as { bookingRequestId?: string } | undefined;
    if (!data?.bookingRequestId) {
      return;
    }
    usePendingOfferStore.getState().setFocusedOffer(data.bookingRequestId);
    navigateToBookings();
  }, [lastResponse]);
}
