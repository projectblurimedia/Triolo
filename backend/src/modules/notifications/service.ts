import { NotificationsRepository } from './repository';
import { PushNotificationOptions, sendPushNotification } from './pushSender';
import { AUDIENCE_BY_TYPE, NotificationListResult, NotificationType, PushApp, PushAudience } from './interfaces';

const DEFAULT_LIST_LIMIT = 50;

/**
 * Whether a partner may see who viewed their profile (a subscription perk). Set once at
 * startup by the app (app.ts) from the subscriptions module, so this module needs no
 * dependency on it; until set, nobody does.
 */
let profileViewerReveal: ((accountId: string) => Promise<boolean>) | null = null;

export function setProfileViewerReveal(reveal: (accountId: string) => Promise<boolean>): void {
  profileViewerReveal = reveal;
}

async function revealsViewers(accountId: string): Promise<boolean> {
  try {
    return profileViewerReveal ? await profileViewerReveal(accountId) : false;
  } catch {
    return false;
  }
}

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
    // The viewer is remembered; a subscribed partner sees who it was (here and in the list).
    const saved = await this.repository.create({ accountId: recipientAccountId, type: 'profile_view', title, body, actorAccountId: viewerAccountId });
    // Tapping it opens this notification in the partner app (who it was, Call Now).
    const data = { notificationId: saved?.id ?? '' };
    if (await revealsViewers(recipientAccountId)) {
      const name = await this.repository.accountName(viewerAccountId);
      if (name) {
        await this.pushTo(recipientAccountId, 'partner', `${name} viewed your profile`, 'Open Triolo Partner to see your profile views.', { data });
        return;
      }
    }

    // Best-effort, real-time delivery on top of the in-app row above — reaches the
    // recipient's device even if their app is fully closed (see pushSender.ts), same as the
    // in-app list either way once they open the app. No-ops silently if the recipient never
    // registered a push token, or if push isn't configured on this server at all.
    await this.pushTo(recipientAccountId, 'partner', title, body, { data });
  }

  async registerPushToken(accountId: string, token: string, app: PushApp | 'legacy' = 'legacy'): Promise<void> {
    await this.repository.upsertPushToken(accountId, token, app as PushApp);
  }

  async unregisterPushToken(accountId: string, app: PushApp, token?: string): Promise<void> {
    await this.repository.removePushToken(accountId, app, token);
  }

  /**
   * Sends to the account's device(s) in the right app: exact-app tokens first; a 'legacy'
   * token (registered before the apps said which app they are) only when there's none.
   */
  private async pushTo(
    accountId: string,
    audience: PushAudience,
    title: string,
    body: string,
    options?: PushNotificationOptions,
  ): Promise<void> {
    const tokens = await this.repository.findPushTokens(accountId);
    let targets =
      audience === 'any' ? tokens.map((row) => row.token) : tokens.filter((row) => row.app === audience).map((row) => row.token);
    if (targets.length === 0) targets = tokens.filter((row) => row.app === 'legacy').map((row) => row.token);
    for (const token of new Set(targets)) {
      await sendPushNotification(token, title, body, options);
    }
  }

  /**
   * A push with no in-app `notifications` row behind it — for ephemeral, high-frequency
   * events (Quick Book broadcast offers, see modules/bookings) that would otherwise flood
   * the persistent in-app notification list with noise nobody wants to scroll back through
   * later. Other modules call this instead of `notifyProfileViewed()`'s pattern when they
   * want push delivery only. Best-effort like every other push here: no-ops silently if the
   * recipient never registered a device token.
   */
  async sendRawPush(accountId: string, title: string, body: string, options?: PushNotificationOptions): Promise<void> {
    await this.pushTo(accountId, options?.audience ?? 'partner', title, body, options);
  }

  /**
   * An in-app notification row (so it shows in the recipient's notification list) plus a
   * best-effort push — the general form of notifyProfileViewed() for other modules' events
   * (e.g. modules/problems' job updates). Use sendRawPush() instead for ephemeral events that
   * shouldn't pile up in the list.
   */
  async notify(
    accountId: string,
    type: NotificationType,
    title: string,
    body: string,
    pushOptions?: PushNotificationOptions,
  ): Promise<void> {
    await this.repository.create({ accountId, type, title, body });
    await this.pushTo(accountId, pushOptions?.audience ?? AUDIENCE_BY_TYPE[type] ?? 'any', title, body, pushOptions);
  }

  async deleteNotifications(accountId: string, ids: string[]): Promise<number> {
    return this.repository.deleteMany(accountId, ids);
  }

  async listForAccount(accountId: string): Promise<NotificationListResult> {
    const result = await this.repository.findForAccount(accountId, DEFAULT_LIST_LIMIT);
    const reveal = result.items.some((item) => item.type === 'profile_view') && (await revealsViewers(accountId));
    return {
      ...result,
      items: result.items.map((item) => {
        const row = item as typeof item & { actorAccountId?: string | null; actorName?: string | null; actorMobile?: string | null };
        const { actorAccountId: _id, actorName, actorMobile: _mobile, ...rest } = row;
        void _id;
        void _mobile;
        if (rest.type === 'profile_view' && reveal && actorName) {
          return { ...rest, title: `${actorName} viewed your profile`, viewer: { name: actorName } };
        }
        return { ...rest, viewer: null };
      }),
    };
  }

  async markRead(accountId: string, id: string): Promise<void> {
    await this.repository.markRead(accountId, id);
  }

  async markAllRead(accountId: string): Promise<void> {
    await this.repository.markAllRead(accountId);
  }
}
