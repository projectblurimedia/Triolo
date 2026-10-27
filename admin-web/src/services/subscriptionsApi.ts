import { apiClient } from './apiClient';

export type SubscriptionAudience = 'customer' | 'partner';
export type SubscriptionPrices = Record<'1' | '3' | '6' | '12', number>;
export type BadgeKind = 'service' | 'business' | 'job_post';
/** Partner plans are bought per side: services, a shop or job posts. */
export type PartnerPlan = 'service' | 'shop' | 'job_post';

export interface SubscriptionSettings {
  /** The main switch: customer and partner plans show only while it is on. */
  subscriptionsEnabled: boolean;
  customerEnabled: boolean;
  partnerEnabled: boolean;
  customerPrices: SubscriptionPrices;
  partnerPrices: SubscriptionPrices;
  /** Prices of each partner plan (partnerPrices is only for older app builds' all-in-one plan). */
  partnerPlanPrices: Record<PartnerPlan, SubscriptionPrices>;
  /** Subscribed workers hear about Quick Book offers and new problems this many seconds first. */
  headStartSeconds: number;
  badgeEnabled: boolean;
  badgePrice: number;
  /** A badge whose profile average falls below this (with at least badgeMinRatings ratings) needs review. */
  badgeMinRating: number;
  badgeMinRatings: number;
  /** Pay per use (₹) for customers without a plan. */
  customerFees: { book: number; order: number; staffContact: number };
  /** Pay per use (₹) for partners without a plan. */
  partnerFees: { accept: number; jobPost: number };
  updatedAt: string;
}

export type PassKind = 'book' | 'order' | 'staff_contact' | 'accept' | 'job_post';

export interface AdminPass {
  id: string;
  accountId: string;
  kind: PassKind;
  amount: number;
  status: 'unpaid' | 'paid' | 'used';
  paidAt: string | null;
  usedAt: string | null;
  createdAt: string;
  accountName: string;
  accountMobile: string;
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

export interface AdminSubscription {
  id: string;
  accountId: string;
  audience: SubscriptionAudience;
  /** 'all': a customer plan, or an older partner plan covering every side. */
  plan?: 'all' | PartnerPlan;
  months: number;
  amount: number;
  status: 'unpaid' | 'active' | 'cancelled';
  razorpayPaymentId: string | null;
  paidAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  accountName: string;
  accountMobile: string;
}

export interface AdminBadge {
  id: string;
  accountId: string;
  kind: BadgeKind;
  profileId: string;
  amount: number;
  status: 'unpaid' | 'active' | 'removed';
  razorpayPaymentId: string | null;
  paidAt: string | null;
  removedAt: string | null;
  removedReason: string | null;
  createdAt: string;
  accountName: string;
  accountMobile: string;
  profileName: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const subscriptionsApi = {
  overview: () => apiClient.get<SubscriptionOverview>('/admin/subscriptions/overview', true),
  saveSettings: (changes: Partial<Omit<SubscriptionSettings, 'updatedAt'>>) =>
    apiClient.patch<SubscriptionSettings>('/admin/subscriptions/settings', changes, true),
  list: (filter: { audience?: SubscriptionAudience; state?: 'active' | 'ended' | 'unpaid'; q?: string }) =>
    apiClient.get<AdminSubscription[]>(`/admin/subscriptions/list${qs(filter)}`, true),
  badges: (status?: 'active' | 'removed') => apiClient.get<AdminBadge[]>(`/admin/subscriptions/badges${qs({ status })}`, true),
  badgesToReview: () => apiClient.get<AdminBadge[]>('/admin/subscriptions/badges/review', true),
  passes: (filter: { kind?: PassKind; q?: string }) => apiClient.get<AdminPass[]>(`/admin/subscriptions/passes${qs(filter)}`, true),
  removeBadge: (id: string, reason: string) => apiClient.post<AdminBadge>(`/admin/subscriptions/badges/${id}/remove`, { reason }, true),
};
