import { AppError } from '@/common/errors/AppError';
import { SubscriptionsRepository } from './repository';
import { customerPlansOn, PartnerPlan, partnerPlansOn, SubscriptionAudience, SubscriptionSettings, TrustedIds } from './interfaces';

// Short per-instance caches: these are asked on hot paths (every ad, search and booking).
const SETTINGS_TTL_MS = 20 * 1000;
const ACTIVE_TTL_MS = 20 * 1000;

/**
 * What other modules ask about subscriptions — whether someone is subscribed, the settings, the
 * subscribed partners. Depends on nothing but its own table, so any module can use it
 * (bookings, orders, ads, searches, notifications) without a dependency cycle; buying and
 * managing subscriptions is SubscriptionsService.
 */
export class SubscriptionStatusService {
  private settingsCache: { at: number; value: SubscriptionSettings } | null = null;
  private partnerIdsCache = new Map<PartnerPlan, { at: number; value: Set<string> }>();
  private activeCache = new Map<string, { at: number; value: boolean }>();

  constructor(private readonly repository: SubscriptionsRepository) {}

  async settings(): Promise<SubscriptionSettings> {
    if (this.settingsCache && Date.now() - this.settingsCache.at < SETTINGS_TTL_MS) return this.settingsCache.value;
    const value = await this.repository.getSettings();
    this.settingsCache = { at: Date.now(), value };
    return value;
  }

  /** With a partner plan: subscribed to that plan (or an older plan covering everything). */
  async isActive(accountId: string, audience: SubscriptionAudience, plan?: PartnerPlan): Promise<boolean> {
    const key = `${audience}:${plan ?? '*'}:${accountId}`;
    const cached = this.activeCache.get(key);
    if (cached && Date.now() - cached.at < ACTIVE_TTL_MS) return cached.value;
    const value = (await this.repository.findActive(accountId, audience, plan)) !== null;
    this.activeCache.set(key, { at: Date.now(), value });
    return value;
  }

  /** Clears what this instance remembers (after a purchase or a settings change). */
  forget(accountId?: string): void {
    this.settingsCache = null;
    this.partnerIdsCache.clear();
    if (accountId) {
      for (const key of [...this.activeCache.keys()]) if (key.endsWith(`:${accountId}`)) this.activeCache.delete(key);
    } else {
      this.activeCache.clear();
    }
  }

  /**
   * Quick Book, booking a particular worker and ordering from a shop need a subscription
   * while customer subscriptions are on.
   */
  async requireCustomer(accountId: string): Promise<void> {
    const settings = await this.settings();
    if (!customerPlansOn(settings)) return;
    if (await this.isActive(accountId, 'customer')) return;
    throw new AppError(403, 'SUBSCRIPTION_REQUIRED', 'Subscribe to book workers and order from shops.');
  }

  /**
   * Partners subscribed to this plan (while partner subscriptions are on): their services /
   * shop / job posts come first in customers' searches.
   */
  async priorityPartnerIds(plan: PartnerPlan): Promise<string[]> {
    const settings = await this.settings();
    if (!partnerPlansOn(settings)) return [];
    const cached = this.partnerIdsCache.get(plan);
    if (cached && Date.now() - cached.at <= ACTIVE_TTL_MS) return [...cached.value];
    const value = new Set(await this.repository.activeAccountIds('partner', plan));
    this.partnerIdsCache.set(plan, { at: Date.now(), value });
    return [...value];
  }

  /**
   * Subscribed workers' head start on Quick Book offers and new problems, or null when there's
   * none (partner subscriptions off, or 0 seconds).
   */
  async headStart(): Promise<{ seconds: number; subscriberIds: Set<string> } | null> {
    const settings = await this.settings();
    if (!partnerPlansOn(settings) || settings.headStartSeconds <= 0) return null;
    return { seconds: settings.headStartSeconds, subscriberIds: new Set(await this.priorityPartnerIds('service')) };
  }

  /** Partners on the plan for that profile see who viewed it. */
  async revealsProfileViewers(accountId: string, plan?: PartnerPlan): Promise<boolean> {
    if (!partnerPlansOn(await this.settings())) return false;
    return this.isActive(accountId, 'partner', plan);
  }

  /**
   * Booking or ordering without a plan (while customer plans are on) uses one paid pass; with a
   * plan (or plans off) it's free and this returns null. No pass: PAYMENT_REQUIRED with the price.
   */
  async useCustomerPass(accountId: string, kind: 'book' | 'order'): Promise<string | null> {
    const settings = await this.settings();
    if (!customerPlansOn(settings)) return null;
    if (await this.isActive(accountId, 'customer')) return null;
    const id = await this.repository.consumePass(accountId, kind, null);
    if (id) return id;
    throw new AppError(403, 'PAYMENT_REQUIRED', 'Pay once or subscribe to continue.', {
      kind,
      amount: kind === 'book' ? settings.customerFees.book : settings.customerFees.order,
    });
  }

  /**
   * Accepting work without a plan, or publishing any job post (each post is paid for, even with a
   * plan), while partner plans are on, uses one paid pass.
   */
  async usePartnerPass(accountId: string, kind: 'accept' | 'job_post', plan?: PartnerPlan): Promise<string | null> {
    const settings = await this.settings();
    if (!partnerPlansOn(settings)) return null;
    // Accepting is free on the plan for that side (services for jobs, shop for orders).
    if (kind !== 'job_post' && (await this.isActive(accountId, 'partner', plan))) return null;
    const id = await this.repository.consumePass(accountId, kind, null);
    if (id) return id;
    throw new AppError(403, 'PAYMENT_REQUIRED', 'Pay once or subscribe to continue.', {
      kind,
      amount: kind === 'accept' ? settings.partnerFees.accept : settings.partnerFees.jobPost,
    });
  }

  attachPass(id: string | null, ref: string): Promise<void> {
    return id ? this.repository.attachPass(id, ref) : Promise.resolve();
  }

  /** Gives passes back: by what they were used for, or by pass id. */
  restorePasses(refs: string[], ids: (string | null)[] = []): Promise<void> {
    return this.repository.restorePasses(refs, ids.filter((id): id is string => !!id));
  }

  /** Whose phone numbers this customer may see: everyone (plan, or plans off), or the posts paid for. */
  async staffContactAccess(accountId: string): Promise<{ all: boolean; ids: Set<string> }> {
    const settings = await this.settings();
    if (!customerPlansOn(settings) || (await this.isActive(accountId, 'customer'))) return { all: true, ids: new Set() };
    return { all: false, ids: new Set(await this.repository.unlockedStaffPosts(accountId)) };
  }

  private trustedCache: { at: number; value: TrustedIds } | null = null;

  /** Profiles with an active Trusted by Triolo badge (cached a minute). */
  async trustedIds(): Promise<TrustedIds> {
    if (this.trustedCache && Date.now() - this.trustedCache.at < 60 * 1000) return this.trustedCache.value;
    const value = await this.repository.trustedIds();
    this.trustedCache = { at: Date.now(), value };
    return value;
  }
}
