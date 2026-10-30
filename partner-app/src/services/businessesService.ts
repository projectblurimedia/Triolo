import { apiClient } from './apiClient';
import { appendPlace, PlaceValue } from '@/utils/place';
import { PickedImage } from '@/components/ImagePickerField';

/** A delivery staff member as the owner types them: their sign-in name and number. */
export interface StaffDraft {
  fullName: string;
  mobileNumber: string;
}

export interface CreateBusinessProfileParams {
  shopName: string;
  shopCategories: string[];
  otherCategoryDescription?: string;
  /** GPS or map pin — the full address is sent too, only the place name is ever shown. */
  place: PlaceValue;
  shopPhotos: PickedImage[];
  /** A new profile photo, or null to remove the saved one — uploaded by the hooks after the profile saves. */
  profilePhoto?: PickedImage | null;
  deliveryAvailable: boolean;
  deliveryPricePerKm?: number;
  deliveryMinCharge?: number;
  /** New shop only: delivery staff to add once it is saved. */
  staff?: StaffDraft[];
}

export interface UpdateBusinessProfileParams extends CreateBusinessProfileParams {
  /** Existing (already-uploaded) photo URLs to keep — anything omitted is dropped. */
  existingPhotoUrls: string[];
}

export interface BusinessProfile {
  id: string;
  accountId: string;
  shopName: string;
  shopCategories: string[];
  otherCategoryDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The place name shown to people (village / town). The rest is stored, never shown. */
  locationName: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  profilePhotoUrl: string | null;
  shopPhotoUrls: string[];
  deliveryAvailable: boolean;
  deliveryPricePerKm: number | null;
  /** Delivery never costs less than this. */
  deliveryMinCharge: number | null;
  verificationStatus: string;
}

/** Someone the owner added to deliver a shop's orders. */
export interface ShopStaffMember {
  id: string;
  accountId: string;
  fullName: string;
  mobileNumber: string;
  /** invited: hasn't joined in their Partner app yet; only active staff get deliveries. */
  status: 'invited' | 'active' | 'declined';
  createdAt: string;
}

/** A shop's invitation to deliver for it, waiting for this person's answer. */
export interface StaffInvite {
  businessId: string;
  shopName: string;
  ownerName: string;
  fullName: string;
  createdAt: string;
}

/** A shop this account delivers for. */
export interface StaffShop {
  businessId: string;
  shopName: string;
  ownerName: string;
}

/** A partner may own up to this many shops (the backend checks it too). */
export const MAX_SHOPS = 5;

const shopQuery = (shopId?: string) => (shopId ? `?shopId=${encodeURIComponent(shopId)}` : '');

export const businessesService = {
  /** The partner's first shop (verified first) — or one shop by id. */
  getMyProfile: (shopId?: string) => apiClient.get<BusinessProfile | null>(`/businesses/me/profile${shopQuery(shopId)}`, true),
  /** Every shop the partner owns. */
  listMine: () => apiClient.get<BusinessProfile[]>('/businesses/me/shops', true),
  listStaff: (shopId: string) => apiClient.get<ShopStaffMember[]>(`/businesses/me/shops/${shopId}/staff`, true),
  addStaff: (shopId: string, member: { fullName: string; mobileNumber: string }) =>
    apiClient.post<ShopStaffMember[]>(`/businesses/me/shops/${shopId}/staff`, member, true),
  removeStaff: (shopId: string, staffId: string) =>
    apiClient.delete<ShopStaffMember[]>(`/businesses/me/shops/${shopId}/staff/${staffId}`, true),
  /** Shops this account delivers for (empty unless an owner added them). */
  staffShops: () => apiClient.get<StaffShop[]>('/businesses/staff/me', true),
  staffInvites: () => apiClient.get<StaffInvite[]>('/businesses/staff/invites', true),
  answerInvite: (businessId: string, accept: boolean) =>
    apiClient.post<StaffInvite[]>(`/businesses/staff/invites/${businessId}/${accept ? 'accept' : 'decline'}`, undefined, true),
  /** Categories other shops added themselves (names) matching a search. */
  customCategories: (query: string) =>
    apiClient.get<string[]>(`/businesses/custom-categories?query=${encodeURIComponent(query)}`, true),

  createProfile: (params: CreateBusinessProfileParams) => {
    const formData = new FormData();
    formData.append('shopName', params.shopName);
    formData.append('shopCategories', JSON.stringify(params.shopCategories));
    if (params.otherCategoryDescription) formData.append('otherCategoryDescription', params.otherCategoryDescription);
    appendPlace(formData, params.place);
    formData.append('deliveryAvailable', String(params.deliveryAvailable));
    if (params.deliveryAvailable && params.deliveryPricePerKm != null) {
      formData.append('deliveryPricePerKm', String(params.deliveryPricePerKm));
    }
    if (params.deliveryAvailable && params.deliveryMinCharge != null) {
      formData.append('deliveryMinCharge', String(params.deliveryMinCharge));
    }
    params.shopPhotos.forEach((image) => {
      formData.append('shopPhotos', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return apiClient.postForm<BusinessProfile>('/businesses/me/profile', formData);
  },

  updateProfile: (params: UpdateBusinessProfileParams, shopId?: string) => {
    const formData = new FormData();
    formData.append('shopName', params.shopName);
    formData.append('shopCategories', JSON.stringify(params.shopCategories));
    if (params.otherCategoryDescription) formData.append('otherCategoryDescription', params.otherCategoryDescription);
    appendPlace(formData, params.place);
    formData.append('deliveryAvailable', String(params.deliveryAvailable));
    if (params.deliveryAvailable && params.deliveryPricePerKm != null) {
      formData.append('deliveryPricePerKm', String(params.deliveryPricePerKm));
    }
    if (params.deliveryAvailable && params.deliveryMinCharge != null) {
      formData.append('deliveryMinCharge', String(params.deliveryMinCharge));
    }
    formData.append('existingPhotoUrls', JSON.stringify(params.existingPhotoUrls));
    params.shopPhotos.forEach((image) => {
      formData.append('shopPhotos', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return apiClient.patchForm<BusinessProfile>(`/businesses/me/profile${shopQuery(shopId)}`, formData);
  },

  deleteProfile: (shopId?: string) => apiClient.delete<null>(`/businesses/me/profile${shopQuery(shopId)}`, true),
  uploadProfilePhoto: (image: PickedImage, shopId?: string) => {
    const formData = new FormData();
    // React Native's FormData takes this {uri, name, type} file shape.
    formData.append('photo', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    return apiClient.putForm<BusinessProfile>(`/businesses/me/profile/photo${shopQuery(shopId)}`, formData);
  },
  removeProfilePhoto: (shopId?: string) => apiClient.delete<BusinessProfile>(`/businesses/me/profile/photo${shopQuery(shopId)}`, true),
};
