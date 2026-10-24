import { apiClient } from './apiClient';
import { appendPlace, PlaceValue } from '@/utils/place';
import { PickedImage } from '@/components/ImagePickerField';

export interface CreateWorkerProfileParams {
  skillCategories: string[];
  otherSkillDescription?: string;
  experienceYears: number;
  /** GPS or map pin — the full address is sent too, only the place name is ever shown. */
  place: PlaceValue;
  portfolioPhotos: PickedImage[];
  /** A new profile photo, or null to remove the saved one — uploaded by the hooks after the profile saves. */
  profilePhoto?: PickedImage | null;
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
  /** The place name shown to people (village / town). The rest is stored, never shown. */
  locationName: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  profilePhotoUrl: string | null;
  portfolioPhotoUrls: string[];
  verificationStatus: string;
  /** Average customer rating (1 decimal), or null before the first rating. */
  ratingAverage: number | null;
  ratingCount: number;
}

export const workersService = {
  getMyProfile: () => apiClient.get<WorkerProfile | null>('/workers/me/profile', true),
  /** Skills other workers added themselves (names) matching a search — reused instead of retyped. */
  customSkills: (query: string) => apiClient.get<string[]>(`/workers/custom-skills?query=${encodeURIComponent(query)}`, true),

  createProfile: (params: CreateWorkerProfileParams) => {
    const formData = new FormData();
    formData.append('skillCategories', JSON.stringify(params.skillCategories));
    if (params.otherSkillDescription) formData.append('otherSkillDescription', params.otherSkillDescription);
    formData.append('experienceYears', String(params.experienceYears));
    appendPlace(formData, params.place);
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
    appendPlace(formData, params.place);
    formData.append('existingPhotoUrls', JSON.stringify(params.existingPhotoUrls));
    params.portfolioPhotos.forEach((image) => {
      formData.append('portfolioPhotos', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return apiClient.patchForm<WorkerProfile>('/workers/me/profile', formData);
  },

  deleteProfile: () => apiClient.delete<null>('/workers/me/profile', true),
  uploadProfilePhoto: (image: PickedImage) => {
    const formData = new FormData();
    // React Native's FormData takes this {uri, name, type} file shape.
    formData.append('photo', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    return apiClient.putForm<WorkerProfile>('/workers/me/profile/photo', formData);
  },
  removeProfilePhoto: () => apiClient.delete<WorkerProfile>('/workers/me/profile/photo', true),
};
