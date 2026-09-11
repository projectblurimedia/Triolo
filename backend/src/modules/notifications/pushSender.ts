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

export async function sendPushNotification(token: string, title: string, body: string): Promise<void> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return;
  }

  try {
    await getMessaging(firebaseApp).send({ token, notification: { title, body } });
  } catch (err) {
    logger.warn({ err }, 'Push notification failed to send');
  }
}
