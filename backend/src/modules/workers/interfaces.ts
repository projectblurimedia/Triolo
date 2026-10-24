const WORKER_SKILL_CATEGORIES_LIST = [
  'electrician',
  'plumber',
  'painter',
  'carpenter',
  'mechanic',
  'cleaner',
  'mason',
  'ac_technician',
  'appliance_repair',
  'mobile_repair',
  'computer_repair',
  'tv_repair',
  'ro_water_purifier',
  'cctv_technician',
  'solar_technician',
  'welder',
  'fabricator',
  'tiles_worker',
  'false_ceiling',
  'waterproofing',
  'glass_aluminium',
  'locksmith',
  'borewell',
  'pest_control',
  'bike_mechanic',
  'car_wash',
  'driver',
  'movers_packers',
  'gardener',
  'cook',
  'caterer',
  'tailor',
  'beautician',
  'barber',
  'mehendi_artist',
  'photographer',
  'event_decorator',
  'priest',
  'tutor',
  'fitness_trainer',
  'nurse',
  'physiotherapist',
  'interior_designer',
  'architect',
  'contractor',
  'labour',
  'other',
] as const;

export type WorkerSkillCategory = (typeof WORKER_SKILL_CATEGORIES_LIST)[number];

export const WORKER_SKILL_CATEGORIES: WorkerSkillCategory[] = [...WORKER_SKILL_CATEGORIES_LIST];

export type ProfileVerificationStatus = 'pending_verification' | 'verified' | 'rejected';

export interface WorkerProfile {
  id: string;
  accountId: string;
  skillCategories: WorkerSkillCategory[];
  otherSkillDescription: string | null;
  experienceYears: number;
  latitude: number | null;
  longitude: number | null;
  /** The place name shown to people (village / town / locality). */
  locationName: string | null;
  /** The rest of the address is stored for search/admin use but never displayed. */
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  /** The worker's face / the shop's logo. */
  profilePhotoUrl: string | null;
  portfolioPhotoUrls: string[];
  verificationStatus: ProfileVerificationStatus;
  /** Average of customer star ratings (1 decimal), or null before the first rating. */
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin-facing shape only — joins the owning account's basic contact fields for review context. */
export interface WorkerProfileWithAccount extends WorkerProfile {
  accountFullName: string;
  accountMobileNumber: string;
  accountEmail: string;
  /** The account's standing — 'active', 'suspended' or 'blocked'. */
  accountStatus: string;
}

export interface AdminListFilter {
  status?: ProfileVerificationStatus;
  /** Name, mobile number. */
  q?: string;
  page: number;
  limit: number;
}

export interface AdminListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface NearbySearchFilter {
  latitude: number;
  longitude: number;
  radiusKm: number;
  query?: string;
  /** Only workers who have this skill (validated against WORKER_SKILL_CATEGORIES at the route). */
  skillCategory?: string;
  sort?: 'distance' | 'rating';
  limit: number;
  /** Subscribed partners' accounts: listed first. */
  priorityAccountIds?: string[];
}

/**
 * Public (non-admin) nearby-search result — a verified profile plus its computed distance
 * from the searcher and the owning account's display name (so a result reads as "who",
 * not just a skill list). Deliberately excludes mobile/email — unlike the admin-facing
 * `WorkerProfileWithAccount`, this is visible to any authenticated searcher, and there's no
 * booking/contact flow yet (Pending Module 4) that would justify exposing contact details.
 */
export interface WorkerNearbyResult extends WorkerProfile {
  distanceMeters: number;
  accountFullName: string;
}

/**
 * One verified worker eligible for a Quick Book broadcast (see modules/bookings) — has
 * *all* the requested skills (array containment, not overlap) and sits within the
 * requester's radius. Carries `preferredLanguage` so the broadcast push can be composed in
 * the recipient's own language, per the Localization Architecture rule that anything the
 * backend pushes unprompted is language-aware via per-recipient template lookup.
 */
export interface WorkerBroadcastMatch {
  workerId: string;
  accountId: string;
  accountFullName: string;
  preferredLanguage: 'en' | 'te';
  distanceMeters: number;
}
