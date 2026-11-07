import { NotificationsRepository } from './repository';
import { PushNotificationOptions, sendPushNotification } from './pushSender';
import { AUDIENCE_BY_TYPE, NotificationListResult, NotificationType, PushApp, PushAudience } from './interfaces';

const DEFAULT_LIST_LIMIT = 50;

/**
 * Whether a partner may see who viewed their profile / job post: everyone (plans off, or on
 * the plan for it), or — one by one — the profile views they paid to see (by notification id).
 * Set once at startup by the app (app.ts) from the subscriptions module, so this module needs
 * no dependency on it; until set, nobody is shown.
 */
type ViewerPlan = 'service' | 'shop' | 'job_post';
export interface ViewerAccess {
  reveals: (accountId: string, plan?: ViewerPlan) => Promise<boolean>;
  /** Profile-view notification ids this partner paid to see. */
  unlocked: (accountId: string) => Promise<Set<string>>;
}
let viewerAccess: ViewerAccess | null = null;

export function setProfileViewerAccess(access: ViewerAccess): void {
  viewerAccess = access;
}

/** Whether the partner's plan for that profile (or plans being off) shows who viewed it. */
async function revealsViewers(accountId: string, plan?: ViewerPlan): Promise<boolean> {
  try {
    return viewerAccess ? await viewerAccess.reveals(accountId, plan) : false;
  } catch {
    return false;
  }
}

async function unlockedProfileViews(accountId: string): Promise<Set<string>> {
  try {
    return viewerAccess ? await viewerAccess.unlocked(accountId) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * First slice of the Notifications module (Pending Module 6) — in-app only, polled by the
 * client (see partner-app's `useNotifications` hook), not push/FCM yet. Other modules call
 * into this one's service (never its repository/table directly) to raise a notification —
 * the same module-boundary pattern `admin` already established for reaching into
 * `workers`/`businesses`.
 */
/** Requests that open the full-screen pop-up on phones that support it. */
const POPUP_KINDS = ['booking_offer', 'order_placed'];
/** "Someone else took it": closes that pop-up (as data, on phones that show pop-ups). */
const POPUP_CANCEL_KINDS = ['booking_taken', 'order_taken'];
/** New jobs / orders ring on the urgent channel, not the everyday one. */
const URGENT_CHANNEL = 'booking-offers';

export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  /** Fired when a user opens a Worker/Business's detail card from Nearby Workers/Shops search. */
  async notifyProfileViewed(
    recipientAccountId: string,
    viewerAccountId: string,
    kind?: 'service' | 'shop',
    /** Which profile: its id (opened from the notification) and a label (the shop's name / the work). */
    profile?: { id: string; label: string },
  ): Promise<void> {
    // A verified account can't view its own profile through nearby search (the query
    // excludes the searcher's own listing), but guard anyway rather than assume that holds.
    if (recipientAccountId === viewerAccountId) {
      return;
    }
    // Say which profile — a partner can have services and shops.
    const language = await this.repository.accountLanguage(recipientAccountId);
    const text = profileViewText(language, kind, profile?.label ?? '');
    const title = text.title;
    const body = text.body;
    // The viewer is remembered; a partner on the plan (or with plans off) sees who it was,
    // others can pay to see this one (here and in the list).
    const saved = await this.repository.create({
      accountId: recipientAccountId,
      type: 'profile_view',
      title,
      body,
      actorAccountId: viewerAccountId,
      refKind: kind ?? null,
      refId: profile?.id ?? null,
      app: 'partner',
    });
    // Tapping it opens this notification in the partner app (who it was).
    const data = { notificationId: saved?.id ?? '' };
    if (await revealsViewers(recipientAccountId, kind)) {
      const name = await this.repository.accountName(viewerAccountId);
      if (name) {
        await this.pushTo(recipientAccountId, 'partner', profileViewText(language, kind, profile?.label ?? '', name).title, body, { data });
        return;
      }
    }

    // Best-effort, real-time delivery on top of the in-app row above — reaches the
    // recipient's device even if their app is fully closed (see pushSender.ts), same as the
    // in-app list either way once they open the app. No-ops silently if the recipient never
    // registered a push token, or if push isn't configured on this server at all.
    await this.pushTo(recipientAccountId, 'partner', title, body, { data });
  }

  /**
   * A customer opened one of the partner's job posts. On the job post plan the partner sees who
   * and their number (here and in the list); otherwise "someone", with the plan offered.
   */
  async notifyJobPostViewed(recipientAccountId: string, viewerAccountId: string, post: { id: string; title: string }): Promise<void> {
    if (recipientAccountId === viewerAccountId) return;
    const title = 'Someone viewed your job post';
    const body = `Your "${post.title}" post.`;
    const saved = await this.repository.create({
      accountId: recipientAccountId,
      type: 'job_post_view',
      title,
      body,
      actorAccountId: viewerAccountId,
      refKind: 'job_post',
      refId: post.id,
      app: 'partner',
    });
    const data = { notificationId: saved?.id ?? '', kind: 'job_post_view', postId: post.id };
    if (await revealsViewers(recipientAccountId, 'job_post')) {
      const contact = await this.repository.accountContact(viewerAccountId);
      if (contact) {
        await this.pushTo(recipientAccountId, 'partner', `${contact.name} viewed your job post`, post.title, { data });
        return;
      }
    }
    await this.pushTo(recipientAccountId, 'partner', title, `${body} Open Triolo Partner to see who it was.`, { data });
  }

  /** Marks read the notifications about one thing (e.g. a job post, once its views are opened). */
  async markReadByRef(accountId: string, refKind: string, refId: string): Promise<void> {
    await this.repository.markReadByRef(accountId, refKind, refId);
  }

  async registerPushToken(accountId: string, token: string, app: PushApp | 'legacy' = 'legacy', fullScreen = false): Promise<void> {
    await this.repository.upsertPushToken(accountId, token, app as PushApp, fullScreen);
  }

  async unregisterPushToken(accountId: string, app: PushApp, token?: string): Promise<void> {
    await this.repository.removePushToken(accountId, app, token);
  }

  /** A deleted account: no more pushes, and its notifications are removed. */
  removeAllForAccount(accountId: string): Promise<void> {
    return this.repository.removeAllForAccount(accountId);
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
    let targets = audience === 'any' ? tokens : tokens.filter((row) => row.app === audience);
    if (targets.length === 0) targets = tokens.filter((row) => row.app === 'legacy');
    // A new job or order always goes as a normal notification, which Android shows itself even
    // with the app closed or the phone locked. A data-only message only reaches a closed app if
    // the phone wakes it, and many phones (Vivo, Oppo, Xiaomi, Realme…) don't — sent alone, jobs
    // and orders showed up only once the app was opened. Phones that can show the full-screen
    // pop-up also get it as data; when the app does wake, it opens the pop-up and removes the
    // normal notification (same tag = the job / order id). "Taken" replaces it in place.
    const kind = options?.data?.kind ?? '';
    const popup = POPUP_KINDS.includes(kind);
    const popupCancel = POPUP_CANCEL_KINDS.includes(kind);
    const shown: PushNotificationOptions | undefined =
      popup || popupCancel
        ? {
            ...options,
            tag: options?.tag ?? options?.data?.bookingRequestId ?? options?.data?.orderId,
            channelId: popup ? URGENT_CHANNEL : (options?.channelId ?? URGENT_CHANNEL),
            priority: popup ? 'max' : options?.priority,
          }
        : options;
    const sent = new Set<string>();
    for (const row of targets) {
      if (sent.has(row.token)) continue;
      sent.add(row.token);
      if ((await sendPushNotification(row.token, title, body, shown)) === 'gone') {
        // A dead token (the app was removed or reinstalled): stop sending to it.
        await Promise.resolve(this.repository.removePushToken(accountId, row.app as PushApp, row.token)).catch(() => undefined);
        continue;
      }
      if (row.fullScreen && (popup || popupCancel)) {
        await sendPushNotification(row.token, title, body, {
          ...shown,
          dataOnly: true,
          data: { ...options?.data, [popup ? 'popup' : 'popupCancel']: '1' },
        });
      }
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
    const audience = pushOptions?.audience ?? AUDIENCE_BY_TYPE[type] ?? 'any';
    // Saved for the same app the push goes to, so each app's list holds only its own.
    await this.repository.create({ accountId, type, title, body, app: audience === 'any' ? null : audience });
    await this.pushTo(accountId, audience, title, body, pushOptions);
  }

  async deleteNotifications(accountId: string, ids: string[]): Promise<number> {
    return this.repository.deleteMany(accountId, ids);
  }

  async listForAccount(accountId: string, app?: PushApp): Promise<NotificationListResult> {
    const result = await this.repository.findForAccount(accountId, DEFAULT_LIST_LIMIT, app);
    // Asked once per plan: each profile's views are shown on that profile's own plan.
    const reveals = new Map<string, boolean>();
    const paidFor = result.items.some((item) => item.type === 'profile_view') ? await unlockedProfileViews(accountId) : new Set<string>();
    const reveal = async (plan?: ViewerPlan) => {
      const key = plan ?? '*';
      if (!reveals.has(key)) reveals.set(key, await revealsViewers(accountId, plan));
      return reveals.get(key) as boolean;
    };
    const items = [];
    for (const item of result.items) {
      const row = item as typeof item & { actorAccountId?: string | null; actorName?: string | null; actorMobile?: string | null };
      const { actorAccountId: _id, actorName, actorMobile, ...rest } = row;
      void _id;
      if (rest.type === 'profile_view') {
        const plan = rest.ref?.kind === 'service' || rest.ref?.kind === 'shop' ? rest.ref.kind : undefined;
        items.push(
          actorName && ((await reveal(plan)) || paidFor.has(rest.id))
            ? { ...rest, title: `${actorName} viewed your profile`, viewer: { name: actorName, mobile: actorMobile ?? null }, locked: false }
            : { ...rest, viewer: null, locked: true },
        );
      } else if (rest.type === 'job_post_view') {
        items.push(
          actorName && (await reveal('job_post'))
            ? { ...rest, title: `${actorName} viewed your job post`, viewer: { name: actorName, mobile: actorMobile ?? null }, locked: false }
            : { ...rest, viewer: null, locked: true },
        );
      } else {
        items.push({ ...rest, viewer: null });
      }
    }
    return { ...result, items };
  }

  async markRead(accountId: string, id: string): Promise<void> {
    await this.repository.markRead(accountId, id);
  }

  async markAllRead(accountId: string, app?: PushApp): Promise<void> {
    await this.repository.markAllRead(accountId, app);
  }
}

/** "Someone viewed your shop "Lakshmi Stores"" / "… your worker profile (Electrician)" — en / te. */
function profileViewText(language: 'en' | 'te', kind: 'service' | 'shop' | undefined, label: string, viewer?: string) {
  const shop = kind === 'shop';
  if (language === 'te') {
    const who = viewer ?? 'ఎవరో';
    return shop
      ? { title: `${who} మీ షాప్‌ను చూశారు`, body: label ? `మీ షాప్ "${label}" చూశారు.` : 'మీ షాప్ చూశారు.' }
      : { title: `${who} మీ వర్కర్ ప్రొఫైల్‌ను చూశారు`, body: label ? `మీ ${label} ప్రొఫైల్ చూశారు.` : 'మీ వర్కర్ ప్రొఫైల్ చూశారు.' };
  }
  const who = viewer ?? 'Someone';
  return shop
    ? { title: `${who} viewed your shop`, body: label ? `Your shop "${label}" was viewed.` : 'Your shop was viewed.' }
    : { title: `${who} viewed your worker profile`, body: label ? `Your ${label} profile was viewed.` : 'Your worker profile was viewed.' };
}
