import { AppError } from '@/common/errors/AppError';
import { razorpayService } from '@/common/services/razorpayService';
import { logger } from '@/common/utils/logger';
import type { WorkersService } from '@/modules/workers/service';
import type { BusinessesService } from '@/modules/businesses/service';
import type { JobSeekersService } from '@/modules/jobSeekers/service';
import type { NotificationsService } from '@/modules/notifications/service';
import { SubscriptionsRepository } from './repository';
import { SubscriptionStatusService } from './statusService';
import {
  AdminBadgeRow,
  AdminSubscriptionRow,
  BadgeKind,
  customerPlansOn,
  MyBadges,
  MyProfileBadge,
  MySubscription,
  partnerPlansOn,
  SubscriptionAudience,
  SubscriptionMonths,
  SubscriptionOverview,
  SubscriptionSettings,
  TrustedIds,
  CUSTOMER_PASS_KINDS,
  FREE_USE_KINDS,
  PARTNER_PASS_KINDS,
  PER_TARGET_KINDS,
  passFee,
  PassKind,
  PARTNER_PLANS,
  PartnerPlan,
  PlanState,
} from './interfaces';

const TRUSTED_TTL_MS = 60 * 1000;
const BADGE_LABEL: Record<BadgeKind, string> = { service: 'worker profile', business: 'shop', job_post: 'job post' };

/** Sent to the partner when the admin removes their badge (in their language). */
function badgeRemovedText(language: 'en' | 'te', kind: BadgeKind, reason: string): { title: string; body: string } {
  if (language === 'te') {
    const what = kind === 'service' ? 'మీ సేవల ప్రొఫైల్' : kind === 'business' ? 'మీ షాప్' : 'మీ జాబ్ పోస్ట్';
    return {
      title: '"Trusted by Triolo" బ్యాడ్జ్ తొలగించబడింది',
      body: `${what} నుండి బ్యాడ్జ్ తొలగించబడింది. కారణం: ${reason}. మళ్లీ పొందడానికి ప్రొఫైల్‌లో కొనవచ్చు.`,
    };
  }
  return {
    title: '"Trusted by Triolo" badge removed',
    body: `The badge was removed from your ${BADGE_LABEL[kind]}. Reason: ${reason}. You can buy it again from your profile.`,
  };
}

interface Deps {
  workers: WorkersService;
  businesses: BusinessesService;
  jobSeekers: JobSeekersService;
  notifications: NotificationsService;
}

/**
 * Subscriptions (customers: no ads + booking / ordering; partners: first to hear of jobs, no
 * ads, first in searches, who viewed their profile) and "Trusted by Triolo" badges per profile.
 * Paid with Razorpay payment links the apps open in the browser; `check*` asks Razorpay and
 * starts what was paid for. Owns `subscription_settings`, `subscriptions` and `profile_badges`;
 * reads profiles through the workers / businesses / job-seekers services.
 */
/** What a pay-per-use payment is for (shown on the Razorpay page). */
const PASS_LABEL: Record<PassKind, string> = {
  quick_book: 'Triolo — one Quick Book',
  direct_book: 'Triolo — book a particular worker',
  quick_order: 'Triolo — one Quick Order',
  shop_order: 'Triolo — order from a particular shop',
  post_problem: 'Triolo — post a problem',
  staff_contact: "Triolo — a job seeker's phone number",
  accept: 'Triolo Partner — accept a personal booking or order',
  job_post: 'Triolo Partner — publish a job post',
  job_post_viewer: 'Triolo Partner — see who viewed your job post',
  profile_viewer: 'Triolo Partner — see who viewed your profile',
};

/** Which partner plan a payment is for (shown on the Razorpay page). */
const PLAN_LABEL: Record<PartnerPlan, string> = { service: '(services)', shop: '(shop)', job_post: '(job posts)' };

/** What the apps pay for in-app: a one-time pass, a plan, or a Trusted badge. */
export type InAppPayType = 'pass' | 'subscription' | 'badge';

export class SubscriptionsService {
  private trustedCache: { at: number; value: TrustedIds } | null = null;

  constructor(
    private readonly repository: SubscriptionsRepository,
    private readonly status: SubscriptionStatusService,
    private readonly deps: Deps,
  ) {}

  // --- Apps: subscriptions ---

  /** One partner plan's prices, running plan and open payment. */
  private async planState(accountId: string, plan: PartnerPlan | 'all', settings: SubscriptionSettings): Promise<PlanState> {
    // 'all' (the all-in-one plan) is looked up as a plan of its own.
    const asPlan = plan as PartnerPlan;
    const [active, lastEnd, pending] = await Promise.all([
      this.repository.findActive(accountId, 'partner', asPlan),
      this.repository.findLastEnd(accountId, 'partner', asPlan),
      this.repository.findPending(accountId, 'partner', asPlan),
    ]);
    return {
      prices: plan === 'all' ? settings.partnerPrices : settings.partnerPlanPrices[plan],
      active: active ? { months: active.months, startsAt: active.startsAt as string, endsAt: lastEnd ?? (active.endsAt as string) } : null,
      pending: pending?.paymentUrl ? { id: pending.id, months: pending.months, amount: pending.amount, paymentUrl: pending.paymentUrl } : null,
    };
  }

  async getMine(accountId: string, audience: SubscriptionAudience): Promise<MySubscription> {
    const settings = await this.repository.getSettings();
    const [active, lastEnd, pending] = await Promise.all([
      this.repository.findActive(accountId, audience),
      this.repository.findLastEnd(accountId, audience),
      this.repository.findPending(accountId, audience),
    ]);
    return {
      enabled: audience === 'customer' ? customerPlansOn(settings) : partnerPlansOn(settings),
      prices: audience === 'customer' ? settings.customerPrices : settings.partnerPrices,
      // Ends at the end of any time already bought ahead.
      active: active ? { months: active.months, startsAt: active.startsAt as string, endsAt: lastEnd ?? (active.endsAt as string) } : null,
      pending: pending?.paymentUrl
        ? { id: pending.id, months: pending.months, amount: pending.amount, paymentUrl: pending.paymentUrl }
        : null,
      // Keyed by pass kind.
      fees: Object.fromEntries(
        (audience === 'customer' ? CUSTOMER_PASS_KINDS : PARTNER_PASS_KINDS).map((kind) => [kind, passFee(settings, kind)]),
      ),
      passes: await this.repository.countPaidPasses(accountId),
      ...(audience === 'partner'
        ? {
            headStartSeconds: settings.headStartSeconds,
            limits: { quickBook: settings.quickBookLimit, quickOrder: settings.quickOrderLimit },
          }
        : {
            freeUses: {
              // limit null: no limit (every one free); 0 / none given: null (pay from the first).
              bookings:
                settings.customerFreeBookings === 0
                  ? null
                  : { limit: settings.customerFreeBookings, used: await this.repository.countFreeUsesThisMonth(accountId, FREE_USE_KINDS.bookings) },
              orders:
                settings.customerFreeOrders === 0
                  ? null
                  : { limit: settings.customerFreeOrders, used: await this.repository.countFreeUsesThisMonth(accountId, FREE_USE_KINDS.orders) },
            },
          }),
      ...(audience === 'partner'
        ? {
            plans: Object.fromEntries(
              await Promise.all(
                [...PARTNER_PLANS, 'all' as const].map(async (plan) => [plan, await this.planState(accountId, plan, settings)] as const),
              ),
            ) as Record<PartnerPlan | 'all', PlanState>,
          }
        : {}),
    };
  }

  /**
   * Starts paying for one use (or a job seeker's phone number). Free (plan, or plans off) or
   * already paid: { paid: true } straight away. Otherwise a payment link — a started one is reused.
   */
  /**
   * `inApp`: the app pays with Razorpay's own screen (POST /pay/order), so no payment link is made —
   * links are only for older installs (and Razorpay's test mode allows only a few of them).
   */
  async passCheckout(accountId: string, kind: PassKind, targetId: string | null, plan?: PartnerPlan, inApp = false) {
    const settings = await this.repository.getSettings();
    const audience = (CUSTOMER_PASS_KINDS as readonly PassKind[]).includes(kind) ? 'customer' : 'partner';
    const plansOn = audience === 'customer' ? customerPlansOn(settings) : partnerPlansOn(settings);
    // The plan that makes it free: the customer plan, or the partner plan for that side.
    const partnerPlan: PartnerPlan | undefined = kind === 'job_post' || kind === 'job_post_viewer' ? 'job_post' : plan;
    const covered = await this.status.isActive(accountId, audience, audience === 'partner' ? partnerPlan : undefined);
    if (!plansOn || covered) return { id: null, paid: true, amount: 0, paymentUrl: null };
    // One particular thing (a phone number, a viewer): paid once, then always shown.
    const perTarget = PER_TARGET_KINDS.includes(kind);
    // A customer booking / order / post still within the month's free ones: nothing to pay.
    if (audience === 'customer' && !perTarget && (await this.status.customerFreeLeft(accountId, kind, settings)) > 0) {
      return { id: null, paid: true, amount: 0, paymentUrl: null };
    }
    if (perTarget) {
      if (!targetId) throw AppError.badRequest('Which one?', 'VALIDATION_ERROR');
      if ((await this.repository.unlockedTargets(accountId, kind)).includes(targetId)) {
        return { id: null, paid: true, amount: 0, paymentUrl: null };
      }
    }
    const existing = await this.repository.findUsablePass(accountId, kind, perTarget ? targetId : null);
    if (existing?.status === 'paid') return { id: existing.id, paid: true, amount: existing.amount, paymentUrl: null };
    if (existing && (existing.paymentUrl || inApp)) {
      return { id: existing.id, paid: false, amount: existing.amount, paymentUrl: existing.paymentUrl ?? null };
    }

    const amount = passFee(settings, kind);
    const contact = await this.repository.accountContact(accountId);
    if (!contact) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    const pass = await this.repository.createPass(accountId, kind, amount, perTarget ? targetId : null);
    if (amount <= 0) {
      // A free use (the admin set ₹0): paid at once.
      await this.repository.markPassPaid(pass.id, `free-${pass.id}`);
      return { id: pass.id, paid: true, amount: 0, paymentUrl: null };
    }
    if (inApp) return { id: pass.id, paid: false, amount, paymentUrl: null };
    const link = await razorpayService.createPaymentLink({
      amountPaise: amount * 100,
      description: PASS_LABEL[kind],
      referenceId: `pass-${pass.id}`.slice(0, 40),
      customer: { name: contact.name, contact: contact.mobile },
      notes: { passId: pass.id, kind },
    });
    await this.repository.setPassLink(pass.id, link.id, link.short_url);
    return { id: pass.id, paid: false, amount, paymentUrl: link.short_url };
  }

  /** Whether a pass's payment went through (and marks it paid once). */
  async passCheckPayment(accountId: string, id: string): Promise<{ paid: boolean }> {
    const pass = await this.repository.findPass(id);
    if (!pass || pass.accountId !== accountId) throw AppError.notFound('Payment not found.', 'PASS_NOT_FOUND');
    if (pass.status !== 'unpaid') return { paid: true };
    if (!pass.razorpayLinkId) return { paid: false };
    const paymentId = await razorpayService.paidLinkPayment(pass.razorpayLinkId, pass.amount * 100);
    if (!paymentId) return { paid: false };
    await this.repository.markPassPaid(pass.id, paymentId);
    return { paid: true };
  }

  // --- In-app checkout (Razorpay's own screen in the apps, which lists the phone's UPI apps) ---

  /** What an unpaid pass, plan or badge costs and is called, or an error when it's not this account's or already paid. */
  private async payable(accountId: string, type: InAppPayType, id: string): Promise<{ amount: number; description: string }> {
    if (type === 'pass') {
      const pass = await this.repository.findPass(id);
      if (!pass || pass.accountId !== accountId) throw AppError.notFound('Payment not found.', 'PASS_NOT_FOUND');
      if (pass.status !== 'unpaid') throw AppError.conflict('Already paid.', 'ALREADY_PAID');
      return { amount: pass.amount, description: PASS_LABEL[pass.kind] };
    }
    if (type === 'subscription') {
      const subscription = await this.repository.findSubscription(id);
      if (!subscription || subscription.accountId !== accountId) throw AppError.notFound('Not found.', 'SUBSCRIPTION_NOT_FOUND');
      if (subscription.status !== 'unpaid') throw AppError.conflict('Already paid.', 'ALREADY_PAID');
      return { amount: subscription.amount, description: `Triolo subscription — ${subscription.months} month${subscription.months === 1 ? '' : 's'}` };
    }
    const badge = await this.repository.findBadge(id);
    if (!badge || badge.accountId !== accountId) throw AppError.notFound('Not found.', 'BADGE_NOT_FOUND');
    if (badge.status !== 'unpaid') throw AppError.conflict('Already paid.', 'ALREADY_PAID');
    return { amount: badge.amount, description: 'Trusted by Triolo badge' };
  }

  /** A Razorpay order for something started with a checkout above, for the app's in-app payment screen. */
  async inAppOrder(accountId: string, type: InAppPayType, id: string) {
    const { amount, description } = await this.payable(accountId, type, id);
    const contact = await this.repository.accountContact(accountId);
    const order = await razorpayService.createOrder(amount * 100, `${type}-${id}`.slice(0, 40), { type, id, accountId });
    return {
      keyId: razorpayService.keyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      description,
      prefill: { name: contact?.name ?? '', contact: contact?.mobile ?? '' },
    };
  }

  /**
   * The in-app payment succeeded: the signature proves it came from Razorpay, the order says what
   * it was for, and the payment is taken (captured) — then the pass / plan / badge is marked paid.
   */
  async inAppConfirm(
    accountId: string,
    body: { type: InAppPayType; id: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ): Promise<{ paid: boolean }> {
    if (!razorpayService.signatureValid(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)) {
      throw AppError.badRequest('The payment could not be verified.', 'PAYMENT_INVALID');
    }
    const order = await razorpayService.order(body.razorpayOrderId);
    const notes = order.notes ?? {};
    if (notes.type !== body.type || notes.id !== body.id || notes.accountId !== accountId) {
      throw AppError.badRequest('This payment is not for this.', 'PAYMENT_INVALID');
    }
    let payment = await razorpayService.payment(body.razorpayPaymentId);
    if (payment.order_id !== order.id || payment.amount !== order.amount) throw AppError.badRequest('This payment is not for this.', 'PAYMENT_INVALID');
    if (payment.status === 'authorized') payment = await razorpayService.capture(payment.id, payment.amount);
    if (payment.status !== 'captured') throw AppError.conflict('The payment has not gone through yet.', 'PAYMENT_NOT_DONE');
    if (body.type === 'pass') {
      await this.repository.markPassPaid(body.id, payment.id);
    } else if (body.type === 'subscription') {
      await this.repository.activateSubscription(body.id, payment.id);
      this.status.forget(accountId);
    } else {
      const badge = await this.repository.findBadge(body.id);
      if (badge && badge.status === 'unpaid') {
        if (await this.repository.findActiveBadge(badge.kind, badge.profileId)) {
          logger.warn({ badgeId: badge.id, paymentId: payment.id }, 'Badge paid while another is active — refund it from Razorpay');
        } else {
          await this.repository.activateBadge(badge.id, payment.id);
          this.trustedCache = null;
        }
      }
    }
    return { paid: true };
  }

  listPasses(filter: Parameters<SubscriptionsRepository['listPasses']>[0]) {
    return this.repository.listPasses(filter);
  }

  /** Starts paying for a plan: a payment link to open (the plan starts once it's paid). */
  /**
   * Starts paying for a plan: a payment link to open (the plan starts once it's paid). Partners
   * choose which plan (services, shop or job posts); without one (older app builds) it covers all.
   */
  async checkout(
    accountId: string,
    audience: SubscriptionAudience,
    months: SubscriptionMonths,
    requested?: PartnerPlan | 'all',
    inApp = false,
  ) {
    // The all-in-one plan is bought as a plan covering everything (no single side).
    const plan = requested === 'all' ? undefined : requested;
    const settings = await this.repository.getSettings();
    if (!(audience === 'customer' ? customerPlansOn(settings) : partnerPlansOn(settings))) {
      throw AppError.conflict('Subscriptions are not available right now.', 'SUBSCRIPTIONS_OFF');
    }
    const partnerPlan = audience === 'partner' ? plan : undefined;
    if (await this.repository.findActive(accountId, audience, partnerPlan)) {
      throw AppError.conflict('Your plan is already active.', 'SUBSCRIPTION_ACTIVE');
    }
    const prices =
      audience === 'customer' ? settings.customerPrices : partnerPlan ? settings.partnerPlanPrices[partnerPlan] : settings.partnerPrices;
    const amount = prices[String(months) as keyof typeof prices];
    const contact = await this.repository.accountContact(accountId);
    if (!contact) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    const subscription = await this.repository.createSubscription(accountId, audience, months, amount, partnerPlan ?? 'all');
    if (inApp) return { id: subscription.id, amount, paymentUrl: null };
    const planName = partnerPlan ? ` ${PLAN_LABEL[partnerPlan]}` : '';
    const link = await razorpayService.createPaymentLink({
      amountPaise: amount * 100,
      description: `Triolo ${audience === 'customer' ? '' : 'Partner '}subscription${planName} — ${months} month${months === 1 ? '' : 's'}`,
      referenceId: `sub-${subscription.id}`,
      customer: { name: contact.name, contact: contact.mobile },
      notes: { subscriptionId: subscription.id, audience, plan: partnerPlan ?? 'all' },
    });
    await this.repository.setSubscriptionLink(subscription.id, link.id, link.short_url);
    return { id: subscription.id, amount, paymentUrl: link.short_url };
  }

  /** After paying: asks Razorpay whether the link is paid and, if so, starts the plan. */
  async checkPayment(accountId: string, id: string): Promise<MySubscription & { paid: boolean }> {
    const subscription = await this.repository.findSubscription(id);
    if (!subscription || subscription.accountId !== accountId) throw AppError.notFound('Not found.', 'SUBSCRIPTION_NOT_FOUND');
    let paid = subscription.status === 'active';
    if (subscription.status === 'unpaid' && subscription.razorpayLinkId) {
      const paymentId = await razorpayService.paidLinkPayment(subscription.razorpayLinkId, subscription.amount * 100);
      if (paymentId) {
        await this.repository.activateSubscription(subscription.id, paymentId);
        this.status.forget(accountId);
        paid = true;
      }
    }
    return { ...(await this.getMine(accountId, subscription.audience)), paid };
  }

  // --- Apps: badges ---

  /** The partner's profiles (worker / shop / job post) with each one's badge. */
  async getMyBadges(accountId: string): Promise<MyBadges> {
    const settings = await this.repository.getSettings();
    const [worker, shops, posts, badges] = await Promise.all([
      this.deps.workers.getMyProfile(accountId),
      this.deps.businesses.listMyShops(accountId),
      this.deps.jobSeekers.listMine(accountId),
      this.repository.findLatestBadges(accountId),
    ]);
    const profiles: { kind: BadgeKind; id: string; name: string; eligible: boolean }[] = [];
    if (worker) {
      const [named] = worker.verificationStatus === 'verified' ? await this.deps.workers.getVerifiedProfiles([worker.id]) : [];
      profiles.push({ kind: 'service', id: worker.id, name: named?.accountFullName ?? 'My services', eligible: worker.verificationStatus === 'verified' });
    }
    for (const shop of shops) profiles.push({ kind: 'business', id: shop.id, name: shop.shopName, eligible: shop.verificationStatus === 'verified' });
    for (const post of posts) profiles.push({ kind: 'job_post', id: post.id, name: post.title, eligible: post.isActive });
    return {
      enabled: settings.badgeEnabled,
      price: settings.badgePrice,
      profiles: profiles.map((profile): MyProfileBadge => {
        const badge = badges.find((item) => item.kind === profile.kind && item.profileId === profile.id);
        const fresh = badge?.status === 'unpaid' && Date.now() - new Date(badge.createdAt).getTime() < 24 * 3600 * 1000;
        return {
          kind: profile.kind,
          profileId: profile.id,
          name: profile.name,
          eligible: profile.eligible,
          status: !badge ? 'none' : badge.status === 'active' ? 'active' : badge.status === 'removed' ? 'removed' : fresh ? 'pending' : 'none',
          badgeId: badge?.id ?? null,
          paymentUrl: fresh ? badge?.paymentUrl ?? null : null,
          removedReason: badge?.status === 'removed' ? badge.removedReason : null,
        };
      }),
    };
  }

  /** Starts buying the badge for one of the partner's own profiles. */
  async badgeCheckout(accountId: string, kind: BadgeKind, profileId?: string, inApp = false) {
    const settings = await this.repository.getSettings();
    if (!settings.badgeEnabled) throw AppError.conflict('Badges are not available right now.', 'BADGES_OFF');
    const mine = (await this.getMyBadges(accountId)).profiles.find(
      (profile) => profile.kind === kind && (!profileId || profile.profileId === profileId),
    );
    if (!mine) throw AppError.notFound(`You don't have a ${BADGE_LABEL[kind]} yet.`, 'BADGE_PROFILE_NOT_FOUND');
    if (!mine.eligible) {
      throw AppError.conflict(
        kind === 'job_post' ? 'Turn your job post on first.' : `Your ${BADGE_LABEL[kind]} must be verified first.`,
        'BADGE_PROFILE_NOT_ELIGIBLE',
      );
    }
    if (mine.status === 'active') throw AppError.conflict('This profile already has the badge.', 'BADGE_ALREADY_ACTIVE');
    const contact = await this.repository.accountContact(accountId);
    if (!contact) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    const badge = await this.repository.createBadge(accountId, kind, mine.profileId, settings.badgePrice);
    if (inApp) return { id: badge.id, amount: settings.badgePrice, paymentUrl: null };
    const link = await razorpayService.createPaymentLink({
      amountPaise: settings.badgePrice * 100,
      description: `"Trusted by Triolo" badge — ${mine.name}`,
      referenceId: `bdg-${badge.id}`,
      customer: { name: contact.name, contact: contact.mobile },
      notes: { badgeId: badge.id, kind },
    });
    await this.repository.setBadgeLink(badge.id, link.id, link.short_url);
    return { id: badge.id, amount: settings.badgePrice, paymentUrl: link.short_url };
  }

  async badgeCheckPayment(accountId: string, id: string): Promise<MyBadges & { paid: boolean }> {
    const badge = await this.repository.findBadge(id);
    if (!badge || badge.accountId !== accountId) throw AppError.notFound('Not found.', 'BADGE_NOT_FOUND');
    let paid = badge.status === 'active';
    if (badge.status === 'unpaid' && badge.razorpayLinkId) {
      const paymentId = await razorpayService.paidLinkPayment(badge.razorpayLinkId, badge.amount * 100);
      if (paymentId) {
        if (await this.repository.findActiveBadge(badge.kind, badge.profileId)) {
          // Paid twice for the same profile (two tabs): the money stays recorded on the row.
          logger.warn({ badgeId: badge.id, paymentId }, 'Badge paid while another is active — refund it from Razorpay');
        } else {
          await this.repository.activateBadge(badge.id, paymentId);
          this.trustedCache = null;
          paid = true;
        }
      }
    }
    return { ...(await this.getMyBadges(accountId)), paid };
  }

  /** Every profile with an active badge (both apps show "Trusted by Triolo" on these). */
  async trustedIds(): Promise<TrustedIds> {
    if (this.trustedCache && Date.now() - this.trustedCache.at < TRUSTED_TTL_MS) return this.trustedCache.value;
    const value = await this.repository.trustedIds();
    this.trustedCache = { at: Date.now(), value };
    return value;
  }

  // --- Admin ---

  async overview(): Promise<SubscriptionOverview> {
    const [settings, counts, review] = await Promise.all([this.repository.getSettings(), this.repository.counts(), this.badgesToReview()]);
    return { settings, ...counts, badgesToReview: review.length };
  }

  async updateSettings(changes: Partial<Omit<SubscriptionSettings, 'updatedAt'>>): Promise<SubscriptionSettings> {
    const settings = await this.repository.updateSettings(changes);
    this.status.forget();
    return settings;
  }

  listSubscriptions(filter: Parameters<SubscriptionsRepository['listSubscriptions']>[0]): Promise<AdminSubscriptionRow[]> {
    return this.repository.listSubscriptions(filter);
  }

  /** Badges with each profile's name and rating (read through the owning modules). */
  async listBadges(filter: { status?: 'active' | 'removed'; limit: number }): Promise<AdminBadgeRow[]> {
    return this.withProfiles(await this.repository.listBadges(filter));
  }

  /** Active badges whose profile's rating fell below the admin's minimum. */
  async badgesToReview(): Promise<AdminBadgeRow[]> {
    const settings = await this.repository.getSettings();
    const rows = await this.withProfiles(await this.repository.listBadges({ status: 'active', limit: 500 }));
    return rows.filter(
      (row) => row.ratingAverage != null && row.ratingCount >= settings.badgeMinRatings && row.ratingAverage < settings.badgeMinRating,
    );
  }

  /** Takes a badge away (the partner is told why and can buy it again). */
  async removeBadge(id: string, reason: string): Promise<AdminBadgeRow> {
    const badge = await this.repository.removeBadge(id, reason.trim());
    if (!badge) throw AppError.conflict('This badge is not active.', 'BADGE_NOT_ACTIVE');
    this.trustedCache = null;
    const contact = await this.repository.accountContact(badge.accountId);
    const text = badgeRemovedText(contact?.language ?? 'en', badge.kind, reason.trim());
    await this.deps.notifications
      .notify(badge.accountId, 'badge_removed', text.title, text.body, { audience: 'partner' })
      .catch((err) => logger.warn({ err, badgeId: id }, 'Badge removal notice not sent'));
    const [row] = await this.withProfiles([{ ...badge, accountName: contact?.name ?? '', accountMobile: contact?.mobile ?? '' }]);
    return row;
  }

  private async withProfiles(rows: (AdminBadgeRow | Omit<AdminBadgeRow, 'profileName' | 'ratingAverage' | 'ratingCount'>)[]): Promise<AdminBadgeRow[]> {
    const ids = (kind: BadgeKind) => rows.filter((row) => row.kind === kind).map((row) => row.profileId);
    const [workers, shops] = await Promise.all([
      ids('service').length ? this.deps.workers.getVerifiedProfiles(ids('service')) : Promise.resolve([]),
      ids('business').length ? this.deps.businesses.getVerifiedProfiles(ids('business')) : Promise.resolve([]),
    ]);
    return rows.map((row) => {
      const worker = row.kind === 'service' ? workers.find((item) => item.id === row.profileId) : undefined;
      const shop = row.kind === 'business' ? shops.find((item) => item.id === row.profileId) : undefined;
      return {
        ...row,
        profileName: worker?.accountFullName ?? shop?.shopName ?? (row.kind === 'job_post' ? 'Job post' : null),
        ratingAverage: worker?.ratingAverage ?? shop?.ratingAverage ?? null,
        ratingCount: worker?.ratingCount ?? shop?.ratingCount ?? 0,
      };
    });
  }
}
