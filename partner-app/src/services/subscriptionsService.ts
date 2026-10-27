import { apiClient } from './apiClient';

export type SubscriptionPrices = Record<'1' | '3' | '6' | '12', number>;
/** One paid use (partners): accepting a job / order, or publishing a job post. */
export type PassKind = 'accept' | 'job_post';
export type BadgeKind = 'service' | 'business' | 'job_post';
/** Partner plans are bought per side: services, a shop, or job posts — each with its own perks. */
export type PartnerPlan = 'service' | 'shop' | 'job_post';
export const PARTNER_PLANS: PartnerPlan[] = ['service', 'shop', 'job_post'];
/** The plan that goes with a profile kind. */
export const planForKind = (kind: BadgeKind): PartnerPlan => (kind === 'business' ? 'shop' : kind);

export interface PlanState {
  prices: SubscriptionPrices;
  active: { months: number; startsAt: string; endsAt: string } | null;
  pending: { id: string; months: number; amount: number; paymentUrl: string } | null;
}
export const SUBSCRIPTION_MONTHS = [1, 3, 6, 12] as const;
export const BOOST_DAYS = [1, 3, 7, 30] as const;

export interface MySubscription {
  /** Subscriptions are on for this app (otherwise nothing about them is shown). */
  enabled: boolean;
  prices: SubscriptionPrices;
  active: { months: number; startsAt: string; endsAt: string } | null;
  /** A started payment not finished yet — its link can be opened again. */
  pending: { id: string; months: number; amount: number; paymentUrl: string } | null;
  /** Pay-once prices (₹), per kind. */
  fees: Record<string, number>;
  /** Paid uses not used yet, per kind. */
  passes: Record<string, number>;
  /** Each plan on its own. */
  plans?: Record<PartnerPlan, PlanState>;
}

export interface PassCheckout {
  id: string | null;
  paid: boolean;
  amount: number;
  paymentUrl: string | null;
}

export interface CheckoutResult {
  id: string;
  amount: number;
  paymentUrl: string;
}

/** One of my profiles and its "Trusted by Triolo" badge. */
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

/** A boost: an ad (booked by me) that shows one of my profiles to customers. */
export interface Boost {
  id: string;
  actionType?: string;
  planDays: number;
  amount: number;
  startDate: string;
  endDate: string;
  status: 'unpaid' | 'in_review' | 'rejected' | 'scheduled' | 'running' | 'ended' | 'deleted';
  reviewNote: string | null;
  /** The profile it shows (its kind and id). */
  promoted?: { kind: string; id: string; name: string } | null;
  impressions: number;
  clicks: number;
  createdAt: string;
}

export interface BoostInfo {
  prices: Record<'1' | '3' | '7' | '30', number>;
}

/** Today in India, YYYY-MM-DD (a boost starts the day it's bought). */
function todayInIndia(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export const subscriptionsService = {
  getMine: () => apiClient.get<MySubscription>('/subscriptions/me?audience=partner', true),
  checkout: (months: number, plan: PartnerPlan) =>
    apiClient.post<CheckoutResult>('/subscriptions/checkout', { audience: 'partner', months, plan }, true),
  check: (id: string) => apiClient.post<MySubscription & { paid: boolean }>(`/subscriptions/${id}/check`, undefined, true),
  /** Pay once (no plan): returns paid at once when nothing is owed. */
  passCheckout: (kind: PassKind, targetId: string | null = null, plan?: PartnerPlan) =>
    apiClient.post<PassCheckout>(
      '/subscriptions/passes/checkout',
      { kind, ...(targetId ? { targetId } : {}), ...(plan ? { plan } : {}) },
      true,
    ),
  passCheck: (id: string) => apiClient.post<{ paid: boolean }>(`/subscriptions/passes/${id}/check`, undefined, true),

  getMyBadges: () => apiClient.get<MyBadges>('/subscriptions/badges/me', true),
  badgeCheckout: (kind: BadgeKind, profileId?: string) =>
    apiClient.post<CheckoutResult>('/subscriptions/badges/checkout', profileId ? { kind, profileId } : { kind }, true),
  badgeCheck: (id: string) => apiClient.post<MyBadges & { paid: boolean }>(`/subscriptions/badges/${id}/check`, undefined, true),

  boostInfo: () => apiClient.get<BoostInfo>('/ads/self/info', true),
  myBoosts: () => apiClient.get<Boost[]>('/ads/self', true),
  /** Books the boost (the admin reviews it once it's paid), then opens its payment. */
  async startBoost(kind: BadgeKind, days: number, mobileNumber: string, profileId?: string): Promise<{ id: string; paymentUrl: string }> {
    const ad = await apiClient.post<Boost>(
      '/ads/self',
      {
        actionType: kind,
        promoteMobile: mobileNumber,
        // Which job post, when the partner has several.
        ...(kind === 'job_post' && profileId ? { promotedPostId: profileId } : {}),
        orientation: 'vertical',
        displaySeconds: 15,
        planDays: days,
        startDate: todayInIndia(),
      },
      true,
    );
    const link = await apiClient.post<{ paymentUrl: string }>(`/ads/self/${ad.id}/pay-link`, undefined, true);
    return { id: ad.id, paymentUrl: link.paymentUrl };
  },
  payBoost: (id: string) => apiClient.post<{ paymentUrl: string }>(`/ads/self/${id}/pay-link`, undefined, true),
  checkBoost: (id: string) => apiClient.post<Boost>(`/ads/self/${id}/pay/check`, undefined, true),
};
