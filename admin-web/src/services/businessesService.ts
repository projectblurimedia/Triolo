import { apiClient } from './apiClient';

export interface BusinessProfile {
  id: string;
  accountId: string;
  shopName: string;
  shopCategories: string[];
  otherCategoryDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  shopPhotoUrls: string[];
  deliveryAvailable: boolean;
  deliveryPricePerKm: number | null;
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
  latitude: number | null;
  longitude: number | null;
  locationAddress: string;
  shopPhotos: File[];
  deliveryAvailable: boolean;
  deliveryPricePerKm?: number;
}

export const businessesService = {
  getMyProfile: () => apiClient.get<BusinessProfile | null>('/businesses/me/profile', true),

  createProfile: (params: CreateBusinessProfileParams) => {
    const formData = new FormData();
    formData.append('shopName', params.shopName);
    formData.append('shopCategories', JSON.stringify(params.shopCategories));
    if (params.otherCategoryDescription) formData.append('otherCategoryDescription', params.otherCategoryDescription);
    if (params.latitude != null) formData.append('latitude', String(params.latitude));
    if (params.longitude != null) formData.append('longitude', String(params.longitude));
    formData.append('locationAddress', params.locationAddress);
    formData.append('deliveryAvailable', String(params.deliveryAvailable));
    if (params.deliveryAvailable && params.deliveryPricePerKm != null) {
      formData.append('deliveryPricePerKm', String(params.deliveryPricePerKm));
    }
    params.shopPhotos.forEach((file) => formData.append('shopPhotos', file));
    return apiClient.postForm('/businesses/me/profile', formData);
  },
};
