import { apiClient } from './apiClient';

export interface BusinessProfile {
  id: string;
  accountId: string;
  shopName: string;
  shopCategories: string[];
  otherCategoryDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  city: string;
  district: string;
  state: string;
  pincode: string;
  shopPhotoUrls: string[];
  deliveryAvailable: boolean;
  deliveryPricePerKm: number | null;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
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
  area?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
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
    if (params.area) formData.append('area', params.area);
    formData.append('city', params.city);
    formData.append('district', params.district);
    formData.append('state', params.state);
    formData.append('pincode', params.pincode);
    formData.append('deliveryAvailable', String(params.deliveryAvailable));
    if (params.deliveryAvailable && params.deliveryPricePerKm != null) {
      formData.append('deliveryPricePerKm', String(params.deliveryPricePerKm));
    }
    params.shopPhotos.forEach((file) => formData.append('shopPhotos', file));
    return apiClient.postForm('/businesses/me/profile', formData);
  },
};
