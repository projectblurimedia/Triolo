export const JOB_SEEKER_CATEGORIES = [
  'teacher',
  'cook',
  'housekeeper',
  'nanny',
  'elder_care',
  'driver',
  'security_guard',
  'gardener',
  'office_assistant',
  'shop_assistant',
  'maid',
  'delivery_boy',
  'receptionist',
  'accountant',
  'computer_operator',
  'data_entry',
  'sales_executive',
  'telecaller',
  'cashier',
  'waiter',
  'nurse',
  'tailor',
  'beautician',
  'music_dance_teacher',
  'fitness_trainer',
  'watchman',
  'helper_labour',
  'warehouse_staff',
  'factory_worker',
  'farm_worker',
  'other',
] as const;
export type JobSeekerCategory = (typeof JOB_SEEKER_CATEGORIES)[number];

export const JOB_SEEKER_PAY_PERIODS = ['daily', 'monthly'] as const;
export type JobSeekerPayPeriod = (typeof JOB_SEEKER_PAY_PERIODS)[number];

export const JOB_SEEKER_AVAILABILITIES = ['full_time', 'part_time', 'live_in'] as const;
export type JobSeekerAvailability = (typeof JOB_SEEKER_AVAILABILITIES)[number];

/** A person's "I'm looking for work" post — what they do, expected pay, skills, where they are. */
export interface JobSeekerPost {
  id: string;
  /** Times customers opened it (never counting the poster). */
  viewCount: number;
  /** Visits the poster hasn't looked at yet (only on the poster's own posts). */
  newViews?: number;
  accountId: string;
  category: JobSeekerCategory;
  title: string;
  payAmount: number;
  payPeriod: JobSeekerPayPeriod;
  availability: JobSeekerAvailability;
  experienceYears: number;
  skills: string[];
  description: string | null;
  latitude: number;
  longitude: number;
  locationAddress: string;
  /** Profile photo (Cloudinary), or null. */
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A post as a customer sees it in search: with the poster's name, phone to call, and distance. */
export interface JobSeekerSearchResult extends JobSeekerPost {
  fullName: string;
  /** Null while the viewer hasn't paid to see it (no plan; see contactLocked). */
  mobileNumber: string | null;
  distanceMeters: number;
  /** The number is hidden until the viewer pays once (or subscribes). */
  contactLocked?: boolean;
}

/** A post as the admin sees it: the poster's name, phone and account standing. */
export interface AdminJobSeekerPost extends JobSeekerPost {
  fullName: string;
  mobileNumber: string;
  accountStatus: string;
}

export interface AdminJobSeekerListFilter {
  q?: string;
  active?: boolean;
  page: number;
  limit: number;
}

export interface SaveJobSeekerPostParams {
  category: JobSeekerCategory;
  title: string;
  payAmount: number;
  payPeriod: JobSeekerPayPeriod;
  availability: JobSeekerAvailability;
  experienceYears: number;
  skills: string[];
  description?: string | null;
  latitude: number;
  longitude: number;
  locationAddress: string;
}

export type JobSeekerSort = 'distance' | 'pay';

export interface JobSeekerSearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  category?: JobSeekerCategory;
  payPeriod?: JobSeekerPayPeriod;
  availability?: JobSeekerAvailability;
  query?: string;
  sort: JobSeekerSort;
  limit: number;
  /** Subscribed partners' accounts: listed first. */
  priorityAccountIds?: string[];
}

/** Someone who opened one of the partner's job posts. */
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
  /** Who viewed is hidden: the partner isn't on the job post plan. */
  locked: boolean;
  total: number;
  newCount: number;
  viewers: JobPostViewer[];
}
