import { apiClient } from './apiClient';
import { appendPlace, PlaceValue } from '@/utils/place';

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
  deliveryMinCharge: number | null;
  verificationStatus: string;
}

export interface BusinessProfileWithAccount extends BusinessProfile {
  accountFullName: string;
  accountMobileNumber: string;
  accountEmail: string;
}

export interface CreateBusinessProfileParams {
  shopName: string;
  shopCategories: string[];
  otherCategoryDescription?: string;
  /** GPS or map pin — the full address is sent too, only the place name is ever shown. */
  place: PlaceValue;
  shopPhotos: File[];
  deliveryAvailable: boolean;
  deliveryPricePerKm?: number;
  deliveryMinCharge?: number;
}

export const businessesService = {
  getMyProfile: () => apiClient.get<BusinessProfile | null>('/businesses/me/profile', true),

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
    params.shopPhotos.forEach((file) => formData.append('shopPhotos', file));
    return apiClient.postForm('/businesses/me/profile', formData);
  },
  /** The profile photo goes in its own request after the profile is created. */
  uploadProfilePhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient.putForm<BusinessProfile>('/businesses/me/profile/photo', formData);
  },
};
