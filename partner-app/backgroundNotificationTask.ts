import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { attemptDecline, updateOfferNotification } from '@/utils/bookingOfferOutcome';
import { BOOKING_OFFER_CATEGORY, BOOKING_OFFER_CHANNEL, DECLINE_ACTION } from '@/constants/bookingNotifications';

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
 * themselves. Every `scheduleNotificationAsync` call here uses `trigger: { channelId:
 * BOOKING_OFFER_CHANNEL }`, not `trigger: null` — a locally scheduled notification's Android
 * channel is selected by the *trigger*, not `content` (`content` has no `channelId` field at
 * all), so `null` was silently falling back to expo-notifications' own generic fallback
 * channel instead of this app's dedicated big/high-importance one.
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
    // Rewrites the notification with the real outcome — accepted, lost the race, or
    // declined — since there's no mounted UI here to show a toast from; the notification
    // itself IS the only feedback surface available in this headless case.
    // Accept is not handled here: its button opens the app, which accepts with visible
    // progress (usePushNotifications.ts → IncomingJobModal). Accepting here as well would
    // send a second accept that fails as "already taken".
    if (payload.actionIdentifier === DECLINE_ACTION) {
      await updateOfferNotification(bookingRequestId, await attemptDecline(bookingRequestId));
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
      trigger: { channelId: BOOKING_OFFER_CHANNEL },
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
      trigger: { channelId: BOOKING_OFFER_CHANNEL },
    });
  }
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {
  // Not yet on a build with expo-task-manager's native module compiled in, or the OS
  // refused registration — usePushNotifications.ts's own registration flow still no-ops
  // safely in that case, same "supplementary, never load-bearing" posture as every other
  // push-related failure mode in this app.
});
