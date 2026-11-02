import { apiClient } from './apiClient';
// Paying in-app needs no payment link (the server then skips making one).
import { canPayInApp } from '@/utils/inAppPay';

export type SubscriptionPrices = Record<'1' | '3' | '6' | '12', number>;
/** One paid use (customers): a booking, an order, or a job seeker's phone number. */
/** One paid use of one action: each has its own price, set by the admin. */
export type PassKind = 'quick_book' | 'direct_book' | 'quick_order' | 'shop_order' | 'post_problem' | 'staff_contact';
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
  /** Free uses this month without a plan: bookings (incl. problem posts) and orders each have their own. */
  /** `limit` null: no limit (every one free). */
  freeUses?: { bookings: FreeUses | null; orders: FreeUses | null } | null;
}

export interface FreeUses {
  limit: number | null;
  used: number;
}

/** Which monthly free uses an action takes from. */
export function freeUseFor(mine: MySubscription, kind: PassKind): FreeUses | null {
  if (kind === 'staff_contact' || !mine.freeUses) return null;
  return (kind === 'quick_order' || kind === 'shop_order' ? mine.freeUses.orders : mine.freeUses.bookings) ?? null;
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
  /** Null when the app pays in-app (no payment link is made). */
  paymentUrl: string | null;
}

/** Profile ids with an active "Trusted by Triolo" badge, per kind. */
export type TrustedIds = Record<BadgeKind, string[]>;

export const subscriptionsService = {
  getMine: () => apiClient.get<MySubscription>('/subscriptions/me?audience=customer', true),
  checkout: (months: number) =>
    apiClient.post<CheckoutResult>('/subscriptions/checkout', { audience: 'customer', months, inApp: canPayInApp() }, true),
  check: (id: string) => apiClient.post<MySubscription & { paid: boolean }>(`/subscriptions/${id}/check`, undefined, true),
  /** Pay once (no plan): returns paid at once when nothing is owed. */
  passCheckout: (kind: PassKind, targetId: string | null = null) =>
    apiClient.post<PassCheckout>('/subscriptions/passes/checkout', { kind, ...(targetId ? { targetId } : {}), inApp: canPayInApp() }, true),
  passCheck: (id: string) => apiClient.post<{ paid: boolean }>(`/subscriptions/passes/${id}/check`, undefined, true),
  trusted: () => apiClient.get<TrustedIds>('/subscriptions/badges/trusted', true),
};
