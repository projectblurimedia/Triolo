import { z } from 'zod';
import { WORKER_SKILL_CATEGORIES } from './interfaces';
import { parseJsonIfString } from '@/common/utils/parseMultipartField';

// multipart/form-data fields all arrive as strings (multer doesn't coerce types), so
// numeric/nullable fields use z.coerce here, and the array field is JSON-stringified by
// the client and parsed back via preprocess — unlike the JSON-body schemas elsewhere.
export const createWorkerProfileSchema = z
  .object({
    skillCategories: z.preprocess(
      parseJsonIfString,
      z.array(z.enum(WORKER_SKILL_CATEGORIES as [string, ...string[]])).min(1, 'Select at least one skill'),
    ),
    otherSkillDescription: z.string().trim().max(100).optional(),
    experienceYears: z.coerce.number().int().min(0).max(60),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    locationAddress: z.string().trim().min(2).max(255).optional(),
  })
  .refine((data) => !data.skillCategories.includes('other') || !!data.otherSkillDescription, {
    message: 'Please describe your skill',
    path: ['otherSkillDescription'],
  });
