/** Prices (₹) per plan length in days, keyed "1" / "3" / "7" / "30". Set by the admin. */
export type AdPlanPrices = Record<'1' | '3' | '7' | '30', number>;
export const AD_PLAN_DAYS = [1, 3, 7, 30] as const;
export type AdPlanDays = (typeof AD_PLAN_DAYS)[number];

/** People see an ad only within this distance of the ad's place. */
export const AD_RADIUS_KM = 5;

/** One piece of media per ad: a single image or a single video. */
export const AD_MAX_IMAGES = 1;
/** Longest video an ad may have (seconds). */
export const AD_MAX_VIDEO_SECONDS = 30;
export const AD_ORIENTATIONS = ['vertical', 'horizontal'] as const;
export type AdOrientation = (typeof AD_ORIENTATIONS)[number];
/** Cloudinary folder every ad's images and video live in. */
export const AD_MEDIA_FOLDER = 'triolo/ads';

export const AD_PAYMENT_METHODS = ['cash', 'upi', 'other'] as const;
export type AdPaymentMethod = (typeof AD_PAYMENT_METHODS)[number];
/** 'pending' = not paid yet; 'online' = paid through Razorpay on the Triolo Ads website. */
export type AdPaymentState = AdPaymentMethod | 'pending' | 'online';

/** How many ads one business may have waiting for review (or rejected) at a time. */
export const AD_SELF_OPEN_LIMIT = 5;

/** pending = waiting for the admin; only 'approved' ads are ever shown in the apps. */
export type AdReviewStatus = 'pending' | 'approved' | 'rejected';

export const AD_APPS = ['user', 'partner'] as const;
export type AdApp = (typeof AD_APPS)[number];

/**
 * `launch` = full screen when the app opens; `action` = full screen before a key action
 * (customer app: Home's quick actions; partner app: marking work done / an order finished).
 */
export const AD_PLACEMENTS = ['launch', 'action'] as const;
/** 'launch' (full screen when an app opens) is no longer shown; kept so older app builds get a clean "no ad". */
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

/** The key actions that can show an ad first, per app — each switched on or off by the admin. */
export const AD_SPOTS_BY_APP = {
  user: ['quick_book', 'book_worker', 'send_list', 'post_problem', 'hire_staff'],
  partner: ['work_done', 'order_pin'],
} as const;
export const AD_SPOTS = [...AD_SPOTS_BY_APP.user, ...AD_SPOTS_BY_APP.partner] as const;
export type AdSpot = (typeof AD_SPOTS)[number];

/** in_review / rejected: a self-booked ad not approved (yet); otherwise by its dates. */
/**
 * What tapping the ad does: nothing (it just promotes), open a link, show directions to a
 * place, or open a Triolo profile — a worker's service ("Book Now"), a shop ("Order from this
 * Shop") or a job post ("Contact").
 */
export const AD_ACTION_TYPES = ['none', 'link', 'location', 'service', 'business', 'job_post'] as const;
export type AdActionType = (typeof AD_ACTION_TYPES)[number];
export type AdPromotedKind = 'service' | 'business' | 'job_post';

/** The profile an ad promotes, as the apps need it to open the right screen. */
export interface AdPromoted {
  kind: AdPromotedKind;
  id: string;
  /** The worker's / shop's / job post's name when the ad was saved. */
  name: string;
}

/**
 * What a profile ad shows instead of a picture or video: the promoted worker, shop or job post
 * as a card. Looked up when the ad is served, so its rating and photo are current.
 */
export interface AdPromotedCard {
  kind: AdPromotedKind;
  name: string;
  photoUrl: string | null;
  /** Skill (worker) or shop category codes; the apps translate them. */
  tags: string[];
  /** Words typed for "other" (shown as they are). */
  customTags: string[];
  /** A job post's work, e.g. "Cook". */
  headline: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  experienceYears: number | null;
  deliveryAvailable: boolean | null;
  payAmount: number | null;
  payPeriod: 'daily' | 'monthly' | null;
  placeName: string | null;
  /** The profile has an active "Trusted by Triolo" badge. */
  trusted?: boolean;
}

/** Where "Directions" takes people. */
export interface AdDestination {
  latitude: number;
  longitude: number;
  name: string;
}

/** The ad's tap action as stored (what the service saves after checking it). */
export interface AdActionColumns {
  actionType: AdActionType;
  linkUrl: string | null;
  actionLatitude: number | null;
  actionLongitude: number | null;
  actionPlace: string | null;
  promotedId: string | null;
  promotedName: string | null;
  promoteMobile: string | null;
}

/** Looks up the profile an ad promotes, through the owning modules (see promotions.ts). */
export interface PromotionResolver {
  accountIdByMobile(mobileNumber: string): Promise<string | null>;
  /** The account's verified worker / shop, or its live job post: its id and display name. */
  find(kind: AdPromotedKind, accountId: string): Promise<{ id: string; name: string } | null>;
  /** The promoted profile as a card, or null when it's no longer available. */
  card(kind: AdPromotedKind, id: string): Promise<AdPromotedCard | null>;
}

/** unpaid: booked on the Triolo Ads website, waiting for its online payment (then in_review). */
export type AdStatus = 'unpaid' | 'in_review' | 'rejected' | 'scheduled' | 'running' | 'ended' | 'deleted';

export interface AdSettings {
  adsEnabled: boolean;
  launchUser: boolean;
  launchPartner: boolean;
  actionUser: boolean;
  actionPartner: boolean;
  /** Each key action's own switch (under its app's switch). */
  spots: Record<AdSpot, boolean>;
  /** At least this many seconds between two ads for the same person (0 = no gap). */
  actionGapSeconds: number;
  /** Applies to new bookings only — each ad keeps the amount it was booked at. */
  prices: AdPlanPrices;
  updatedAt: string;
}

/** What the apps get: only what's shown to people. */
export interface PublicAd {
  id: string;
  title: string;
  description: string | null;
  /** First image — kept for app builds from before ads had several images. */
  imageUrl: string | null;
  /** Up to 4 images, shown as a carousel (after the video, if there is one). */
  imageUrls: string[];
  /** One video, played muted first. */
  videoUrl: string | null;
  advertiserName: string;
  contactPhone: string | null;
  locationText: string | null;
  /** Opened when the ad is tapped (or its Visit button). */
  linkUrl: string | null;
  /** What tapping it does (see AD_ACTION_TYPES). */
  actionType: AdActionType;
  destination: AdDestination | null;
  promoted: AdPromoted | null;
  /** Filled in when served: the profile card a profile ad shows. */
  promotedCard?: AdPromotedCard | null;
  endDate: string;
  /** Vertical (reel, 9:16) or horizontal (16:9) — the apps shape the full-screen card to it. */
  orientation: AdOrientation;
  /** How long it shows before it can be closed: an image's set time, or the video's length. */
  durationSeconds: number;
}

export interface Ad extends PublicAd {
  billNumber: number;
  latitude: number | null;
  longitude: number | null;
  /** Shown only to people within this distance of the place. */
  radiusKm: number;
  advertiserPhone: string | null;
  /** For an image: seconds shown before it can be closed (3–30). */
  displaySeconds: number;
  /** For a video: its length in seconds (at most 30). */
  videoSeconds: number | null;
  planDays: AdPlanDays;
  amount: number;
  paymentMethod: AdPaymentState;
  startDate: string;
  /** The business account that booked it on the Triolo Ads website; null when the admin did. */
  ownerAccountId: string | null;
  reviewStatus: AdReviewStatus;
  /** Why it was rejected (shown to the business). */
  reviewNote: string | null;
  reviewedAt: string | null;
  /** The phone number the admin used to find the promoted profile (refills the form). */
  promoteMobile: string | null;
  /** Booked on the Triolo Ads website after online payment began: must be paid before review. */
  needsPayment: boolean;
  razorpayOrderId: string | null;
  /** A boost bought in the partner app is paid through a payment link (opened in the browser). */
  razorpayLinkId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  /** The Razorpay refund of a rejected / withdrawn online payment. */
  refundId: string | null;
  refundedAt: string | null;
  impressions: number;
  clicks: number;
  status: AdStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAdParams {
  /** Left out when promoting a Triolo Partner profile (its own name is used). */
  advertiserName?: string;
  advertiserPhone?: string | null;
  /** Kept for the list and the bill; defaults to the business name. */
  title?: string | null;
  description?: string | null;
  orientation: AdOrientation;
  displaySeconds: number;
  /**
   * Ignored when saving: an ad has a place only with 'Show directions' (that place — the ad is
   * then shown within its radius); every other ad has none and is shown everywhere.
   */
  latitude?: number | null;
  longitude?: number | null;
  locationText?: string | null;
  linkUrl?: string | null;
  actionType?: AdActionType;
  actionLatitude?: number | null;
  actionLongitude?: number | null;
  actionPlace?: string | null;
  /** Admin form: the phone number of the account whose profile the ad promotes. */
  promoteMobile?: string | null;
  planDays: AdPlanDays;
  paymentMethod: AdPaymentState;
  /** YYYY-MM-DD (India date). */
  startDate: string;
}

/** An ad's media sent along when booking or editing it: one image or one video. */
export interface AdMediaInput {
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface AdListFilter {
  status?: AdStatus;
  q?: string;
  page: number;
  limit: number;
}
