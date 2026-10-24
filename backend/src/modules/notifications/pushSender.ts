import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from '@/common/utils/logger';

/**
 * Sends directly to Google's FCM HTTP v1 API via `firebase-admin`, not through Expo's own
 * push-notification relay — bypassing that relay avoids needing to configure FCM V1
 * credentials inside EAS (`eas credentials`), which is an interactive wizard this
 * environment has no TTY to drive (see the same underlying constraint documented for the
 * EAS Android keystore setup in `.cloud/project-context.md`). The client instead gets the
 * device's raw native FCM token via `expo-notifications`' `getDevicePushTokenAsync()`
 * (Android only, no Expo relay involved) and this sends straight to that token.
 *
 * `FIREBASE_SERVICE_ACCOUNT_JSON` is the full JSON contents of a Firebase service-account
 * key (Firebase Console → Project Settings → Service Accounts → Generate new private key),
 * stored as a single env var (never committed to git — the same "user supplies their own
 * credentials via env vars" pattern already established for Cloudinary). Lazily
 * initialized, and every call is best-effort: a push failure (missing config, invalid
 * token, FCM outage, ...) is logged and swallowed, never thrown — this is a supplementary
 * delivery channel on top of the in-app/polled notification, which still works regardless.
 */
let app: App | null | undefined;

function getFirebaseApp(): App | null {
  if (app !== undefined) {
    return app;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not configured — push notifications will be skipped');
    app = null;
    return app;
  }

  try {
    app = initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Firebase Admin SDK for push notifications');
    app = null;
  }

  return app;
}

/**
 * `tag`/`channelId`/`priority` exist for the Quick Book broadcast (see modules/bookings) —
 * `tag` makes a follow-up push (e.g. "this job was taken") REPLACE the original notification
 * in place on the recipient's device via native Android OS behavior, rather than needing a
 * custom dismiss-on-receipt handler; `channelId`/`priority: 'max'` is what makes that
 * notification actually show big/heads-up instead of a quiet inbox entry, since Android's
 * per-channel importance (set client-side once, at channel-creation time) is what ultimately
 * governs display prominence — this `priority` field only requests it.
 *
 * `dataOnly` sends the message with **no** `notification` block at all — FCM's own
 * `notification` payload type cannot carry action buttons on Android (there is no field for
 * it), so a notification that needs real Accept/Reject buttons has to arrive as pure `data`
 * and be composed into a local, actionable notification by the client itself (see
 * partner-app's `backgroundNotificationTask.ts`, which runs even with the app fully killed).
 * `tag`/`channelId`/`priority` are folded into `data` in this mode too, since the client is
 * the one building the eventual notification and needs to know what to build it with.
 */
export interface PushNotificationOptions {
  /** Which app to deliver to (see AUDIENCE_BY_TYPE); defaults per notification type. */
  audience?: 'user' | 'partner' | 'any';
  data?: Record<string, string>;
  tag?: string;
  channelId?: string;
  priority?: 'default' | 'high' | 'max';
  dataOnly?: boolean;
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  options: PushNotificationOptions = {},
): Promise<void> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return;
  }

  const data: Record<string, string> = { ...options.data };
  if (options.tag) data.tag = options.tag;
  if (options.channelId) data.channelId = options.channelId;
  if (options.priority) data.priority = options.priority;
  if (options.dataOnly) {
    data.title = title;
    data.body = body;
  } else {
    // Android shows this one itself: partner-app's background task must not show it again.
    data.presented = 'os';
  }

  try {
    await getMessaging(firebaseApp).send({
      token,
      notification: options.dataOnly ? undefined : { title, body },
      data: Object.keys(data).length > 0 ? data : undefined,
      android: {
        priority: 'high',
        notification: options.dataOnly
          ? undefined
          : {
              tag: options.tag,
              channelId: options.channelId,
              priority: options.priority,
              defaultSound: true,
              visibility: options.priority === 'max' ? 'public' : undefined,
            },
      },
    });
  } catch (err) {
    logger.warn({ err }, 'Push notification failed to send');
  }
}
