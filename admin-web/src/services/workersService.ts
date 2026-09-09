import { apiClient } from './apiClient';

export interface WorkerProfile {
  id: string;
  accountId: string;
  skillCategories: string[];
  otherSkillDescription: string | null;
  experienceYears: number;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  city: string;
  district: string;
  state: string;
  pincode: string;
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
  area?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
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
    if (params.area) formData.append('area', params.area);
    formData.append('city', params.city);
    formData.append('district', params.district);
    formData.append('state', params.state);
    formData.append('pincode', params.pincode);
    params.portfolioPhotos.forEach((file) => formData.append('portfolioPhotos', file));
    return apiClient.postForm('/workers/me/profile', formData);
  },
};
