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
  /** Typed in by the shop, read from the list's photos. */
  addedByShop?: boolean;
}

export interface CustomerOrder {
  id: string;
  /** null for a Quick Order no shop has accepted yet. */
  businessId: string | null;
  /** Sent to every matching shop nearby at once; the first to accept gets it. */
  quick?: boolean;
  /** Quick Order: the kinds of shop asked. */
  shopCategories?: string[];
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
  /** Photos of the written list sent with the order. */
  listPhotoUrls?: string[];
  listVoiceUrl?: string | null;
  listVoiceSeconds?: number | null;
  /** What the shop put with its bill. */
  billPhotoUrls?: string[];
  billVoiceUrl?: string | null;
  billVoiceSeconds?: number | null;
  billAmount?: number | null;
  /** When its photos / voice messages were removed (30 days after the order ended). */
  mediaDeletedAt?: string | null;
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
  /** Who is bringing it, once a shop's delivery staff member took the delivery. */
  deliveryPersonName?: string | null;
  /** Where the delivery is now, while it is out for delivery. */
  deliveryLocation?: { latitude: number; longitude: number } | null;
}

export interface CreateOrderParams {
  businessId: string;
  fulfillment: OrderFulfillment;
  items: { name: string; quantity: string; unit?: string | null }[];
  listPhotoUrls?: string[];
  listVoiceUrl?: string | null;
  listVoiceSeconds?: number | null;
  latitude: number;
  longitude: number;
  locationAddress?: string;
  note?: string;
}

export interface CreateQuickOrderParams {
  shopCategories: string[];
  fulfillment: OrderFulfillment;
  items: { name: string; quantity: string; unit?: string | null }[];
  listPhotoUrls?: string[];
  listVoiceUrl?: string | null;
  listVoiceSeconds?: number | null;
  latitude: number;
  longitude: number;
  locationAddress?: string;
  note?: string;
}

/** A Quick Order still looking for a shop (no shop has accepted it yet). */
export function isFindingShop(order: Pick<CustomerOrder, 'quick' | 'businessId' | 'status'>): boolean {
  return !!order.quick && !order.businessId && order.status === 'placed';
}

export const ordersService = {
  /** One photo of a written list, before the order is sent (one per request: Vercel caps bodies at 4.5 MB). */
  uploadListPhoto: (photo: { uri: string; name: string; type: string }) => {
    const formData = new FormData();
    formData.append('photo', { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
    return apiClient.postForm<{ url: string }>('/orders/list-photos', formData);
  },
  /** A voice message of the list (an .m4a recording); its link and length go with the order. */
  uploadListVoice: (voice: { uri: string }) => {
    const formData = new FormData();
    formData.append('voice', { uri: voice.uri, name: 'list-voice.m4a', type: 'audio/m4a' } as unknown as Blob);
    return apiClient.postForm<{ url: string; seconds: number | null }>('/orders/list-voice', formData);
  },
  create: (params: CreateOrderParams) => apiClient.post<CustomerOrder>('/orders', params, true),
  /** Quick Order: to every matching shop nearby at once (404 QUICK_ORDER_NO_SHOPS when none). */
  createQuick: (params: CreateQuickOrderParams) => apiClient.post<CustomerOrder>('/orders/quick', params, true),
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
