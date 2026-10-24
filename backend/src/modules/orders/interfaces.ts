import { PreferredLanguage } from '@/modules/auth/interfaces';

/**
 * A shop order built from the customer's prepared list (docs/product-specification.md §3):
 *   placed → accepted (shop starts reviewing) → preparing (marking items) → packed (bill sent)
 *     → ready_for_pickup | out_for_delivery → completed (the customer's PIN, entered by the shop)
 *   placed → declined (shop) | expired (no answer within ORDER_TTL_MINUTES) | cancelled (customer)
 *   any step before completed → cancelled (shop)
 */
export type ShopOrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'packed'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'expired';
export type ShopOrderFulfillment = 'pickup' | 'delivery';
export type ShopOrderItemStatus = 'pending' | 'packed' | 'unavailable';

/** The customer may cancel only before the shop starts reviewing (spec §3 Cancellation Rules). */
export const CUSTOMER_CANCELLABLE: ShopOrderStatus[] = ['placed'];
/** The shop may cancel at any step before completion. */
export const SHOP_CANCELLABLE: ShopOrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'packed',
  'ready_for_pickup',
  'out_for_delivery',
];
/** The shop marks items (and their prices) while reviewing. */
export const PACKING_STATUSES: ShopOrderStatus[] = ['accepted', 'preparing'];
/** The customer's PIN is shown — and accepted by the shop — only at handover. */
export const HANDOVER_STATUSES: ShopOrderStatus[] = ['ready_for_pickup', 'out_for_delivery'];
export const ACTIVE_ORDER_STATUSES: ShopOrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'packed',
  'ready_for_pickup',
  'out_for_delivery',
];

/**
 * A list the shop doesn't answer within this many minutes ends as 'expired' — the default;
 * each customer sets their own (accounts.wait_order_minutes, migration 0048).
 */
export const ORDER_TTL_MINUTES = 1440;
/** The customer's own waiting time for shop order `o`'s alias (read live, see migration 0048). */
export const ORDER_WAIT_SQL = (alias: string) =>
  `make_interval(mins => COALESCE((SELECT CASE WHEN ${alias}.quick THEN wa.wait_quick_order_minutes ELSE wa.wait_order_minutes END
     FROM accounts wa WHERE wa.id = ${alias}.account_id), CASE WHEN ${alias}.quick THEN ${QUICK_ORDER_TTL_MINUTES} ELSE ${ORDER_TTL_MINUTES} END))`;
/** A Quick Order's own waiting time (accounts.wait_quick_order_minutes) — the fallback. */
export const QUICK_ORDER_TTL_MINUTES = 15;
/** How far a Quick Order reaches (the same testing radius as Quick Book). */
export const QUICK_ORDER_RADIUS_KM = 50;
/** At most this many shops are asked at once. */
export const QUICK_ORDER_MAX_SHOPS = 50;
/**
 * An accepted order with no progress for this long counts as stalled: the customer may then
 * cancel it and rate the shop (otherwise only a just-placed order can be cancelled).
 */
export const ORDER_LATE_AFTER_MINUTES = 60;
/** Steps a stalled order can be cancelled from (the shop took it but hasn't handed it over). */
export const ORDER_LATE_STATUSES: ShopOrderStatus[] = [
  'accepted',
  'preparing',
  'packed',
  'ready_for_pickup',
  'out_for_delivery',
];
export const MAX_PIN_ATTEMPTS = 5;
export const MAX_ORDER_ITEMS = 100;

export interface ShopOrderItem {
  id: string;
  position: number;
  name: string;
  quantity: string;
  unit: string | null;
  status: ShopOrderItemStatus;
  /** Rupees, for a packed item. */
  price: number | null;
}

export interface ShopOrder {
  id: string;
  accountId: string;
  /** null for a Quick Order no shop has accepted yet. */
  businessId: string | null;
  /** Sent to every matching shop nearby at once (first to accept gets it). */
  quick: boolean;
  /** Quick Order: the kinds of shop asked. */
  shopCategories: string[];
  fulfillment: ShopOrderFulfillment;
  status: ShopOrderStatus;
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  distanceMeters: number;
  deliveryCharge: number;
  itemsTotal: number | null;
  totalAmount: number | null;
  note: string | null;
  cancelledBy: 'customer' | 'shop' | 'admin' | null;
  cancelReason: string | null;
  shopRating: number | null;
  shopReview: string | null;
  acceptedAt: Date | null;
  packedAt: Date | null;
  readyAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  declinedAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  /** Last change — an accepted order unchanged for ORDER_LATE_AFTER_MINUTES is stalled. */
  updatedAt: Date;
  items: ShopOrderItem[];
}

/** The shop as the customer sees it on their order. */
export interface OrderShop {
  name: string;
  photoUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  latitude: number | null;
  longitude: number | null;
  address: string;
  /** The owner's number — only once the shop has accepted the order. */
  mobileNumber: string | null;
}

export interface CustomerOrder extends ShopOrder {
  shop: OrderShop;
  /** Pickup/Delivery PIN — only while ready_for_pickup / out_for_delivery. */
  pin: string | null;
}

export interface ShopSideOrder extends ShopOrder {
  customerFullName: string;
  customerMobileNumber: string;
  pinAttemptsLeft: number;
}

export interface NotifyTarget {
  accountId: string;
  preferredLanguage: PreferredLanguage;
}

/** A status change plus who to tell about it. */
export interface OrderTransition {
  order: ShopOrder;
  notify: NotifyTarget | null;
  shopName: string;
}

export type VerifyOrderPinResult =
  | { outcome: 'not_found' }
  | { outcome: 'locked' }
  | { outcome: 'wrong'; attemptsLeft: number }
  | { outcome: 'verified'; transition: OrderTransition };

export interface CreateOrderParams {
  accountId: string;
  businessId: string;
  fulfillment: ShopOrderFulfillment;
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  distanceMeters: number;
  deliveryCharge: number;
  note: string | null;
  items: { name: string; quantity: string; unit: string | null }[];
}

export interface CreateQuickOrderParams {
  accountId: string;
  fulfillment: ShopOrderFulfillment;
  shopCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  note: string | null;
  items: { name: string; quantity: string; unit: string | null }[];
  offers: { businessId: string; distanceMeters: number }[];
}

export interface ItemUpdate {
  id: string;
  status: ShopOrderItemStatus;
  price: number | null;
}

/** A finished, rated order — for the shop's public reviews. */
export interface RatedOrder {
  rating: number | null;
  review: string | null;
  customerFullName: string;
  completedAt: Date;
}

/** An order as the admin sees it: the customer and the shop with their phones (never the PIN). */
export interface AdminOrder extends ShopOrder {
  customer: { accountId: string; fullName: string; mobileNumber: string };
  shop: { businessId: string; accountId: string; name: string; ownerName: string; mobileNumber: string };
}

export type AdminOrderGroup = 'new' | 'active' | 'completed' | 'cancelled';

export interface AdminOrderListFilter {
  q?: string;
  group?: AdminOrderGroup;
  accountId?: string;
  page: number;
  limit: number;
}

export interface AdminOrderCancelResult {
  order: ShopOrder;
  shopName: string;
  customer: { accountId: string; preferredLanguage: 'en' | 'te' };
  /** null for a Quick Order no shop had taken. */
  shopOwner: { accountId: string; preferredLanguage: 'en' | 'te' } | null;
}
