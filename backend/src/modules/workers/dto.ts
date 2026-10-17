import { WorkerSkillCategory } from './interfaces';

export interface CreateWorkerProfileDto {
  skillCategories: WorkerSkillCategory[];
  otherSkillDescription?: string;
  experienceYears: number;
  latitude: number;
  longitude: number;
  /** The place name shown to people (village / town / locality). */
  locationName: string;
  /** The rest of the reverse-geocoded address — stored, never shown. */
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface UpdateWorkerProfileDto extends CreateWorkerProfileDto {
  /** Existing portfolio photo URLs the caller wants to keep — anything omitted is dropped, newly uploaded files are appended (capped at 6 total). */
  existingPhotoUrls?: string[];
}
