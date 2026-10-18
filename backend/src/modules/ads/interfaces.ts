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

export const AD_APPS = ['user', 'partner'] as const;
export type AdApp = (typeof AD_APPS)[number];

/**
 * `launch` = full screen when the app opens; `action` = full screen before a key action
 * (customer app: Home's quick actions; partner app: marking work done / an order finished).
 */
export const AD_PLACEMENTS = ['launch', 'action'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export type AdStatus = 'scheduled' | 'running' | 'ended' | 'deleted';

export interface AdSettings {
  adsEnabled: boolean;
  launchUser: boolean;
  launchPartner: boolean;
  actionUser: boolean;
  actionPartner: boolean;
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
  paymentMethod: AdPaymentMethod;
  startDate: string;
  impressions: number;
  clicks: number;
  status: AdStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAdParams {
  advertiserName: string;
  advertiserPhone?: string | null;
  /** Kept for the list and the bill; defaults to the business name. */
  title?: string | null;
  description?: string | null;
  orientation: AdOrientation;
  displaySeconds: number;
  latitude: number;
  longitude: number;
  /** The place name shown under the ad (village / town). */
  locationText: string;
  linkUrl?: string | null;
  planDays: AdPlanDays;
  paymentMethod: AdPaymentMethod;
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
