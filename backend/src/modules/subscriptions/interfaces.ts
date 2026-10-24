export const SUBSCRIPTION_AUDIENCES = ['customer', 'partner'] as const;
/** customer = the Triolo app; partner = the Triolo Partner app. */
export type SubscriptionAudience = (typeof SUBSCRIPTION_AUDIENCES)[number];

export const SUBSCRIPTION_MONTHS = [1, 3, 6, 12] as const;
export type SubscriptionMonths = (typeof SUBSCRIPTION_MONTHS)[number];
/** ₹ per plan, keyed by months. */
export type SubscriptionPrices = Record<'1' | '3' | '6' | '12', number>;

export const BADGE_KINDS = ['service', 'business', 'job_post'] as const;
/** Which profile a "Trusted by Triolo" badge is for: a worker's services, a shop or a job post. */
export type BadgeKind = (typeof BADGE_KINDS)[number];

export interface SubscriptionSettings {
  /** The main switch: customer and partner plans count only while it is on. */
  subscriptionsEnabled: boolean;
  customerEnabled: boolean;
  partnerEnabled: boolean;
  customerPrices: SubscriptionPrices;
  partnerPrices: SubscriptionPrices;
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
  updatedAt: string;
}

export interface CustomerFees {
  book: number;
  order: number;
  staffContact: number;
}

export interface PartnerFees {
  accept: number;
  jobPost: number;
}

export const PASS_KINDS = ['book', 'order', 'staff_contact', 'accept', 'job_post'] as const;
/** One paid use: book / order / see a staff number (customers), accept / publish a job post (partners). */
export type PassKind = (typeof PASS_KINDS)[number];
export const CUSTOMER_PASS_KINDS: PassKind[] = ['book', 'order', 'staff_contact'];

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

/** Profile ids with an active badge, per kind — the apps mark these "Trusted by Triolo". */
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
