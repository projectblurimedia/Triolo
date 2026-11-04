/**
 * Android notification channels. A channel's sound is fixed when it is first created, so the
 * NearbyU sound (assets/sounds/nearbyu_notification.wav, bundled by the expo-notifications plugin)
 * lives on new channel ids; the backend sends to these (notifications/pushSender.ts).
 * Copied in partner-app — keep in sync.
 */
export const ALERTS_CHANNEL = 'nearbyu-alerts';
export const NOTIFICATION_SOUND = 'nearbyu_notification.wav';
/** Channels from before the chime, removed so they don't linger in the phone's settings. */
export const OLD_CHANNELS = ['default', 'triolo-alerts'];
