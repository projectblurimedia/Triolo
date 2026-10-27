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
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  fullName: string;
  /** Hidden (null) until paid for once when there's no plan — see contactLocked. */
  mobileNumber: string | null;
  /** The number is hidden until paid for (or a plan). */
  contactLocked?: boolean;
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
  /** Kinds of work people typed themselves, matching a search — for the Hire Staff picker. */
  customTitles: (query: string) => apiClient.get<string[]>(`/job-seekers/custom-titles?query=${encodeURIComponent(query)}`, true),
  /** One live post (e.g. from an ad's Contact). */
  getPublic: (id: string) => apiClient.get<JobSeeker>(`/job-seekers/public/${id}`, true),
  /** A customer opened this post: one more visit for the poster (fire and forget). */
  recordView: (id: string) => apiClient.post<null>(`/job-seekers/${id}/view`, undefined, true),
};
