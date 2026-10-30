import { apiClient } from './apiClient';
import { ShopOrderStatus } from './shopOrdersService';

/**
 * A delivery a shop owner handed to this account (delivery staff). Only what is needed at the
 * door: who, where, the packed items (no prices) and the cash to collect.
 */
export interface StaffDelivery {
  id: string;
  status: ShopOrderStatus;
  /** pending: handed to me, waiting for Accept / Decline; accepted: mine to deliver. */
  staffStatus: 'pending' | 'accepted';
  shopId: string;
  shopName: string;
  customerFullName: string;
  customerMobileNumber: string;
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  note: string | null;
  items: { name: string; quantity: string; unit: string | null }[];
  totalAmount: number | null;
  /** The shop, where it is picked up. */
  shopLatitude: number | null;
  shopLongitude: number | null;
  assignedAt: string | null;
  completedAt: string | null;
  pinAttemptsLeft: number;
}

export const deliveriesService = {
  listMine: () => apiClient.get<StaffDelivery[]>('/orders/staff/deliveries', true),
  get: (id: string) => apiClient.get<StaffDelivery>(`/orders/staff/deliveries/${id}`, true),
  answer: (id: string, accept: boolean) =>
    apiClient.post<StaffDelivery | null>(`/orders/staff/deliveries/${id}/${accept ? 'accept' : 'decline'}`, undefined, true),
  /** Where I am while delivering, so the shop owner sees it on the map. */
  updateLocation: (id: string, latitude: number, longitude: number) =>
    apiClient.put<null>(`/orders/staff/deliveries/${id}/location`, { latitude, longitude }, true),
  verifyPin: (id: string, pin: string) => apiClient.post<StaffDelivery>(`/orders/staff/deliveries/${id}/verify-pin`, { pin }, true),
};
