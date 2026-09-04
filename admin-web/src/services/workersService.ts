import { apiClient } from './apiClient';

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
  createdAt: string;
  updatedAt: string;
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
  latitude: number | null;
  longitude: number | null;
  locationAddress: string;
  portfolioPhotos: File[];
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
    params.portfolioPhotos.forEach((file) => formData.append('portfolioPhotos', file));
    return apiClient.postForm('/workers/me/profile', formData);
  },
};
