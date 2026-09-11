import { NotificationsRepository } from './repository';
import { sendPushNotification } from './pushSender';
import { NotificationListResult } from './interfaces';

const DEFAULT_LIST_LIMIT = 50;

/**
 * First slice of the Notifications module (Pending Module 6) — in-app only, polled by the
 * client (see partner-app's `useNotifications` hook), not push/FCM yet. Other modules call
 * into this one's service (never its repository/table directly) to raise a notification —
 * the same module-boundary pattern `admin` already established for reaching into
 * `workers`/`businesses`.
 */
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  /** Fired when a user opens a Worker/Business's detail card from Nearby Workers/Shops search. */
  async notifyProfileViewed(recipientAccountId: string, viewerAccountId: string): Promise<void> {
    // A verified account can't view its own profile through nearby search (the query
    // excludes the searcher's own listing), but guard anyway rather than assume that holds.
    if (recipientAccountId === viewerAccountId) {
      return;
    }
    const title = 'Profile Viewed';
    const body = 'Someone viewed your profile.';
    await this.repository.create({ accountId: recipientAccountId, type: 'profile_view', title, body });

    // Best-effort, real-time delivery on top of the in-app row above — reaches the
    // recipient's device even if their app is fully closed (see pushSender.ts), same as the
    // in-app list either way once they open the app. No-ops silently if the recipient never
    // registered a push token, or if push isn't configured on this server at all.
    const pushToken = await this.repository.findPushToken(recipientAccountId);
    if (pushToken) {
      await sendPushNotification(pushToken, title, body);
    }
  }

  async registerPushToken(accountId: string, token: string): Promise<void> {
    await this.repository.upsertPushToken(accountId, token);
  }

  async listForAccount(accountId: string): Promise<NotificationListResult> {
    return this.repository.findForAccount(accountId, DEFAULT_LIST_LIMIT);
  }

  async markRead(accountId: string, id: string): Promise<void> {
    await this.repository.markRead(accountId, id);
  }

  async markAllRead(accountId: string): Promise<void> {
    await this.repository.markAllRead(accountId);
  }
}
