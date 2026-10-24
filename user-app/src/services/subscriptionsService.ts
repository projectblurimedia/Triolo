import { apiClient } from './apiClient';

export type SubscriptionPrices = Record<'1' | '3' | '6' | '12', number>;
/** One paid use (customers): a booking, an order, or a job seeker's phone number. */
export type PassKind = 'book' | 'order' | 'staff_contact';
export type BadgeKind = 'service' | 'business' | 'job_post';
export const SUBSCRIPTION_MONTHS = [1, 3, 6, 12] as const;

export interface MySubscription {
  /** Subscriptions are on for this app (otherwise nothing about them is shown, and nothing is locked). */
  enabled: boolean;
  prices: SubscriptionPrices;
  active: { months: number; startsAt: string; endsAt: string } | null;
  /** A started payment not finished yet — its link can be opened again. */
  pending: { id: string; months: number; amount: number; paymentUrl: string } | null;
  /** Pay-once prices (₹), per kind. */
  fees: Record<string, number>;
  /** Paid uses not used yet, per kind. */
  passes: Record<string, number>;
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

/** Profile ids with an active "Trusted by Triolo" badge, per kind. */
export type TrustedIds = Record<BadgeKind, string[]>;

export const subscriptionsService = {
  getMine: () => apiClient.get<MySubscription>('/subscriptions/me?audience=customer', true),
  checkout: (months: number) =>
    apiClient.post<CheckoutResult>('/subscriptions/checkout', { audience: 'customer', months }, true),
  check: (id: string) => apiClient.post<MySubscription & { paid: boolean }>(`/subscriptions/${id}/check`, undefined, true),
  /** Pay once (no plan): returns paid at once when nothing is owed. */
  passCheckout: (kind: PassKind, targetId: string | null = null) =>
    apiClient.post<PassCheckout>('/subscriptions/passes/checkout', targetId ? { kind, targetId } : { kind }, true),
  passCheck: (id: string) => apiClient.post<{ paid: boolean }>(`/subscriptions/passes/${id}/check`, undefined, true),
  trusted: () => apiClient.get<TrustedIds>('/subscriptions/badges/trusted', true),
};
