import * as Notifications from 'expo-notifications';
import { ApiError } from '@/services/apiClient';
import { bookingOffersService } from '@/services/bookingOffersService';
import i18n from '@/localization/i18n';
import { BOOKING_OFFER_CHANNEL } from '@/constants/bookingNotifications';
import { isLocationOn } from './requireLocation';

export type OfferOutcome = 'accepted' | 'declined' | 'already_taken' | 'location_off' | 'payment' | 'error';

/**
 * Plain (non-React) accept/decline attempts, callable from anywhere — including
 * backgroundNotificationTask.ts's headless context, where hooks/mutations don't exist.
 * `ApiError`'s `code` is what distinguishes "someone else won the race" (already_taken,
 * an expected, non-broken outcome) from a genuine failure (error) — without this check,
 * both looked identical to the caller, which is why a losing device previously showed a
 * generic "Something Went Wrong" instead of the actual, clear reason.
 */
export async function attemptAccept(bookingRequestId: string): Promise<OfferOutcome> {
  // Like every partner action, taking a job needs location on. From a notification button
  // there's no way to show the "turn on location" dialog, so just say so.
  if (!(await isLocationOn())) return 'location_off';
  try {
    await bookingOffersService.accept(bookingRequestId);
    return 'accepted';
  } catch (err) {
    if (err instanceof ApiError && err.code === 'PAYMENT_REQUIRED') return 'payment';
    return err instanceof ApiError && err.code === 'BOOKING_ALREADY_TAKEN' ? 'already_taken' : 'error';
  }
}

export async function attemptDecline(bookingRequestId: string): Promise<OfferOutcome> {
  try {
    await bookingOffersService.decline(bookingRequestId);
    return 'declined';
  } catch {
    return 'error';
  }
}

/**
 * Rewrites the job-offer notification — same `identifier` (bookingRequestId), so this
 * REPLACES it in place rather than stacking a second one — to reflect what actually
 * happened, stripping the Accept/Reject actions once there's nothing left to act on. This
 * is the only way a *headless* accept/decline (the background task, app fully closed) can
 * ever show the worker an outcome at all — there's no mounted UI to toast from there. A
 * plain 'error' outcome deliberately leaves the notification untouched — a transient
 * network failure shouldn't permanently strand an otherwise-still-open offer as
 * unreachable; the worker can just tap Accept again.
 *
 * `trigger: { channelId }` (not `trigger: null`) matters even beyond this outcome
 * update — it's what actually selects which Android notification channel a *locally
 * scheduled* notification posts to at all (unlike a remote push, `content` itself has no
 * `channelId` field; the OS reads it off the trigger). Passing `null` silently fell back
 * to expo-notifications' own generic fallback channel instead of the dedicated
 * `booking-offers` one — the root cause of a broadcast offer rendering as a small, plain
 * notification instead of the intended big/heads-up one.
 */
export async function updateOfferNotification(bookingRequestId: string, outcome: OfferOutcome): Promise<void> {
  if (outcome === 'error') return;
  const content =
    outcome === 'accepted'
      ? { title: i18n.t('bookings.acceptedToastTitle'), body: i18n.t('bookings.acceptedToastMessage') }
      : outcome === 'already_taken'
        ? { title: i18n.t('bookings.takenToastTitle'), body: i18n.t('bookings.takenToastMessage') }
        : outcome === 'location_off'
          ? { title: i18n.t('location.disabledTitle'), body: i18n.t('location.acceptNeedsLocation') }
          : outcome === 'payment'
            ? { title: i18n.t('payGate.notificationTitle'), body: i18n.t('payGate.notificationBody') }
            : { title: i18n.t('bookings.declinedToastTitle') };
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: bookingRequestId,
      content: { ...content, data: { bookingRequestId } },
      trigger: { channelId: BOOKING_OFFER_CHANNEL },
    });
  } catch {
    // Best-effort — if this fails, the original actionable notification just stays as it
    // was, a stale-but-harmless UI state, not a functional problem (the actual accept/
    // decline server call above already succeeded or failed on its own).
  }
}
