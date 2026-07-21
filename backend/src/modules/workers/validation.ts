import { z } from 'zod';
import { WORKER_SKILL_CATEGORIES } from './interfaces';

// multipart/form-data fields all arrive as strings (multer doesn't coerce types), so
// numeric/nullable fields use z.coerce here — unlike the JSON-body schemas elsewhere.
export const createWorkerProfileSchema = z.object({
  skillCategory: z.enum(WORKER_SKILL_CATEGORIES as [string, ...string[]]),
  experienceYears: z.coerce.number().int().min(0).max(60),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  locationAddress: z.string().trim().min(2).max(255).optional(),
});
