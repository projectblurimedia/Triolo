import { apiClient } from './apiClient';
import { PickedImage } from '@/components/ImagePickerField';

export interface CreateWorkerProfileParams {
  skillCategories: string[];
  otherSkillDescription?: string;
  experienceYears: number;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string;
  portfolioPhotos: PickedImage[];
}

export interface UpdateWorkerProfileParams extends CreateWorkerProfileParams {
  /** Existing (already-uploaded) photo URLs to keep — anything omitted is dropped. */
  existingPhotoUrls: string[];
}

export interface WorkerProfile {
  id: string;
  accountId: string;
  skillCategories: string[];
  otherSkillDescription: string | null;
  experienceYears: number;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  portfolioPhotoUrls: string[];
  verificationStatus: string;
}

export const workersService = {
  getMyProfile: () => apiClient.get<WorkerProfile | null>('/workers/me/profile', true),

  createProfile: (params: CreateWorkerProfileParams) => {
    const formData = new FormData();
    formData.append('skillCategories', JSON.stringify(params.skillCategories));
    if (params.otherSkillDescription) formData.append('otherSkillDescription', params.otherSkillDescription);
    formData.append('experienceYears', String(params.experienceYears));
    if (params.latitude != null) formData.append('latitude', String(params.latitude));
    if (params.longitude != null) formData.append('longitude', String(params.longitude));
    formData.append('locationAddress', params.locationAddress);
    params.portfolioPhotos.forEach((image) => {
      // React Native's fetch/FormData accepts this {uri,name,type} file-object shape —
      // not a real Blob, but that's what the runtime expects (matches the pattern
      // proven in a sibling project's image-upload flow).
      formData.append('portfolioPhotos', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return apiClient.postForm('/workers/me/profile', formData);
  },

  updateProfile: (params: UpdateWorkerProfileParams) => {
    const formData = new FormData();
    formData.append('skillCategories', JSON.stringify(params.skillCategories));
    if (params.otherSkillDescription) formData.append('otherSkillDescription', params.otherSkillDescription);
    formData.append('experienceYears', String(params.experienceYears));
    if (params.latitude != null) formData.append('latitude', String(params.latitude));
    if (params.longitude != null) formData.append('longitude', String(params.longitude));
    formData.append('locationAddress', params.locationAddress);
    formData.append('existingPhotoUrls', JSON.stringify(params.existingPhotoUrls));
    params.portfolioPhotos.forEach((image) => {
      formData.append('portfolioPhotos', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return apiClient.patchForm<WorkerProfile>('/workers/me/profile', formData);
  },

  deleteProfile: () => apiClient.delete<null>('/workers/me/profile', true),
};
