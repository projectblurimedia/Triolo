import { WorkerSkillCategory } from './interfaces';

export interface CreateWorkerProfileDto {
  skillCategories: WorkerSkillCategory[];
  otherSkillDescription?: string;
  experienceYears: number;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string;
}

export interface UpdateWorkerProfileDto extends CreateWorkerProfileDto {
  /** Existing portfolio photo URLs the caller wants to keep — anything omitted is dropped, newly uploaded files are appended (capped at 6 total). */
  existingPhotoUrls?: string[];
}
