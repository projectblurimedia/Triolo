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
  locationAddress: string | null;
  portfolioPhotoUrls: string[];
  verificationStatus: ProfileVerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}
