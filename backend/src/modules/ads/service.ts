import { AppError } from '@/common/errors/AppError';
import type { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import { deletePhotosFromCloudinary, deleteVideosFromCloudinary, deleteCloudinaryIds, extractPublicIdFromUrl, isOwnCloudinaryUrl, listCloudinaryFiles, playbackUrl, signDirectUpload, videoDurationSeconds, SignedUpload, mediaSize } from '@/common/services/cloudinaryService';
import { logger } from '@/common/utils/logger';
import { razorpayService } from '@/common/services/razorpayService';
import { AdsRepository, StoredAdParams } from './repository';
import {
  Ad,
  AdActionColumns,
  AdMediaInput,
  AdPromotedKind,
  PromotionResolver,
  AD_MAX_IMAGES,
  AD_MAX_VIDEO_SECONDS,
  AD_MEDIA_FOLDER,
  AD_RADIUS_KM,
  AD_SELF_OPEN_LIMIT,
  AD_HOME_MAX,
  AD_VIEWS_MAX,
  AD_VIEWS_MIN,
  AD_VIEWS_VALID_DAYS,
  AdApp,
  AdListFilter,
  AdPlacement,
  AdSpot,
  AdSettings,
  PublicAd,
  SaveAdParams,
} from './interfaces';

// How often (per server instance) finished ads are checked for media to delete.
const CLEANUP_EVERY_MS = 10 * 60 * 1000;
let lastCleanupAt = 0;

function toPublic(ad: Ad): PublicAd {
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    imageUrl: playbackUrl(ad.imageUrl, 'image'),
    imageUrls: ad.imageUrls.map((url) => playbackUrl(url, 'image') as string),
    videoUrl: playbackUrl(ad.videoUrl, 'video'),
    orientation: ad.orientation,
    showOn: ad.showOn,
    durationSeconds: ad.durationSeconds,
    advertiserName: ad.advertiserName,
    // The business's own phone is the Call button's number.
    contactPhone: ad.advertiserPhone,
    locationText: ad.locationText,
    linkUrl: ad.linkUrl,
    actionType: ad.actionType,
    destination: ad.destination,
    promoted: ad.promoted,
    endDate: ad.endDate,
  };
}

/** A NearbyU Partner profile ad: it shows the profile as a card, never a picture or video. */
function isProfileAd(type?: string | null): boolean {
  return type === 'service' || type === 'business' || type === 'job_post';
}

const PROMOTED_LABEL: Record<AdPromotedKind, string> = {
  service: 'verified worker profile',
  business: 'verified shop',
  job_post: 'live job post',
};

/** "sritextiles.com" → "https://sritextiles.com"; empty → null. */
function normalizeLink(link?: string | null): string | null {
  const value = link?.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function clean(params: SaveAdParams): SaveAdParams {
  const optional = (value?: string | null) => (value?.trim() ? value.trim() : null);
  const views = params.billing === 'views';
  return {
    ...params,
    // A views ad runs until its views are used up, within AD_VIEWS_VALID_DAYS of its start.
    billing: views ? 'views' : 'days',
    // Every ad is a Home slider ad: a wide card.
    showOn: 'home',
    orientation: 'horizontal',
    viewLimit: views ? params.viewLimit ?? null : null,
    planDays: views ? AD_VIEWS_VALID_DAYS : params.planDays,
    advertiserName: params.advertiserName?.trim() ?? '',
    // The ad itself is just its media; the title only names it in the list and on the bill.
    title: params.title?.trim() || params.advertiserName?.trim() || '',
    advertiserPhone: optional(params.advertiserPhone),
    description: optional(params.description),
    linkUrl: normalizeLink(params.linkUrl),
  };
}

/** A business can't book an ad that starts in the past (India calendar day). */
function assertStartsTodayOrLater(startDate: string): void {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  if (startDate < today) throw AppError.badRequest('Choose a start date from today on.', 'AD_START_IN_PAST');
}

/** What an ad costs at today's prices: its plan's price, or its views × the price per view. */
export function adPrice(settings: Pick<AdSettings, 'prices' | 'pricePerView'>, params: Pick<SaveAdParams, 'billing' | 'viewLimit' | 'planDays'>): number {
  if (params.billing === 'views') return Math.round((params.viewLimit ?? 0) * settings.pricePerView);
  return settings.prices[String(params.planDays) as keyof AdSettings['prices']];
}

/**
 * Whether full-screen ads run at this place. Never any more: ads show only in Home's slider
 * (serveHome). Kept so older app builds asking for one simply get none.
 */
export function placementOn(_settings: AdSettings, _app: AdApp, _placement: AdPlacement, _spot?: AdSpot | null): boolean {
  return false;
}

/**
 * Ads booked by local businesses, entered by the admin after payment. Owns `ads`,
 * `ad_settings` and `ad_daily_stats`; depends on no other module.
 */
export class AdsService {
  constructor(
    private readonly repository: AdsRepository,
    // Finds the profile a 'service' / 'business' / 'job_post' ad promotes.
    private readonly promotions?: PromotionResolver,
    // Subscribers (customers and partners) see no ads.
    private readonly subscriptionStatus?: SubscriptionStatusService,
  ) {}

  /**
   * The ad's checked tap action. A promoted profile is found by the admin's phone number, or
   * for a business's own ad, its own account; it must be a verified worker / shop or a live
   * job post. Fields that don't belong to the chosen action are cleared.
   */
  private async resolveAction(params: SaveAdParams, ownerAccountId: string | null): Promise<AdActionColumns> {
    const link = normalizeLink(params.linkUrl);
    const type = params.actionType ?? (link ? 'link' : 'none');
    const action: AdActionColumns = {
      actionType: type,
      linkUrl: null,
      actionLatitude: null,
      actionLongitude: null,
      actionPlace: null,
      promotedId: null,
      promotedName: null,
      promoteMobile: null,
    };
    if (type === 'link') {
      if (!link) throw AppError.badRequest('Enter the link.', 'AD_ACTION_INVALID');
      action.linkUrl = link;
    } else if (type === 'location') {
      if (params.actionLatitude == null || params.actionLongitude == null || !params.actionPlace?.trim()) {
        throw AppError.badRequest('Set the place for directions.', 'AD_ACTION_INVALID');
      }
      action.actionLatitude = params.actionLatitude;
      action.actionLongitude = params.actionLongitude;
      action.actionPlace = params.actionPlace.trim();
    } else if (type !== 'none') {
      if (!this.promotions) throw AppError.badRequest('Promoting a profile is not available.', 'AD_ACTION_INVALID');
      // Found by its NearbyU Partner mobile number (a business's own account when it gives none).
      let accountId = ownerAccountId;
      const mobile = params.promoteMobile?.trim();
      if (mobile) {
        accountId = await this.promotions.accountIdByMobile(mobile);
        if (!accountId) throw AppError.badRequest('No NearbyU account has this mobile number.', 'AD_PROMOTE_ACCOUNT_NOT_FOUND');
        action.promoteMobile = mobile;
      }
      if (!accountId) throw AppError.badRequest('Enter the NearbyU Partner mobile number.', 'AD_ACTION_INVALID');
      const profile = params.promotedPostId
        ? await this.promotions.find(type, accountId, params.promotedPostId)
        : await this.promotions.find(type, accountId);
      if (!profile) {
        throw AppError.badRequest(
          mobile ? `This number has no ${PROMOTED_LABEL[type]}.` : `You don't have a ${PROMOTED_LABEL[type]} to promote yet.`,
          'AD_PROMOTE_PROFILE_NOT_FOUND',
        );
      }
      action.promotedId = profile.id;
      action.promotedName = profile.name;
    }
    return action;
  }

  /**
   * An ad's place is its directions place: only a 'Show directions' ad has one (and is shown
   * within its radius of it); every other ad has none and is shown to everyone.
   */
  private async stored(params: SaveAdParams, ownerAccountId: string | null): Promise<StoredAdParams> {
    const action = await this.resolveAction(params, ownerAccountId);
    const directions = action.actionType === 'location';
    const cleaned = clean(params);
    // A promoted profile names the ad, and its number is the ad's phone.
    const named = action.promotedName
      ? { advertiserName: action.promotedName, title: action.promotedName, advertiserPhone: action.promoteMobile ?? cleaned.advertiserPhone }
      : {};
    return {
      ...cleaned,
      ...named,
      ...action,
      latitude: directions ? action.actionLatitude : null,
      longitude: directions ? action.actionLongitude : null,
      locationText: directions ? action.actionPlace : null,
    };
  }

  // --- Apps ---

  /**
   * The ad to show now in this app and place, or null when ads are off there or none is
   * running near the viewer. Counts the view. `excludeId` is the ad this person saw last.
   */
  async serve(
    app: AdApp,
    placement: AdPlacement,
    viewer: { latitude: number; longitude: number },
    excludeId: string | null,
    options: { spot?: AdSpot | null; accountId?: string | null } = {},
  ): Promise<PublicAd | null> {
    // Tidy up finished ads' media now and then (also run daily by the cron, and from the admin desk).
    if (Date.now() - lastCleanupAt > CLEANUP_EVERY_MS) {
      this.cleanupFinishedMedia().catch((err) => logger.warn({ err }, 'Ad media cleanup failed'));
    }
    const settings = await this.repository.getSettings();
    if (!placementOn(settings, app, placement, options.spot)) return null;
    // A subscriber sees no ads (a partner: on the sides their plan covers).
    if (options.accountId && (await this.adFree(options.accountId, app, options.spot ?? null))) return null;
    // Not too often for the same person (the admin's minimum gap).
    if (options.accountId && settings.actionGapSeconds > 0) {
      if (await this.repository.sawActionAdWithin(options.accountId, app, settings.actionGapSeconds)) return null;
    }
    // NearbyU Partner profile ads are for customers (book / order / contact): never in the partner app.
    const ad = await this.repository.pickAndCount(excludeId, viewer.latitude, viewer.longitude, app === 'user');
    if (!ad) return null;
    if (options.accountId) {
      this.repository.markActionAdShown(options.accountId, app).catch((err) => logger.warn({ err }, 'Ad view time not saved'));
    }
    const served = toPublic(ad);
    if (ad.promoted && this.promotions) {
      served.promotedCard = await this.promotions.card(ad.promoted.kind, ad.promoted.id).catch(() => null);
      // The Trusted by NearbyU seal shows only for a profile whose owner bought it.
      if (served.promotedCard && this.subscriptionStatus) {
        const trusted = await this.subscriptionStatus.trustedIds().catch(() => null);
        served.promotedCard.trusted = !!trusted?.[ad.promoted.kind]?.includes(ad.promoted.id);
      }
    }
    return served;
  }

  /**
   * Home's carousel: a few running ads near the viewer (each counted as a view), when the admin
   * turned it on for this app. Subscribers see none.
   */
  async serveHome(app: AdApp, viewer: { latitude: number; longitude: number }, accountId: string | null): Promise<PublicAd[]> {
    const settings = await this.repository.getSettings();
    if (!settings.adsEnabled || !(app === 'user' ? settings.homeUser : settings.homePartner)) return [];
    if (accountId && (await this.adFree(accountId, app, null))) return [];
    const ads = await this.repository.pickManyAndCount(viewer.latitude, viewer.longitude, app === 'user', AD_HOME_MAX);
    const trusted = ads.some((ad) => ad.promoted) && this.subscriptionStatus ? await this.subscriptionStatus.trustedIds().catch(() => null) : null;
    // How long each picture stays before the slider moves on (the admin's "time between ads").
    const slideSeconds = settings.actionGapSeconds > 0 ? Math.min(60, settings.actionGapSeconds) : 5;
    return Promise.all(
      ads.map(async (ad) => {
        const served: PublicAd = { ...toPublic(ad), slideSeconds };
        if (ad.promoted && this.promotions) {
          served.promotedCard = await this.promotions.card(ad.promoted.kind, ad.promoted.id).catch(() => null);
          if (served.promotedCard) served.promotedCard.trusted = !!trusted?.[ad.promoted.kind]?.includes(ad.promoted.id);
        }
        return served;
      }),
    );
  }

  /**
   * Whether this person's plan takes the ads off: the customer plan, or — for partners — the All
   * in One plan only (a side's plan covers that side's work, not the Home slider).
   */
  private async adFree(accountId: string, app: AdApp, _spot: AdSpot | null): Promise<boolean> {
    if (!this.subscriptionStatus) return false;
    if (app === 'user') return this.subscriptionStatus.isActive(accountId, 'customer');
    return this.subscriptionStatus.isActive(accountId, 'partner', 'all');
  }

  async recordClick(id: string): Promise<void> {
    await this.repository.recordClick(id);
  }

  // --- Businesses booking their own ads (NearbyU Ads website) ---

  /** What a business sees before booking: today's prices and the rules. */
  async selfInfo() {
    const settings = await this.repository.getSettings();
    return {
      prices: settings.prices,
      pricePerView: settings.pricePerView,
      viewsMin: AD_VIEWS_MIN,
      viewsMax: AD_VIEWS_MAX,
      viewsValidDays: AD_VIEWS_VALID_DAYS,
      radiusKm: AD_RADIUS_KM,
      maxVideoSeconds: AD_MAX_VIDEO_SECONDS,
      openLimit: AD_SELF_OPEN_LIMIT,
    };
  }

  listOwned(accountId: string): Promise<Ad[]> {
    return this.repository.listOwned(accountId);
  }

  async getOwned(accountId: string, id: string): Promise<Ad> {
    const ad = await this.repository.findById(id);
    if (!ad || ad.ownerAccountId !== accountId) throw AppError.notFound('Ad not found.', 'AD_NOT_FOUND');
    return ad;
  }

  /**
   * A business books its own ad: at today's price, waiting for the admin's review (it's never
   * shown before it's approved). Its image or video is checked first, as in the admin's form.
   */
  async createOwned(accountId: string, params: Omit<SaveAdParams, 'paymentMethod'>, media: AdMediaInput): Promise<Ad> {
    assertStartsTodayOrLater(params.startDate);
    if ((await this.repository.countOpenOwned(accountId)) >= AD_SELF_OPEN_LIMIT) {
      throw AppError.conflict(
        `You already have ${AD_SELF_OPEN_LIMIT} ads waiting for review. Wait for them, or withdraw one.`,
        'AD_SELF_LIMIT',
      );
    }
    const stored = await this.stored({ ...params, paymentMethod: 'pending' as never }, accountId);
    const checked = isProfileAd(stored.actionType) ? null : await this.checkMedia(media.imageUrl ?? null, media.videoUrl ?? null);
    const ad = await this.repository.create(stored, adPrice(await this.repository.getSettings(), stored), accountId);
    if (!checked) return ad;
    const result = await this.repository.setMedia(ad.id, checked.images, checked.videoUrl, checked.videoSeconds);
    return result?.ad ?? ad;
  }

  /** Edits an own ad that's waiting for review or was rejected; it goes back for review. */
  async updateOwned(
    accountId: string,
    id: string,
    params: Omit<SaveAdParams, 'paymentMethod'>,
    media: AdMediaInput,
  ): Promise<Ad> {
    assertStartsTodayOrLater(params.startDate);
    const existing = await this.getOwned(accountId, id);
    const stored = await this.stored({ ...params, paymentMethod: 'pending' as never }, accountId);
    const samePlan = existing.billing === stored.billing && existing.planDays === stored.planDays && existing.viewLimit === (stored.viewLimit ?? null);
    if (existing.paymentMethod === 'online' && !samePlan) {
      throw AppError.conflict('It is already paid for — the plan can no longer change.', 'AD_PAID_PLAN_LOCKED');
    }
    const amount = samePlan ? existing.amount : adPrice(await this.repository.getSettings(), stored);
    const ad = await this.repository.updateOwned(id, accountId, stored, amount);
    if (!ad) throw AppError.conflict('This ad was already approved — it can no longer be changed.', 'AD_NOT_EDITABLE');
    if (isProfileAd(stored.actionType)) return this.dropMedia(ad);
    const current = existing.videoUrl ?? existing.imageUrls[0] ?? null;
    const picked = media.videoUrl ?? media.imageUrl ?? null;
    if (picked && picked !== current) return this.setMedia(id, media.imageUrl ?? null, media.videoUrl ?? null);
    return ad;
  }

  /** The business takes back an ad that wasn't approved; its media is deleted and an online payment refunded. */
  async withdrawOwned(accountId: string, id: string): Promise<Ad> {
    let ad = await this.repository.withdrawOwned(id, accountId);
    if (!ad) throw AppError.conflict('Only an ad that is waiting for review or was rejected can be withdrawn.', 'AD_NOT_EDITABLE');
    ad = await this.refundIfPaidOnline(ad, 'withdrawn');
    await this.deleteMedia(ad.id, ad.imageUrls, ad.videoUrl);
    return { ...ad, imageUrl: null, imageUrls: [], videoUrl: null };
  }

  // --- Online payment (Razorpay), right after a business books ---

  /** Opens a Razorpay order for an unpaid booking; the website then shows Razorpay's checkout. */
  async startPayment(accountId: string, id: string) {
    const ad = await this.getOwned(accountId, id);
    if (ad.status !== 'unpaid') throw AppError.conflict('This ad does not need paying.', 'AD_NOT_PAYABLE');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    if (ad.endDate < today) throw AppError.conflict('Its dates have passed — change them, then pay.', 'AD_DATES_PASSED');
    const order = await razorpayService.createOrder(ad.amount * 100, `ad-${ad.billNumber}`, { adId: ad.id });
    await this.repository.setOrder(ad.id, order.id);
    return {
      keyId: razorpayService.keyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      description: `${ad.planDays === 30 ? '1 month' : ad.planDays === 7 ? '1 week' : `${ad.planDays} day${ad.planDays === 1 ? '' : 's'}`} ad · bill ${ad.billNumber}`,
    };
  }

  /** Checkout's success: the signature proves it came from Razorpay, then the payment is checked and recorded. */
  async confirmPayment(accountId: string, id: string, body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }): Promise<Ad> {
    const ad = await this.getOwned(accountId, id);
    if (ad.status !== 'unpaid') return ad;
    if (!ad.razorpayOrderId || body.razorpayOrderId !== ad.razorpayOrderId) {
      throw AppError.badRequest('This payment is not for this ad.', 'AD_PAYMENT_INVALID');
    }
    if (!razorpayService.signatureValid(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)) {
      throw AppError.badRequest('The payment could not be verified.', 'AD_PAYMENT_INVALID');
    }
    return this.settlePayment(ad, body.razorpayPaymentId);
  }

  /** "I've paid": asks Razorpay about the ad's order (e.g. the page was closed before checkout finished). */
  /**
   * The partner app's boost: a Razorpay payment link to open in the browser (where UPI apps
   * work); `checkPayment` then picks the payment up.
   */
  async startPaymentLink(accountId: string, id: string): Promise<{ paymentUrl: string }> {
    const ad = await this.getOwned(accountId, id);
    if (ad.status !== 'unpaid') throw AppError.conflict('This ad does not need paying.', 'AD_NOT_PAYABLE');
    const contact = await this.repository.ownerContact(accountId);
    if (!contact) throw AppError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');
    const link = await razorpayService.createPaymentLink({
      amountPaise: ad.amount * 100,
      description: `NearbyU boost — bill ${ad.billNumber}`,
      referenceId: `ad${ad.billNumber}-${Date.now()}`,
      customer: { name: contact.name, contact: contact.mobile },
      notes: { adId: ad.id },
    });
    await this.repository.setPaymentLink(ad.id, link.id);
    return { paymentUrl: link.short_url };
  }

  async checkPayment(accountId: string, id: string): Promise<Ad> {
    const ad = await this.getOwned(accountId, id);
    if (ad.status === 'unpaid' && ad.razorpayLinkId) {
      const paymentId = await razorpayService.paidLinkPayment(ad.razorpayLinkId, ad.amount * 100);
      if (paymentId) return (await this.repository.markPaidByLink(ad.id, ad.razorpayLinkId, paymentId)) ?? (await this.getOwned(accountId, id));
    }
    if (ad.status !== 'unpaid' || !ad.razorpayOrderId) return ad;
    const payments = await razorpayService.orderPayments(ad.razorpayOrderId);
    const done = payments.find((payment) => payment.status === 'captured') ?? payments.find((payment) => payment.status === 'authorized');
    return done ? this.settlePayment(ad, done.id) : ad;
  }

  /** Confirms with Razorpay that the payment is this ad's, for its full amount, and taken; then records it. */
  private async settlePayment(ad: Ad, paymentId: string): Promise<Ad> {
    let payment = await razorpayService.payment(paymentId);
    if (payment.order_id !== ad.razorpayOrderId || payment.amount !== ad.amount * 100 || payment.currency !== 'INR') {
      throw AppError.badRequest('This payment is not for this ad.', 'AD_PAYMENT_INVALID');
    }
    if (payment.status === 'authorized') payment = await razorpayService.capture(payment.id, payment.amount);
    if (payment.status !== 'captured') throw AppError.conflict('The payment has not gone through yet.', 'AD_PAYMENT_NOT_DONE');
    const paid = await this.repository.markPaidOnline(ad.id, ad.razorpayOrderId as string, payment.id);
    return paid ?? (await this.repository.findById(ad.id)) ?? ad;
  }

  /** Gives back an online payment (rejected or withdrawn ad). A failed refund is logged; the ad still shows it as paid. */
  private async refundIfPaidOnline(ad: Ad, reason: 'rejected' | 'withdrawn'): Promise<Ad> {
    if (ad.paymentMethod !== 'online' || !ad.razorpayPaymentId) return ad;
    try {
      const refund = await razorpayService.refund(ad.razorpayPaymentId, ad.amount * 100, { adId: ad.id, reason });
      return (await this.repository.markRefunded(ad.id, refund.id)) ?? ad;
    } catch (err) {
      logger.error({ err, adId: ad.id }, 'Ad refund failed — refund it from the Razorpay dashboard');
      return ad;
    }
  }

  // --- Admin ---

  /** Approve (it runs from its start date) or reject (with the reason the business sees). */
  async review(id: string, decision: 'approve' | 'reject', note?: string | null): Promise<Ad> {
    const ad = await this.repository.review(id, decision, note?.trim() || null);
    if (!ad) {
      const existing = await this.repository.findById(id);
      if (!existing) throw AppError.notFound('Ad not found.', 'AD_NOT_FOUND');
      if (existing.status === 'unpaid' && decision === 'approve') {
        throw AppError.conflict('Not paid yet — wait for the payment, or record a cash / UPI payment with Edit.', 'AD_NOT_PAID');
      }
      if (existing.reviewStatus === 'pending' && decision === 'approve') {
        throw AppError.conflict('Its dates have already passed — change them before approving.', 'AD_DATES_PASSED');
      }
      throw AppError.conflict('This ad is not waiting for review.', 'AD_NOT_IN_REVIEW');
    }
    // A rejected ad that was paid online gets its money back.
    return decision === 'reject' ? this.refundIfPaidOnline(ad, 'rejected') : ad;
  }

  getSettings(): Promise<AdSettings> {
    return this.repository.getSettings();
  }

  updateSettings(changes: Partial<Omit<AdSettings, 'updatedAt'>>): Promise<AdSettings> {
    return this.repository.updateSettings(changes);
  }

  async overview() {
    await this.cleanupFinishedMedia().catch((err) => logger.warn({ err }, 'Ad media cleanup failed'));
    const [settings, summary] = await Promise.all([this.repository.getSettings(), this.repository.summary()]);
    return { settings, ...summary, prices: settings.prices, radiusKm: AD_RADIUS_KM };
  }

  list(filter: AdListFilter) {
    return this.repository.list(filter);
  }

  async get(id: string): Promise<Ad> {
    const ad = await this.repository.findById(id);
    if (!ad) throw AppError.notFound('Ad not found.', 'AD_NOT_FOUND');
    return ad;
  }

  /**
   * Books an ad at today's price for its plan, with its image or video when given (checked
   * first, so a refused video never leaves an ad without its media behind).
   */
  async create(params: SaveAdParams, media?: AdMediaInput): Promise<Ad> {
    const stored = await this.stored(params, null);
    const checked =
      !isProfileAd(stored.actionType) && media && (media.imageUrl || media.videoUrl)
        ? await this.checkMedia(media.imageUrl ?? null, media.videoUrl ?? null)
        : null;
    const ad = await this.repository.create(stored, adPrice(await this.repository.getSettings(), stored));
    if (!checked) return ad;
    const result = await this.repository.setMedia(ad.id, checked.images, checked.videoUrl, checked.videoSeconds);
    return result?.ad ?? ad;
  }

  /**
   * Edits an ad. It keeps the amount it was booked at — a later price change never touches
   * past bookings — unless its plan itself is changed, which is priced like a new booking.
   */
  async update(id: string, params: SaveAdParams, media?: AdMediaInput): Promise<Ad> {
    const existing = await this.repository.findById(id);
    if (!existing || existing.status === 'deleted') throw AppError.notFound('Ad not found, or it was deleted.', 'AD_NOT_FOUND');
    const stored = await this.stored(params, null);
    let amount = existing.amount;
    if (existing.billing !== stored.billing || existing.planDays !== stored.planDays || existing.viewLimit !== (stored.viewLimit ?? null)) {
      amount = adPrice(await this.repository.getSettings(), stored);
    }
    const ad = await this.repository.update(id, stored, amount);
    if (!ad) throw AppError.notFound('Ad not found, or it was deleted.', 'AD_NOT_FOUND');
    if (isProfileAd(stored.actionType)) return this.dropMedia(ad);
    if (media && (media.imageUrl || media.videoUrl)) return this.setMedia(id, media.imageUrl ?? null, media.videoUrl ?? null);
    return ad;
  }

  /** Stops an ad (it stays in the history with its bill) and deletes its media straight away. */
  async remove(id: string): Promise<Ad> {
    const ad = await this.repository.softDelete(id);
    if (!ad) throw AppError.notFound('Ad not found, or it was already deleted.', 'AD_NOT_FOUND');
    await this.deleteMedia(ad.id, ad.imageUrls, ad.videoUrl);
    return { ...ad, imageUrl: null, imageUrls: [], videoUrl: null };
  }

  /**
   * Media of ads that have ended or were deleted: removed from Cloudinary and from the ad
   * (the ad's text, dates and bill stay in the history). Safe to call often.
   */
  async cleanupFinishedMedia(): Promise<number> {
    lastCleanupAt = Date.now();
    const finished = await this.repository.findFinishedWithMedia();
    for (const ad of finished) {
      await this.deleteMedia(ad.id, ad.imageUrls, ad.videoUrl);
    }
    if (finished.length > 0) logger.info({ count: finished.length }, 'Deleted media of finished ads');
    return finished.length;
  }

  /**
   * Files in the ads folder that no ad uses — e.g. an upload whose save then failed, or a
   * browser closed mid-save. Deleted once they're a day old (newer ones may still be about to
   * be saved with an ad).
   */
  async cleanupUnusedUploads(minAgeHours = 24): Promise<number> {
    const used = new Set((await this.repository.allMediaUrls()).map((url) => extractPublicIdFromUrl(url)).filter(Boolean));
    const cutoff = Date.now() - minAgeHours * 3600 * 1000;
    let removed = 0;
    for (const kind of ['image', 'video'] as const) {
      const unused = (await listCloudinaryFiles(`${AD_MEDIA_FOLDER}/`, kind))
        .filter((file) => !used.has(file.publicId) && new Date(file.createdAt).getTime() < cutoff)
        .map((file) => file.publicId);
      await deleteCloudinaryIds(unused, kind);
      removed += unused.length;
    }
    if (removed > 0) logger.info({ removed }, 'Deleted unused ad uploads');
    return removed;
  }

  /** An ad switched to a profile ad no longer has a picture or video: they're deleted. */
  private async dropMedia(ad: Ad): Promise<Ad> {
    if (ad.imageUrls.length === 0 && !ad.videoUrl) return ad;
    await this.deleteMedia(ad.id, ad.imageUrls, ad.videoUrl);
    return { ...ad, imageUrl: null, imageUrls: [], videoUrl: null, videoSeconds: null, durationSeconds: ad.displaySeconds };
  }

  private async deleteMedia(id: string, imageUrls: string[], videoUrl: string | null): Promise<void> {
    await deletePhotosFromCloudinary(imageUrls);
    if (videoUrl) await deleteVideosFromCloudinary([videoUrl]);
    await this.repository.clearMedia(id);
  }

  /** Permission for the admin website to upload one image or video straight to Cloudinary. */
  uploadSignature(kind: 'image' | 'video'): SignedUpload {
    return signDirectUpload(AD_MEDIA_FOLDER, kind);
  }

  /**
   * Sets an ad's one piece of media: an image or a video (uploaded by the admin website straight
   * to Cloudinary). A video longer than 30 seconds is deleted and refused. Media
   * the ad no longer uses is deleted from Cloudinary.
   */
  async setMedia(id: string, imageUrl: string | null, videoUrl: string | null): Promise<Ad> {
    const checked = await this.checkMedia(imageUrl, videoUrl);
    const result = await this.repository.setMedia(id, checked.images, checked.videoUrl, checked.videoSeconds);
    if (!result) throw AppError.notFound('Ad not found, or it was deleted.', 'AD_NOT_FOUND');
    await deletePhotosFromCloudinary(result.previousImages.filter((url) => !checked.images.includes(url)));
    if (result.previousVideo && result.previousVideo !== videoUrl) await deleteVideosFromCloudinary([result.previousVideo]);
    return result.ad;
  }

  /**
   * One image or one video, ours, wide (the Home slider is a row of 16:9 cards — a tall file is
   * deleted and refused), and a video no longer than 30 seconds (a longer one is deleted).
   */
  private async checkMedia(
    imageUrl: string | null,
    videoUrl: string | null,
  ): Promise<{ images: string[]; videoUrl: string | null; videoSeconds: number | null }> {
    if (!!imageUrl === !!videoUrl) throw AppError.badRequest('Add one image or one video.', 'AD_MEDIA_INVALID');
    if (imageUrl && !isOwnCloudinaryUrl(imageUrl, AD_MEDIA_FOLDER, 'image')) {
      throw AppError.badRequest('The image was not uploaded through NearbyU.', 'AD_MEDIA_INVALID');
    }
    if (videoUrl && !isOwnCloudinaryUrl(videoUrl, AD_MEDIA_FOLDER, 'video')) {
      throw AppError.badRequest('The video was not uploaded through NearbyU.', 'AD_MEDIA_INVALID');
    }
    const size = await mediaSize((imageUrl ?? videoUrl) as string, imageUrl ? 'image' : 'video');
    if (size && size.height >= size.width) {
      if (videoUrl) await deleteVideosFromCloudinary([videoUrl]);
      else await deletePhotosFromCloudinary([imageUrl as string]);
      throw AppError.badRequest('Only horizontal (wide, 16:9) pictures and videos can be used.', 'AD_MUST_BE_HORIZONTAL');
    }
    let videoSeconds: number | null = null;
    if (videoUrl) {
      videoSeconds = await videoDurationSeconds(videoUrl);
      if (videoSeconds === null || videoSeconds > AD_MAX_VIDEO_SECONDS + 1) {
        await deleteVideosFromCloudinary([videoUrl]);
        throw AppError.badRequest(`The video must be ${AD_MAX_VIDEO_SECONDS} seconds or shorter.`, 'AD_VIDEO_TOO_LONG');
      }
    }
    const images = imageUrl ? [imageUrl].slice(0, AD_MAX_IMAGES) : [];
    return { images, videoUrl, videoSeconds };
  }
}
