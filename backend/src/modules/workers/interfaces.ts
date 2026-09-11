export type WorkerSkillCategory =
  | 'electrician'
  | 'plumber'
  | 'painter'
  | 'carpenter'
  | 'mechanic'
  | 'cleaner'
  | 'mason'
  | 'other';

export const WORKER_SKILL_CATEGORIES: WorkerSkillCategory[] = [
  'electrician',
  'plumber',
  'painter',
  'carpenter',
  'mechanic',
  'cleaner',
  'mason',
  'other',
];

export type ProfileVerificationStatus = 'pending_verification' | 'verified' | 'rejected';

export interface WorkerProfile {
  id: string;
  accountId: string;
  skillCategories: WorkerSkillCategory[];
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
  verificationStatus: ProfileVerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin-facing shape only — joins the owning account's basic contact fields for review context. */
export interface WorkerProfileWithAccount extends WorkerProfile {
  accountFullName: string;
  accountMobileNumber: string;
  accountEmail: string;
}

export interface AdminListFilter {
  status?: ProfileVerificationStatus;
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
  limit: number;
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
