import { WorkerSkillCategory } from './interfaces';

export interface CreateWorkerProfileDto {
  skillCategory: WorkerSkillCategory;
  experienceYears: number;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string;
}
