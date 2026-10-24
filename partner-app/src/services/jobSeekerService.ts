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
  createdAt: string;
  updatedAt: string;
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
  setActive: (isActive: boolean) => apiClient.patch<JobPost>('/job-seekers/me/active', { isActive }, true),
  remove: () => apiClient.delete<null>('/job-seekers/me', true),
  uploadPhoto: (image: PickedImage) => {
    const formData = new FormData();
    // React Native's FormData takes this {uri, name, type} file shape.
    formData.append('photo', image as unknown as Blob);
    return apiClient.putForm<JobPost>('/job-seekers/me/photo', formData);
  },
  removePhoto: () => apiClient.delete<JobPost>('/job-seekers/me/photo', true),
};
