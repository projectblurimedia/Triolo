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
