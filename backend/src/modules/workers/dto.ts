import { WorkerSkillCategory } from './interfaces';

export interface CreateWorkerProfileDto {
  skillCategories: WorkerSkillCategory[];
  otherSkillDescription?: string;
  experienceYears: number;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string;
}
