import { apiClient } from './apiClient';
import { appendPlace, PlaceValue } from '@/utils/place';

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
}

export interface WorkerProfileWithAccount extends WorkerProfile {
  accountFullName: string;
  accountMobileNumber: string;
  accountEmail: string;
}

export interface CreateWorkerProfileParams {
  skillCategories: string[];
  otherSkillDescription?: string;
  experienceYears: number;
  /** GPS or map pin — the full address is sent too, only the place name is ever shown. */
  place: PlaceValue;
  portfolioPhotos: File[];
}

export const workersService = {
  getMyProfile: () => apiClient.get<WorkerProfile | null>('/workers/me/profile', true),

  createProfile: (params: CreateWorkerProfileParams) => {
    const formData = new FormData();
    formData.append('skillCategories', JSON.stringify(params.skillCategories));
    if (params.otherSkillDescription) formData.append('otherSkillDescription', params.otherSkillDescription);
    formData.append('experienceYears', String(params.experienceYears));
    appendPlace(formData, params.place);
    params.portfolioPhotos.forEach((file) => formData.append('portfolioPhotos', file));
    return apiClient.postForm('/workers/me/profile', formData);
  },
  /** The profile photo goes in its own request after the profile is created. */
  uploadProfilePhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient.putForm<WorkerProfile>('/workers/me/profile/photo', formData);
  },
};
