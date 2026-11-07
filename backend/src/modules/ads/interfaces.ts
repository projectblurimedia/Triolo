/** Prices (₹) per plan length in days, keyed "1" / "3" / "7" / "30". Set by the admin. */
export type AdPlanPrices = Record<'1' | '3' | '7' | '30', number>;
export const AD_PLAN_DAYS = [1, 3, 7, 30] as const;
export type AdPlanDays = (typeof AD_PLAN_DAYS)[number];

/** Bought by days (a plan above), or by views (a number of views at the admin's per-view price). */
export const AD_BILLINGS = ['days', 'views'] as const;
export type AdBilling = (typeof AD_BILLINGS)[number];
export const AD_VIEWS_MIN = 500;
export const AD_VIEWS_MAX = 10000;
/** A views ad runs until its views are used up, at most this many days from its start. */
export const AD_VIEWS_VALID_DAYS = 90;
/** How many ads the Home carousel shows at most. */
export const AD_HOME_MAX = 5;

/** People see an ad only within this distance of the ad's place. */
export const AD_RADIUS_KM = 5;

/** One piece of media per ad: a single image or a single video. */
export const AD_MAX_IMAGES = 1;
/** Longest video an ad may have (seconds). */
export const AD_MAX_VIDEO_SECONDS = 30;
export const AD_ORIENTATIONS = ['vertical', 'horizontal'] as const;
/**
 * Where an ad is shown: full screen before key actions ('action'), or as a wide card in the
 * slider at the top of Home ('home' — always horizontal).
 */
export const AD_SHOW_ON = ['action', 'home'] as const;
export type AdShowOn = (typeof AD_SHOW_ON)[number];
export type AdOrientation = (typeof AD_ORIENTATIONS)[number];
/** Cloudinary folder every ad's images and video live in. */
export const AD_MEDIA_FOLDER = 'triolo/ads';

export const AD_PAYMENT_METHODS = ['cash', 'upi', 'other'] as const;
export type AdPaymentMethod = (typeof AD_PAYMENT_METHODS)[number];
/** 'pending' = not paid yet; 'online' = paid through Razorpay on the NearbyU Ads website. */
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
  // send_list = ordering from a particular shop; staff_phone = Hire Staff showing a phone number.
  user: ['quick_book', 'book_worker', 'quick_order', 'send_list', 'post_problem', 'hire_staff', 'staff_phone'],
  // Never before accepting (someone else could take it meanwhile): after an accept, before its
  // details open (job_accept / order_accept), and on the partner's own searches and screens.
  partner: ['find_jobs', 'find_orders', 'problem_accept', 'continue_card', 'job_accept', 'order_accept', 'viewer_reveal'],
} as const;
/** Spots older app builds may still ask for; always off now. */
export const AD_RETIRED_SPOTS = ['work_done', 'order_pin'] as const;
export const AD_SPOTS = [...AD_SPOTS_BY_APP.user, ...AD_SPOTS_BY_APP.partner, ...AD_RETIRED_SPOTS] as const;
export type AdSpot = (typeof AD_SPOTS)[number];

/** in_review / rejected: a self-booked ad not approved (yet); otherwise by its dates. */
/**
 * What tapping the ad does: nothing (it just promotes), open a link, show directions to a
 * place, or open a NearbyU profile — a worker's service ("Book Now"), a shop ("Order from this
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
  /** The profile has an active "Trusted by NearbyU" badge. */
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
  find(kind: AdPromotedKind, accountId: string, preferredId?: string | null): Promise<{ id: string; name: string } | null>;
  /** The promoted profile as a card, or null when it's no longer available. */
  card(kind: AdPromotedKind, id: string): Promise<AdPromotedCard | null>;
}

/** unpaid: booked on the NearbyU Ads website, waiting for its online payment (then in_review). */
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
  /** ₹ per view, for ads bought by views. */
  pricePerView: number;
  /** A carousel of running ads at the top of Home, per app. */
  homeUser: boolean;
  homePartner: boolean;
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
  /** Before key actions, or in Home's slider. */
  showOn: AdShowOn;
  /** How long it shows before it can be closed: an image's set time, or the video's length. */
  durationSeconds: number;
  /** Home slider: how long a picture stays before the next ad (the admin's setting). */
  slideSeconds?: number;
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
  planDays: AdPlanDays | 90;
  billing: AdBilling;
  /** Views bought (views ads only); the ad ends when they are used up. */
  viewLimit: number | null;
  amount: number;
  paymentMethod: AdPaymentState;
  startDate: string;
  /** The business account that booked it on the NearbyU Ads website; null when the admin did. */
  ownerAccountId: string | null;
  reviewStatus: AdReviewStatus;
  /** Why it was rejected (shown to the business). */
  reviewNote: string | null;
  reviewedAt: string | null;
  /** The phone number the admin used to find the promoted profile (refills the form). */
  promoteMobile: string | null;
  /** Booked on the NearbyU Ads website after online payment began: must be paid before review. */
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
  /** Who removed it: the business itself (withdrawn) or the NearbyU admin. */
  deletedBy: 'owner' | 'admin' | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAdParams {
  /** Left out when promoting a NearbyU Partner profile (its own name is used). */
  advertiserName?: string;
  advertiserPhone?: string | null;
  /** Kept for the list and the bill; defaults to the business name. */
  title?: string | null;
  description?: string | null;
  orientation: AdOrientation;
  /** Before key actions (default) or Home's slider. */
  showOn?: AdShowOn;
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
  /** Boosting one of several job posts: which one. */
  promotedPostId?: string | null;
  planDays: AdPlanDays | 90;
  /** Days (default) or views. */
  billing?: AdBilling;
  /** Views ads: how many views (AD_VIEWS_MIN – AD_VIEWS_MAX). */
  viewLimit?: number | null;
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
