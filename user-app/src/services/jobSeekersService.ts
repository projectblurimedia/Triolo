import { apiClient } from './apiClient';

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
  { key: 'other', icon: 'ellipsis' },
] as const;
export type JobCategory = (typeof JOB_CATEGORIES)[number]['key'];
export type PayPeriod = 'daily' | 'monthly';
export type Availability = 'full_time' | 'part_time' | 'live_in';
export type JobSeekerSort = 'distance' | 'pay';

/** Someone nearby looking for regular work (posted from the partner app), with their phone. */
export interface JobSeeker {
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
  fullName: string;
  mobileNumber: string;
  distanceMeters: number;
  updatedAt: string;
}

export interface JobSeekerSearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  category?: JobCategory | null;
  payPeriod?: PayPeriod | null;
  query?: string;
  sort: JobSeekerSort;
}

export const jobSeekersService = {
  search: (params: JobSeekerSearchParams) => {
    const search = new URLSearchParams();
    search.set('latitude', String(params.latitude));
    search.set('longitude', String(params.longitude));
    search.set('radiusKm', String(params.radiusKm));
    search.set('sort', params.sort);
    search.set('limit', '50');
    if (params.category) search.set('category', params.category);
    if (params.payPeriod) search.set('payPeriod', params.payPeriod);
    if (params.query) search.set('query', params.query);
    return apiClient.get<JobSeeker[]>(`/job-seekers/search?${search.toString()}`, true);
  },
};
