import { apiClient } from './apiClient';

/** The kinds of regular work a person can post for (same keys as the Partner app). */
export const JOB_CATEGORIES = [
  { key: 'teacher', label: 'Teacher / Tutor' },
  { key: 'cook', label: 'Cook' },
  { key: 'housekeeper', label: 'Housekeeper' },
  { key: 'nanny', label: 'Nanny / Babysitter' },
  { key: 'elder_care', label: 'Elder care' },
  { key: 'driver', label: 'Driver' },
  { key: 'security_guard', label: 'Security guard' },
  { key: 'gardener', label: 'Gardener' },
  { key: 'office_assistant', label: 'Office assistant' },
  { key: 'shop_assistant', label: 'Shop assistant' },
  { key: 'other', label: 'Other' },
] as const;
export type JobCategory = (typeof JOB_CATEGORIES)[number]['key'];
export type PayPeriod = 'daily' | 'monthly';
export type Availability = 'full_time' | 'part_time' | 'live_in';
export const AVAILABILITIES: { key: Availability; label: string }[] = [
  { key: 'full_time', label: 'Full time' },
  { key: 'part_time', label: 'Part time' },
  { key: 'live_in', label: 'Live-in (stays at home)' },
];

export interface JobPost {
  id: string;
  category: JobCategory;
  title: string;
  payAmount: number;
  payPeriod: PayPeriod;
  availability: Availability;
  experienceYears: number;
  skills: string[];
  description: string | null;
  locationAddress: string;
  photoUrl: string | null;
  isActive: boolean;
}

export interface SaveJobPostParams {
  category: JobCategory;
  title: string;
  payAmount: number;
  payPeriod: PayPeriod;
  availability: Availability;
  experienceYears: number;
  skills: string[];
  description?: string;
  latitude: number;
  longitude: number;
  locationAddress: string;
}

/** "Looking for work" post — one per account (backend `job-seekers` module). */
export const jobSeekerService = {
  getMine: () => apiClient.get<JobPost | null>('/job-seekers/me', true),
  save: (params: SaveJobPostParams) => apiClient.put<JobPost>('/job-seekers/me', params, true),
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient.putForm<JobPost>('/job-seekers/me/photo', formData);
  },
};
