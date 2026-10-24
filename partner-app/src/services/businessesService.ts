import { apiClient } from './apiClient';
import { appendPlace, PlaceValue } from '@/utils/place';
import { PickedImage } from '@/components/ImagePickerField';

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

export const businessesService = {
  getMyProfile: () => apiClient.get<BusinessProfile | null>('/businesses/me/profile', true),
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
    return apiClient.postForm('/businesses/me/profile', formData);
  },

  updateProfile: (params: UpdateBusinessProfileParams) => {
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
    return apiClient.patchForm<BusinessProfile>('/businesses/me/profile', formData);
  },

  deleteProfile: () => apiClient.delete<null>('/businesses/me/profile', true),
  uploadProfilePhoto: (image: PickedImage) => {
    const formData = new FormData();
    // React Native's FormData takes this {uri, name, type} file shape.
    formData.append('photo', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    return apiClient.putForm<BusinessProfile>('/businesses/me/profile/photo', formData);
  },
  removeProfilePhoto: () => apiClient.delete<BusinessProfile>('/businesses/me/profile/photo', true),
};
