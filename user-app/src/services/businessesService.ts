import { apiClient } from './apiClient';
import { PickedImage } from '@/components/ImagePickerField';

export interface CreateBusinessProfileParams {
  shopName: string;
  shopCategories: string[];
  otherCategoryDescription?: string;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string;
  shopPhotos: PickedImage[];
  deliveryAvailable: boolean;
  deliveryPricePerKm?: number;
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
  locationAddress: string | null;
  shopPhotoUrls: string[];
  deliveryAvailable: boolean;
  deliveryPricePerKm: number | null;
  verificationStatus: string;
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
    params.shopPhotos.forEach((image) => {
      formData.append('shopPhotos', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return apiClient.postForm('/businesses/me/profile', formData);
  },

  updateProfile: (params: UpdateBusinessProfileParams) => {
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
    formData.append('existingPhotoUrls', JSON.stringify(params.existingPhotoUrls));
    params.shopPhotos.forEach((image) => {
      formData.append('shopPhotos', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return apiClient.patchForm<BusinessProfile>('/businesses/me/profile', formData);
  },

  deleteProfile: () => apiClient.delete<null>('/businesses/me/profile', true),
};
