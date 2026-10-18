import { useEffect } from 'react';
import i18n from '@/localization/i18n';
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { pushTokenService } from '@/services/pushTokenService';
import { attemptAccept, attemptDecline, updateOfferNotification } from '@/utils/bookingOfferOutcome';
import { useAuthStore } from '@/state/authStore';
import { usePendingOfferStore } from '@/state/pendingOfferStore';
import { openJob } from '@/state/jobFocusStore';
import { openShopOrder } from '@/state/shopOrderFocusStore';
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
  acceptedMessage: string;
  declined: string;
  taken: string;
  takenMessage: string;
  error: string;
}

/**
 * Handles an Accept/Reject tap that reached JS while the app is alive (foreground or
 * backgrounded-but-not-killed) — the fully-killed case is handled independently, headlessly,
 * by backgroundNotificationTask.ts (which cannot show a toast, so it relies entirely on
 * `updateOfferNotification` for feedback). Here, both are used: a toast for the visible,
 * in-the-moment feedback, plus rewriting the notification itself so the outcome is still
 * correct even after the toast fades — this is what makes "someone else won the race" read
 * as an explicit, clear "Job Already Taken" instead of the ambiguous, generic error a losing
 * device used to show (or nothing at all, if the tap happened via the notification action
 * with no UI mounted to surface even a toast).
 */
async function handleOfferAction(actionIdentifier: string, bookingRequestId: string, labels: OfferActionLabels) {
  if (actionIdentifier === ACCEPT_ACTION) {
    const outcome = await attemptAccept(bookingRequestId);
    await updateOfferNotification(bookingRequestId, outcome);
    if (outcome === 'accepted') {
      // The job screen is the first thing the worker sees once they open the app.
      openJob(bookingRequestId);
      showToast({ variant: 'success', title: labels.accepted, message: labels.acceptedMessage });
    } else if (outcome === 'already_taken') {
      showToast({ variant: 'info', title: labels.taken, message: labels.takenMessage });
    } else if (outcome === 'location_off') {
      showToast({ variant: 'error', title: i18n.t('location.disabledTitle'), message: i18n.t('location.acceptNeedsLocation') });
    } else {
      showToast({ variant: 'error', title: labels.error });
    }
  } else if (actionIdentifier === DECLINE_ACTION) {
    const outcome = await attemptDecline(bookingRequestId);
    await updateOfferNotification(bookingRequestId, outcome);
    if (outcome === 'declined') {
      showToast({ variant: 'info', title: labels.declined });
    } else {
      showToast({ variant: 'error', title: labels.error });
    }
  }
}

// The live response listener and `useLastNotificationResponse` can both report the same tap
// (e.g. the one that launched the app) — each tap is acted on once.
const handledTaps = new Set<string>();

/**
 * A tap on an offer notification that brings the app to the foreground: the body (show the
 * offer) or the Accept button (show the offer and accept it straight away). Returns false
 * for anything else (Reject is handled silently elsewhere).
 */
function openOfferFromTap(response: Notifications.NotificationResponse, bookingRequestId: string): boolean {
  const isAccept = response.actionIdentifier === ACCEPT_ACTION;
  if (!isAccept && response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return false;
  }
  const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
  if (handledTaps.has(key)) return true;
  handledTaps.add(key);
  if (isAccept) {
    Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
  }
  usePendingOfferStore.getState().setFocusedOffer(bookingRequestId, isAccept);
  if (!isAccept) navigateToBookings('jobs');
  return true;
}

/**
 * A body tap on a shop-order or trip-update notification: opens that order (on the Bookings
 * tab's Shop Orders side) or that job. Returns false when the tap isn't one of those.
 */
function openUpdateFromTap(response: Notifications.NotificationResponse): boolean {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return false;
  const data = response.notification.request.content.data as { orderId?: string; bookingId?: string } | undefined;
  if (!data?.orderId && !data?.bookingId) return false;
  const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
  if (handledTaps.has(key)) return true;
  handledTaps.add(key);
  if (data.orderId) {
    navigateToBookings('orders');
    openShopOrder(data.orderId);
  } else if (data.bookingId) {
    openJob(data.bookingId);
  }
  return true;
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
        // Accept opens the app (`opensAppToForeground: true`): handled silently in the
        // background, the tap gave no visible response for several seconds. Now the app comes
        // up at once with Accept already spinning, then goes straight to the job screen.
        // Reject stays silent — there is nothing to show after declining.
        await Notifications.setNotificationCategoryAsync(BOOKING_OFFER_CATEGORY, [
          { identifier: ACCEPT_ACTION, buttonTitle: t('bookings.accept'), options: { opensAppToForeground: true } },
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
      if (openUpdateFromTap(response)) {
        return;
      }
      const data = response.notification.request.content.data as { bookingRequestId?: string } | undefined;
      const bookingRequestId = data?.bookingRequestId;
      if (!bookingRequestId) {
        return;
      }

      if (openOfferFromTap(response, bookingRequestId)) {
        return;
      }

      handleOfferAction(response.actionIdentifier, bookingRequestId, {
        accepted: t('bookings.acceptedToastTitle'),
        acceptedMessage: t('bookings.acceptedToastMessage'),
        declined: t('bookings.declinedToastTitle'),
        taken: t('bookings.takenToastTitle'),
        takenMessage: t('bookings.takenToastMessage'),
        error: t('common.errorTitle'),
      });
    });

    return () => subscription.remove();
  }, [t]);

  // Fires the instant a booking-offer notification is received while this app's JS is
  // alive (foreground or backgrounded-but-not-killed) — *before* any tap. This is what
  // pops the big, Rapido-style `IncomingJobModal` (mounted once at the app root, see
  // App.tsx) up immediately over whatever screen the worker happens to be on, rather than
  // waiting for them to pull down the notification tray — the system notification itself
  // (composed by backgroundNotificationTask.ts) is still there underneath as the
  // fully-closed-app fallback, but this is the "big card" experience for the common case
  // of the app already being open or recently used.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { bookingRequestId?: string; kind?: string } | undefined;
      if (!data?.bookingRequestId || data.kind !== 'booking_offer') {
        return;
      }
      Vibration.vibrate([0, 400, 200, 400]);
      usePendingOfferStore.getState().setFocusedOffer(data.bookingRequestId);
    });

    return () => subscription.remove();
  }, []);

  // Covers the specific case `addNotificationResponseReceivedListener` above can miss: the
  // exact tap that *launched* the app (the listener wasn't attached yet at that instant) —
  // per expo-notifications' own documented pattern for this.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (Platform.OS !== 'android' || !lastResponse) {
      return;
    }
    // A shop order (new list to pack, customer cancelled) or a trip update for an accepted job.
    if (openUpdateFromTap(lastResponse)) {
      return;
    }
    const data = lastResponse.notification.request.content.data as { bookingRequestId?: string } | undefined;
    if (data?.bookingRequestId) {
      openOfferFromTap(lastResponse, data.bookingRequestId);
    }
  }, [lastResponse]);
}
