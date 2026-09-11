/**
 * Shared between `usePushNotifications.ts` (category/channel registration, foreground/
 * backgrounded-alive response handling) and `backgroundNotificationTask.ts` (headless
 * handling while the app is fully closed) — kept in one place so the two files can never
 * drift out of sync on the exact identifier strings the OS routes notification events by.
 */
export const BOOKING_OFFER_CHANNEL = 'booking-offers';
export const BOOKING_OFFER_CATEGORY = 'booking-offer';
export const ACCEPT_ACTION = 'accept';
export const DECLINE_ACTION = 'decline';
