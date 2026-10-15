import { apiClient } from './apiClient';

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
export type ShopOrderItemStatus = 'pending' | 'packed' | 'unavailable';

export const NEW_ORDER_STATUSES: ShopOrderStatus[] = ['placed'];
export const ACTIVE_SHOP_STATUSES: ShopOrderStatus[] = [
  'accepted',
  'preparing',
  'packed',
  'ready_for_pickup',
  'out_for_delivery',
];
/** The shop marks items (and prices) while in these statuses. */
export const PACKING_STATUSES: ShopOrderStatus[] = ['accepted', 'preparing'];

export interface ShopOrderItem {
  id: string;
  position: number;
  name: string;
  quantity: string;
  unit: string | null;
  status: ShopOrderItemStatus;
  price: number | null;
}

export interface ShopOrder {
  id: string;
  fulfillment: 'pickup' | 'delivery';
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
  createdAt: string;
  completedAt: string | null;
  items: ShopOrderItem[];
  customerFullName: string;
  customerMobileNumber: string;
  pinAttemptsLeft: number;
}

export interface ItemUpdate {
  id: string;
  status: ShopOrderItemStatus;
  price?: number | null;
}

export const shopOrdersService = {
  listMine: () => apiClient.get<ShopOrder[]>('/orders/shop/mine', true),
  get: (id: string) => apiClient.get<ShopOrder>(`/orders/shop/${id}`, true),
  accept: (id: string) => apiClient.post<null>(`/orders/${id}/accept`, undefined, true),
  decline: (id: string, reason?: string) => apiClient.post<null>(`/orders/${id}/decline`, { reason }, true),
  saveItems: (id: string, items: ItemUpdate[]) => apiClient.put<ShopOrder>(`/orders/${id}/items`, { items }, true),
  packed: (id: string) => apiClient.post<null>(`/orders/${id}/packed`, undefined, true),
  ready: (id: string) => apiClient.post<null>(`/orders/${id}/ready`, undefined, true),
  verifyPin: (id: string, pin: string) => apiClient.post<null>(`/orders/${id}/verify-pin`, { pin }, true),
  cancel: (id: string, reason?: string) => apiClient.post<null>(`/orders/${id}/shop-cancel`, { reason }, true),
};

/** Rupees for display: "₹120" or "₹120.50". */
export function formatRupees(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  return `₹${Number.isInteger(amount) ? amount.toLocaleString('en-IN') : amount.toFixed(2)}`;
}
