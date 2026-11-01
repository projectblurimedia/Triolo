import { AppError } from '@/common/errors/AppError';
import { SubscriptionsRepository } from './repository';
import {
  customerPlansOn,
  CustomerPassKind,
  FREE_USE_GROUP,
  FREE_USE_KINDS,
  PartnerPlan,
  partnerPlansOn,
  passFee,
  PassKind,
  SubscriptionAudience,
  SubscriptionPlan,
  SubscriptionSettings,
  TrustedIds,
} from './interfaces';

/**
 * What a partner owes after accepting: the one-time fee, or nothing. ('ad' is kept only for
 * older app builds — there are no ads before actions any more.)
 */
export type UnlockNeed = 'ad' | 'pay' | null;
/** How long an accept may stay unpaid before it goes back to other partners. */
export const UNLOCK_WINDOW_MINUTES = 3;

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
  async isActive(accountId: string, audience: SubscriptionAudience, plan?: SubscriptionPlan): Promise<boolean> {
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

  /**
   * How a partner gets to see who viewed their profile / job post: straight away with partner
   * plans off or on the plan for it ('open'); otherwise each viewer is locked until paid for or
   * the plan is bought ('plan').
   */
  async viewerAccess(accountId: string, plan?: PartnerPlan): Promise<'open' | 'plan'> {
    if (!partnerPlansOn(await this.settings())) return 'open';
    return (await this.isActive(accountId, 'partner', plan)) ? 'open' : 'plan';
  }

  /** Whether the partner sees every viewer of that profile without paying (see viewerAccess). */
  async revealsProfileViewers(accountId: string, plan?: PartnerPlan): Promise<boolean> {
    return (await this.viewerAccess(accountId, plan)) === 'open';
  }

  /** The viewers (or job posts' phone numbers) this account paid to see, one by one. */
  async unlockedTargets(accountId: string, kind: 'staff_contact' | 'job_post_viewer' | 'profile_viewer'): Promise<Set<string>> {
    return new Set(await this.repository.unlockedTargets(accountId, kind));
  }

  /**
   * A customer action without a plan (while customer plans are on) uses one paid pass of its
   * kind; with a plan (or plans off) it's free and this returns null. No pass: PAYMENT_REQUIRED
   * with the price.
   */
  async useCustomerPass(accountId: string, kind: Exclude<CustomerPassKind, 'staff_contact'>): Promise<string | null> {
    const settings = await this.settings();
    if (!customerPlansOn(settings)) return null;
    if (await this.isActive(accountId, 'customer')) return null;
    // One already paid for (or given back) first, then the month's free ones, then the fee.
    const paid = await this.repository.consumePass(accountId, kind, null);
    if (paid) return paid;
    if (await this.customerFreeLeft(accountId, kind, settings)) return this.repository.createFreeUse(accountId, kind, null);
    return this.consumeOrAsk(accountId, kind, settings);
  }

  /**
   * How many free uses this customer has left this month for this kind of action — bookings and
   * orders each have their own (0 when none are given).
   */
  async customerFreeLeft(accountId: string, kind: PassKind, settings?: SubscriptionSettings): Promise<number> {
    const group = FREE_USE_GROUP[kind];
    if (!group) return 0;
    const s = settings ?? (await this.settings());
    const limit = group === 'bookings' ? s.customerFreeBookings : s.customerFreeOrders;
    if (!limit) return 0;
    return Math.max(0, limit - (await this.repository.countFreeUsesThisMonth(accountId, FREE_USE_KINDS[group])));
  }

  /**
   * Accepting a job / order someone booked this partner for personally, or publishing a job
   * post, without the plan for that side (while partner plans are on) uses one paid pass.
   */
  async usePartnerPass(accountId: string, kind: 'accept' | 'job_post', plan?: PartnerPlan): Promise<string | null> {
    const settings = await this.settings();
    if (!partnerPlansOn(settings)) return null;
    if (await this.isActive(accountId, 'partner', kind === 'job_post' ? 'job_post' : plan)) return null;
    return this.consumeOrAsk(accountId, kind, settings);
  }

  private async consumeOrAsk(accountId: string, kind: PassKind, settings: SubscriptionSettings): Promise<string> {
    const id = await this.repository.consumePass(accountId, kind, null);
    if (id) return id;
    throw new AppError(403, 'PAYMENT_REQUIRED', 'Pay once or subscribe to continue.', { kind, amount: passFee(settings, kind) });
  }

  /**
   * How many accepts this partner gets free a month on one side — every kind counts: services
   * (Quick Book, personal bookings, nearby problems) or shop (Quick Orders, orders sent to the
   * shop). Null means no limit — every accept free (partner plans off, on that side's plan, or
   * no limit set).
   */
  async acceptLimit(accountId: string, side: 'service' | 'shop'): Promise<number | null> {
    const settings = await this.settings();
    if (!partnerPlansOn(settings)) return null;
    const limit = side === 'service' ? settings.quickBookLimit : settings.quickOrderLimit;
    if (limit == null) return null;
    return (await this.isActive(accountId, 'partner', side)) ? null : limit;
  }

  /**
   * After accepting (never before — someone else could take it meanwhile): free while this
   * month's free accepts last, then the one-time fee (paid before the details open) — or
   * nothing on the plan. `used` counts this month's accepts on that side so far.
   */
  async acceptUnlock(accountId: string, side: 'service' | 'shop', used: () => Promise<number>): Promise<UnlockNeed> {
    const limit = await this.acceptLimit(accountId, side);
    if (limit == null) return null;
    return (await used()) < limit ? null : 'pay';
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
