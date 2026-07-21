import { apiClient } from './apiClient';
import { PickedImage } from '@/components/ImagePickerField';

export interface CreateBusinessProfileParams {
  shopName: string;
  shopCategory: string;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string;
  shopPhotos: PickedImage[];
}

export interface BusinessProfile {
  id: string;
  accountId: string;
  shopName: string;
  shopCategory: string;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  shopPhotoUrls: string[];
  verificationStatus: string;
}

export const businessesService = {
  getMyProfile: () => apiClient.get<BusinessProfile | null>('/businesses/me/profile', true),

  createProfile: (params: CreateBusinessProfileParams) => {
    const formData = new FormData();
    formData.append('shopName', params.shopName);
    formData.append('shopCategory', params.shopCategory);
    if (params.latitude != null) formData.append('latitude', String(params.latitude));
    if (params.longitude != null) formData.append('longitude', String(params.longitude));
    formData.append('locationAddress', params.locationAddress);
    params.shopPhotos.forEach((image) => {
      formData.append('shopPhotos', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return apiClient.postForm('/businesses/me/profile', formData);
  },
};
