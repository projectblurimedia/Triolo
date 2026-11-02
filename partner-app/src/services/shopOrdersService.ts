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
  /** Typed in by the shop while packing (read from the list's photos). */
  addedByShop?: boolean;
}

export interface ShopOrder {
  id: string;
  /** Which of the partner's shops this order is for (a partner may own several). */
  shopId?: string | null;
  shopName?: string | null;
  /** Staff member taking this delivery (null: the owner delivers). */
  deliveryStaff?: { accountId: string; fullName: string; mobileNumber: string; accepted?: boolean } | null;
  /** Who handed a finished delivery over, when it was staff. */
  deliveredByName?: string | null;
  /** Where the staff member delivering it last was (their phone sends it while delivering). */
  staffLocation?: { latitude: number; longitude: number; at: string } | null;
  /** null while a Quick Order is still open to every shop asked. */
  businessId?: string | null;
  /** A Quick Order: sent to every matching shop nearby; the first to accept gets it. */
  quick?: boolean;
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
  acceptedAt?: string | null;
  packedAt?: string | null;
  readyAt?: string | null;
  completedAt: string | null;
  cancelledAt?: string | null;
  declinedAt?: string | null;
  expiredAt?: string | null;
  items: ShopOrderItem[];
  /** Photos of a written list the customer sent (instead of, or as well as, typed items). */
  listPhotoUrls?: string[];
  /** A voice message of the list, and its length in seconds. */
  listVoiceUrl?: string | null;
  listVoiceSeconds?: number | null;
  /** What the shop put with its bill. */
  billPhotoUrls?: string[];
  billVoiceUrl?: string | null;
  billVoiceSeconds?: number | null;
  billAmount?: number | null;
  /** When its photos / voice messages were removed (30 days after the order ended). */
  mediaDeletedAt?: string | null;
  customerFullName: string;
  /** Only once the order is accepted. */
  customerMobileNumber: string | null;
  pinAttemptsLeft: number;
  /** Just accepted: an ad to watch or the fee to pay before it opens (null when done). */
  unlockNeeded?: 'ad' | 'pay' | null;
}

export interface ItemUpdate {
  /** Left out for a new item the shop typed in (then `name` is needed). */
  id?: string;
  name?: string;
  status: ShopOrderItemStatus;
  price?: number | null;
}

/** What the shop puts with its bill: photos, a voice message, and a total typed in when items aren't priced one by one. */
export interface BillMedia {
  photoUrls: string[];
  voiceUrl: string | null;
  voiceSeconds: number | null;
  amount: number | null;
}

export const shopOrdersService = {
  /** A photo for the bill (the same upload the customer's list photos use). */
  uploadBillPhoto: (photo: { uri: string; name: string; type: string }) => {
    const formData = new FormData();
    formData.append('photo', { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
    return apiClient.postForm<{ url: string }>('/orders/list-photos', formData);
  },
  /** A voice message for the bill (an .m4a recording). */
  uploadBillVoice: (uri: string) => {
    const formData = new FormData();
    formData.append('voice', { uri, name: 'bill-voice.m4a', type: 'audio/m4a' } as unknown as Blob);
    return apiClient.postForm<{ url: string; seconds: number | null }>('/orders/list-voice', formData);
  },
  listMine: () => apiClient.get<ShopOrder[]>('/orders/shop/mine', true),
  /** Find Orders Now: open Quick Orders nearby this shop can take join its list (returned). */
  searchQuick: () => apiClient.post<ShopOrder[]>('/orders/shop/quick/search', undefined, true),
  /** This month's free Quick Order accepts without the shop plan (null limit = no limit). */
  quickLimit: () => apiClient.get<{ limit: number | null; used: number; remaining: number | null }>('/orders/shop/quick/limit', true),
  get: (id: string) => apiClient.get<ShopOrder>(`/orders/shop/${id}`, true),
  accept: (id: string) => apiClient.post<null>(`/orders/${id}/accept`, undefined, true),
  /** After accepting: watched the ad, or pays (PAYMENT_REQUIRED until a pass is bought). */
  unlock: (id: string, via: 'ad' | 'pay') => apiClient.post<ShopOrder>(`/orders/${id}/unlock`, { via }, true),
  /** After accepting: backed out of the payment — the order goes back. */
  release: (id: string) => apiClient.post<null>(`/orders/${id}/release`, undefined, true),
  decline: (id: string, reason?: string) => apiClient.post<null>(`/orders/${id}/decline`, { reason }, true),
  saveItems: (id: string, items: ItemUpdate[], bill?: BillMedia) =>
    apiClient.put<ShopOrder>(`/orders/${id}/items`, { items, ...(bill ? { bill } : {}) }, true),
  packed: (id: string) => apiClient.post<null>(`/orders/${id}/packed`, undefined, true),
  ready: (id: string) => apiClient.post<null>(`/orders/${id}/ready`, undefined, true),
  /** Gives a delivery order to a staff member (null: the owner takes it back). */
  assignDelivery: (id: string, staffAccountId: string | null) =>
    apiClient.post<null>(`/orders/${id}/assign-delivery`, { staffAccountId }, true),
  /** The owner delivering it himself: where he is now. */
  updateDeliveryLocation: (id: string, latitude: number, longitude: number) =>
    apiClient.put<null>(`/orders/${id}/delivery-location`, { latitude, longitude }, true),
  verifyPin: (id: string, pin: string) => apiClient.post<null>(`/orders/${id}/verify-pin`, { pin }, true),
  cancel: (id: string, reason?: string) => apiClient.post<null>(`/orders/${id}/shop-cancel`, { reason }, true),
};

/** Rupees for display: "₹120" or "₹120.50". */
export function formatRupees(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  return `₹${Number.isInteger(amount) ? amount.toLocaleString('en-IN') : amount.toFixed(2)}`;
}
