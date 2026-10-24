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
  /** Average customer star rating (1 decimal), null until the first rating. */
  ratingAverage: number | null;
  ratingCount: number;
}

export type NearbyWorkerSort = 'distance' | 'rating';

export interface WorkerNearbyResult extends WorkerProfile {
  distanceMeters: number;
  accountFullName: string;
}

export interface NearbySearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  query?: string;
  skillCategory?: string;
  sort?: NearbyWorkerSort;
  limit?: number;
}

export const workersService = {
  getMyProfile: () => apiClient.get<WorkerProfile | null>('/workers/me/profile', true),
  /** One verified worker as customers see them (e.g. from an ad's Book Now). */
  getPublic: (id: string) => apiClient.get<WorkerProfile & { accountFullName: string }>(`/workers/public/${id}`, true),

  /** Skills workers added themselves (names) matching a search — for the skill picker. */
  customSkills: (query: string) => apiClient.get<string[]>(`/workers/custom-skills?query=${encodeURIComponent(query)}`, true),
  searchNearby: (params: NearbySearchParams) => {
    const search = new URLSearchParams();
    search.set('latitude', String(params.latitude));
    search.set('longitude', String(params.longitude));
    if (params.radiusKm != null) search.set('radiusKm', String(params.radiusKm));
    if (params.query) search.set('query', params.query);
    if (params.skillCategory) search.set('skillCategory', params.skillCategory);
    if (params.sort) search.set('sort', params.sort);
    if (params.limit != null) search.set('limit', String(params.limit));
    return apiClient.get<WorkerNearbyResult[]>(`/workers/nearby?${search.toString()}`, true);
  },

  /** Fire-and-forget — raises a "Someone viewed your profile" notification for this worker's own account. */
  recordView: (workerId: string) => apiClient.post<null>(`/workers/${workerId}/view`, undefined, true),

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
