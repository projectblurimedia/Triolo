import { apiClient } from './apiClient';

export type OrderStatus =
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
export type OrderFulfillment = 'pickup' | 'delivery';
export type OrderItemStatus = 'pending' | 'packed' | 'unavailable';

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'packed',
  'ready_for_pickup',
  'out_for_delivery',
];
/** Still needs the customer: in progress, or completed but not rated yet (rating is the last step). */
export function isOrderOpen(order: { status: OrderStatus; shopRating: number | null }): boolean {
  return ACTIVE_ORDER_STATUSES.includes(order.status) || (order.status === 'completed' && order.shopRating == null);
}

/** Short status label key — a completed, unrated order reads "Rate your order". */
export function orderStatusTitleKey(order: { status: OrderStatus; shopRating: number | null }): string {
  return order.status === 'completed' && order.shopRating == null ? 'orders.rateNowTitle' : `orders.status.${order.status}.title`;
}

/** The customer can cancel only before the shop starts reviewing the list. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['placed'];

export interface OrderItem {
  id: string;
  position: number;
  name: string;
  quantity: string;
  unit: string | null;
  status: OrderItemStatus;
  price: number | null;
}

export interface CustomerOrder {
  id: string;
  businessId: string;
  fulfillment: OrderFulfillment;
  status: OrderStatus;
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
  acceptedAt: string | null;
  /** Last change by the shop — no change for an hour means the order is stalled. */
  updatedAt?: string;
  packedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: OrderItem[];
  shop: {
    name: string;
    photoUrl: string | null;
    ratingAverage: number | null;
    ratingCount: number;
    latitude: number | null;
    longitude: number | null;
    address: string;
    /** Only once the shop has accepted the order. */
    mobileNumber: string | null;
  };
  /** Pickup/Delivery PIN — only while ready for pickup / out for delivery. */
  pin: string | null;
}

export interface CreateOrderParams {
  businessId: string;
  fulfillment: OrderFulfillment;
  items: { name: string; quantity: string; unit?: string | null }[];
  latitude: number;
  longitude: number;
  locationAddress?: string;
  note?: string;
}

export const ordersService = {
  create: (params: CreateOrderParams) => apiClient.post<CustomerOrder>('/orders', params, true),
  listMine: () => apiClient.get<CustomerOrder[]>('/orders/mine', true),
  get: (orderId: string) => apiClient.get<CustomerOrder>(`/orders/${orderId}`, true),
  /** With a rating: cancelling an order the shop hasn't moved on for over an hour. */
  cancel: (orderId: string, late?: { rating: number; review?: string }) =>
    apiClient.post<null>(
      `/orders/${orderId}/cancel`,
      late ? { rating: late.rating, review: late.review || undefined } : undefined,
      true,
    ),
  rate: (orderId: string, rating: number, review?: string) =>
    apiClient.post<null>(`/orders/${orderId}/rate`, { rating, review: review || undefined }, true),
};

/** Rupees for display: "120" or "120.50". */
export function formatRupees(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  return `₹${Number.isInteger(amount) ? amount.toLocaleString('en-IN') : amount.toFixed(2)}`;
}
