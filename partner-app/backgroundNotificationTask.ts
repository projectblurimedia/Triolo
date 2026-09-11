import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { bookingOffersService } from '@/services/bookingOffersService';
import { ACCEPT_ACTION, BOOKING_OFFER_CATEGORY, DECLINE_ACTION } from '@/constants/bookingNotifications';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

/**
 * Registered here — module scope, required early by `index.ts` (before `registerRootComponent`)
 * per Expo's own documented pattern — so it's wired up before any React code runs, since
 * Android can invoke this task headlessly (no Activity, no mounted App component) both for a
 * silent data push arriving and for an Accept/Reject action tap while this app is fully
 * closed (see `registerTaskAsync`'s own doc comment: "Only on Android, the task also runs in
 * response to a notification action tap when the app is backgrounded or terminated").
 *
 * This is the other half of Quick Book's push design (see backend's
 * `modules/bookings/service.ts` and `pushSender.ts`'s `dataOnly` option): every booking-offer
 * push arrives as FCM **data only**, deliberately — FCM's own `notification` payload type has
 * no field for action buttons on Android, so nothing genuinely actionable can come from an
 * OS-auto-rendered notification. This task is what turns that bare data into a real,
 * actionable local notification (`scheduleNotificationAsync`, `categoryIdentifier:
 * BOOKING_OFFER_CATEGORY` — registered by `usePushNotifications.ts`, and persisted by
 * expo-notifications across app restarts/headless runs, so it doesn't need to be
 * re-registered here) — which, per expo-notifications' Android notification builder, is
 * automatically shown with `BigTextStyle` (the full body text, not truncated), i.e. the
 * "bigger, like a mini app" presentation that was asked for, plus the Accept/Reject buttons
 * themselves.
 */
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }

  const payload = data as Notifications.NotificationTaskPayload;

  // A response to a *previously shown* notification — either one of our own Accept/Reject
  // action buttons, or the notification body itself (though a body tap normally foregrounds
  // the app instead, handled by usePushNotifications.ts's ordinary response listener, so
  // reaching this branch headlessly is specifically the "silent" Accept/Reject case).
  if (payload && 'actionIdentifier' in payload) {
    const bookingRequestId = payload.notification?.request?.content?.data?.bookingRequestId as string | undefined;
    if (!bookingRequestId) {
      return;
    }
    try {
      if (payload.actionIdentifier === ACCEPT_ACTION) {
        await bookingOffersService.accept(bookingRequestId);
      } else if (payload.actionIdentifier === DECLINE_ACTION) {
        await bookingOffersService.decline(bookingRequestId);
      }
    } catch {
      // Best-effort, same as every other push-adjacent call in this app — the polled
      // Bookings list (useBookingOffers) is the source of truth regardless of whether this
      // silent, headless call happened to succeed; there is no UI here to surface an error to.
    }
    return;
  }

  // A fresh data-only push arrived — compose the actual notification ourselves.
  const remoteData = (payload && 'data' in payload ? payload.data : undefined) as Record<string, string> | undefined;
  const bookingRequestId = remoteData?.bookingRequestId;
  if (!remoteData || !bookingRequestId) {
    return;
  }

  if (remoteData.kind === 'booking_taken') {
    // Same `identifier` as the original offer notification below — this REPLACES it in
    // place (Android/expo-notifications treats matching identifiers as one notification,
    // not two stacked ones) with no actions, since there's nothing left to accept.
    await Notifications.scheduleNotificationAsync({
      identifier: bookingRequestId,
      content: { title: remoteData.title, body: remoteData.body, data: { bookingRequestId } },
      trigger: null,
    });
    return;
  }

  if (remoteData.kind === 'booking_offer') {
    await Notifications.scheduleNotificationAsync({
      identifier: bookingRequestId,
      content: {
        title: remoteData.title,
        body: remoteData.body,
        data: { bookingRequestId },
        categoryIdentifier: BOOKING_OFFER_CATEGORY,
        priority: 'max',
      },
      trigger: null,
    });
  }
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {
  // Not yet on a build with expo-task-manager's native module compiled in, or the OS
  // refused registration — usePushNotifications.ts's own registration flow still no-ops
  // safely in that case, same "supplementary, never load-bearing" posture as every other
  // push-related failure mode in this app.
});
