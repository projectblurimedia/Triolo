export const SUBSCRIPTION_AUDIENCES = ['customer', 'partner'] as const;
/** customer = the NearbyU app; partner = the NearbyU Partner app. */
export type SubscriptionAudience = (typeof SUBSCRIPTION_AUDIENCES)[number];

export const SUBSCRIPTION_MONTHS = [1, 3, 6, 12] as const;
export type SubscriptionMonths = (typeof SUBSCRIPTION_MONTHS)[number];
/** ₹ per plan, keyed by months. */
export type SubscriptionPrices = Record<'1' | '3' | '6' | '12', number>;

/** Partner plans are bought per profile: services (a worker), a shop, or job posts. */
export const PARTNER_PLANS = ['service', 'shop', 'job_post'] as const;
export type PartnerPlan = (typeof PARTNER_PLANS)[number];
/** 'all': a customer plan, or an older partner plan that covers every profile. */
export type SubscriptionPlan = 'all' | PartnerPlan;

export const BADGE_KINDS = ['service', 'business', 'job_post'] as const;
/** Which profile a "Trusted by NearbyU" badge is for: a worker's services, a shop or a job post. */
export type BadgeKind = (typeof BADGE_KINDS)[number];

export interface SubscriptionSettings {
  /** The main switch: customer and partner plans count only while it is on. */
  subscriptionsEnabled: boolean;
  customerEnabled: boolean;
  partnerEnabled: boolean;
  customerPrices: SubscriptionPrices;
  partnerPrices: SubscriptionPrices;
  /** Prices of each partner plan (services, shop, job posts). */
  partnerPlanPrices: Record<PartnerPlan, SubscriptionPrices>;
  /** Subscribed workers get Quick Book offers and new problems this many seconds before others. */
  headStartSeconds: number;
  badgeEnabled: boolean;
  badgePrice: number;
  /** An active badge whose profile's average falls below this (with enough ratings) needs the admin's review. */
  badgeMinRating: number;
  badgeMinRatings: number;
  /** Pay-per-use prices (₹) for customers without a plan. */
  customerFees: CustomerFees;
  /** Pay-per-use prices (₹) for partners without a plan. */
  partnerFees: PartnerFees;
  /** Free Quick Book accepts a month for workers without a plan (null = no limit). */
  quickBookLimit: number | null;
  /** Free Quick Order accepts a month for shops without a plan (null = no limit). */
  quickOrderLimit: number | null;
  /** Customers without a plan: bookings (Quick Book, a particular worker, problem posts) free each month (null = none). */
  customerFreeBookings: number | null;
  /** Customers without a plan: orders (Quick Order, a particular shop) free each month (null = none). */
  customerFreeOrders: number | null;
  updatedAt: string;
}

/** What customers without a plan pay once, per action. */
export interface CustomerFees {
  quickBook: number;
  directBook: number;
  quickOrder: number;
  shopOrder: number;
  postProblem: number;
  staffContact: number;
}

/** What partners without a plan pay once, per action. */
export interface PartnerFees {
  /** Accepting a job / order someone booked them for personally (Quick Book / Quick Order are free, within the limit). */
  accept: number;
  jobPost: number;
  /** Seeing one person who viewed a job post, with their number. */
  jobPostViewer: number;
  /** Seeing one person who viewed a services / shop profile, with their number. */
  profileViewer: number;
}

export const CUSTOMER_PASS_KINDS = ['quick_book', 'direct_book', 'quick_order', 'shop_order', 'post_problem', 'staff_contact'] as const;
/** Which monthly free uses a customer action takes from: bookings or orders. */
export const FREE_USE_GROUP: Record<string, 'bookings' | 'orders'> = {
  quick_book: 'bookings',
  direct_book: 'bookings',
  post_problem: 'bookings',
  quick_order: 'orders',
  shop_order: 'orders',
};
export const FREE_USE_KINDS: Record<'bookings' | 'orders', PassKindName[]> = {
  bookings: ['quick_book', 'direct_book', 'post_problem'],
  orders: ['quick_order', 'shop_order'],
};
type PassKindName = (typeof CUSTOMER_PASS_KINDS)[number];

export const PARTNER_PASS_KINDS = ['accept', 'job_post', 'job_post_viewer', 'profile_viewer'] as const;
export const PASS_KINDS = [...CUSTOMER_PASS_KINDS, ...PARTNER_PASS_KINDS] as const;
/** One paid use of one action (see CustomerFees / PartnerFees). */
export type PassKind = (typeof PASS_KINDS)[number];
export type CustomerPassKind = (typeof CUSTOMER_PASS_KINDS)[number];
/** Paid for one particular thing (a phone number, a viewer) — unlocked for good once paid, never a spare pass. */
export const PER_TARGET_KINDS: PassKind[] = ['staff_contact', 'job_post_viewer', 'profile_viewer'];

/** Each pass kind's price. */
export function passFee(settings: SubscriptionSettings, kind: PassKind): number {
  const c = settings.customerFees;
  const p = settings.partnerFees;
  return {
    quick_book: c.quickBook,
    direct_book: c.directBook,
    quick_order: c.quickOrder,
    shop_order: c.shopOrder,
    post_problem: c.postProblem,
    staff_contact: c.staffContact,
    accept: p.accept,
    job_post: p.jobPost,
    job_post_viewer: p.jobPostViewer,
    profile_viewer: p.profileViewer,
  }[kind];
}

export interface PayPass {
  id: string;
  accountId: string;
  kind: PassKind;
  targetId: string | null;
  amount: number;
  status: 'unpaid' | 'paid' | 'used';
  usedRef: string | null;
  paymentUrl: string | null;
  razorpayLinkId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  usedAt: string | null;
  createdAt: string;
}

export interface AdminPassRow extends PayPass {
  accountName: string;
  accountMobile: string;
}

/** Customer plans are shown (and booking / ordering locked) only with both switches on. */
export const customerPlansOn = (s: SubscriptionSettings) => s.subscriptionsEnabled && s.customerEnabled;
export const partnerPlansOn = (s: SubscriptionSettings) => s.subscriptionsEnabled && s.partnerEnabled;

export interface Subscription {
  id: string;
  accountId: string;
  audience: SubscriptionAudience;
  plan: SubscriptionPlan;
  months: SubscriptionMonths;
  amount: number;
  status: 'unpaid' | 'active' | 'cancelled';
  paymentUrl: string | null;
  razorpayLinkId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

/** What an app shows about the signed-in account's subscription. */
export interface MySubscription {
  /** Whether subscriptions are on for this app (otherwise the app shows nothing about them). */
  enabled: boolean;
  prices: SubscriptionPrices;
  active: { months: number; startsAt: string; endsAt: string } | null;
  /** A started payment not completed yet (its link can be opened again). */
  pending: { id: string; months: number; amount: number; paymentUrl: string } | null;
  /** Pay-per-use prices for this app (when plans are on and there's no plan). */
  fees: Record<string, number>;
  /** Paid uses not used yet, per kind. */
  passes: Record<string, number>;
  /** Partner app: how many seconds earlier subscribed workers hear of new jobs. */
  headStartSeconds?: number;
  /** Partner app: free Quick Book / Quick Order accepts a month without a plan (null = no limit). */
  limits?: { quickBook: number | null; quickOrder: number | null };
  /** Customer app: free uses this month without a plan, for bookings and for orders (null when none are given). */
  /** `limit` null: no limit (every one free). */
  freeUses?: { bookings: { limit: number | null; used: number } | null; orders: { limit: number | null; used: number } | null };
  /** Partner app: each plan on its own (services, shop, job posts). */
  // Per side, plus 'all' (the all-in-one plan).
  plans?: Record<PartnerPlan | 'all', PlanState>;
}

export interface PlanState {
  prices: SubscriptionPrices;
  active: { months: number; startsAt: string; endsAt: string } | null;
  pending: { id: string; months: number; amount: number; paymentUrl: string } | null;
}

export interface ProfileBadge {
  id: string;
  accountId: string;
  kind: BadgeKind;
  profileId: string;
  amount: number;
  status: 'unpaid' | 'active' | 'removed';
  paymentUrl: string | null;
  razorpayLinkId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  removedAt: string | null;
  removedReason: string | null;
  createdAt: string;
}

/** One of the partner's profiles with its badge state, for the partner app's Profile tab. */
export interface MyProfileBadge {
  kind: BadgeKind;
  profileId: string;
  name: string;
  /** A badge needs a verified worker / shop profile or a live job post. */
  eligible: boolean;
  status: 'none' | 'pending' | 'active' | 'removed';
  badgeId: string | null;
  paymentUrl: string | null;
  removedReason: string | null;
}

export interface MyBadges {
  enabled: boolean;
  price: number;
  profiles: MyProfileBadge[];
}

/** Profile ids with an active badge, per kind — the apps mark these "Trusted by NearbyU". */
export type TrustedIds = Record<BadgeKind, string[]>;

export interface AdminSubscriptionRow extends Subscription {
  accountName: string;
  accountMobile: string;
}

export interface AdminBadgeRow extends ProfileBadge {
  accountName: string;
  accountMobile: string;
  profileName: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

export interface SubscriptionOverview {
  settings: SubscriptionSettings;
  activeCustomers: number;
  activePartners: number;
  activeBadges: number;
  badgesToReview: number;
  revenueTotal: number;
  revenueThisMonth: number;
}
