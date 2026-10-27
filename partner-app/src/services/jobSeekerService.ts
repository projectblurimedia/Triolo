import { apiClient } from './apiClient';
import { PickedImage } from '@/components/ImagePickerField';

export const JOB_CATEGORIES = [
  { key: 'teacher', icon: 'chalkboard-user' },
  { key: 'cook', icon: 'kitchen-set' },
  { key: 'housekeeper', icon: 'broom' },
  { key: 'nanny', icon: 'baby' },
  { key: 'elder_care', icon: 'person-cane' },
  { key: 'driver', icon: 'car' },
  { key: 'security_guard', icon: 'shield-halved' },
  { key: 'gardener', icon: 'seedling' },
  { key: 'office_assistant', icon: 'briefcase' },
  { key: 'shop_assistant', icon: 'cash-register' },
  { key: 'maid', icon: 'soap' },
  { key: 'delivery_boy', icon: 'motorcycle' },
  { key: 'receptionist', icon: 'bell-concierge' },
  { key: 'accountant', icon: 'calculator' },
  { key: 'computer_operator', icon: 'computer' },
  { key: 'data_entry', icon: 'keyboard' },
  { key: 'sales_executive', icon: 'handshake' },
  { key: 'telecaller', icon: 'headset' },
  { key: 'cashier', icon: 'money-bill-wave' },
  { key: 'waiter', icon: 'utensils' },
  { key: 'nurse', icon: 'user-nurse' },
  { key: 'tailor', icon: 'scissors' },
  { key: 'beautician', icon: 'wand-magic-sparkles' },
  { key: 'music_dance_teacher', icon: 'music' },
  { key: 'fitness_trainer', icon: 'dumbbell' },
  { key: 'watchman', icon: 'user-shield' },
  { key: 'helper_labour', icon: 'person-digging' },
  { key: 'warehouse_staff', icon: 'boxes-stacked' },
  { key: 'factory_worker', icon: 'industry' },
  { key: 'farm_worker', icon: 'tractor' },
  { key: 'other', icon: 'ellipsis' },
] as const;
export type JobCategory = (typeof JOB_CATEGORIES)[number]['key'];
export type PayPeriod = 'daily' | 'monthly';
export type Availability = 'full_time' | 'part_time' | 'live_in';
export const AVAILABILITIES: Availability[] = ['full_time', 'part_time', 'live_in'];

export interface JobPost {
  id: string;
  accountId: string;
  category: JobCategory;
  title: string;
  payAmount: number;
  payPeriod: PayPeriod;
  availability: Availability;
  experienceYears: number;
  skills: string[];
  description: string | null;
  latitude: number;
  longitude: number;
  locationAddress: string;
  photoUrl: string | null;
  isActive: boolean;
  /** Times customers opened it (Activity shows it as visits). */
  viewCount?: number;
  /** Visits not looked at yet. */
  newViews?: number;
  createdAt: string;
  updatedAt: string;
}

/** Someone who opened one of my job posts. */
export interface JobPostViewer {
  viewerKey: string;
  /** Hidden (null) without the job post plan. */
  name: string | null;
  mobile: string | null;
  lastViewedAt: string;
  times: number;
  isNew: boolean;
}

export interface JobPostViewers {
  locked: boolean;
  total: number;
  newCount: number;
  viewers: JobPostViewer[];
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

/** "Looking for work" posts — a partner may keep several (backend `job-seekers` module). */
export const jobSeekerService = {
  listMine: () => apiClient.get<JobPost[]>('/job-seekers/me/posts', true),
  create: (params: SaveJobPostParams) => apiClient.post<JobPost>('/job-seekers/me/posts', params, true),
  update: (id: string, params: SaveJobPostParams) => apiClient.put<JobPost>(`/job-seekers/me/posts/${id}`, params, true),
  setActive: (id: string, isActive: boolean) =>
    apiClient.patch<JobPost>(`/job-seekers/me/posts/${id}/active`, { isActive }, true),
  remove: (id: string) => apiClient.delete<null>(`/job-seekers/me/posts/${id}`, true),
  uploadPhoto: (id: string, image: PickedImage) => {
    const formData = new FormData();
    // React Native's FormData takes this {uri, name, type} file shape.
    formData.append('photo', image as unknown as Blob);
    return apiClient.putForm<JobPost>(`/job-seekers/me/posts/${id}/photo`, formData);
  },
  removePhoto: (id: string) => apiClient.delete<JobPost>(`/job-seekers/me/posts/${id}/photo`, true),
  viewers: (id: string) => apiClient.get<JobPostViewers>(`/job-seekers/me/posts/${id}/viewers`, true),
  markViewsSeen: (id: string) => apiClient.post<null>(`/job-seekers/me/posts/${id}/viewers/seen`, undefined, true),
};
