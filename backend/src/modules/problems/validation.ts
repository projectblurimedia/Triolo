import { z } from 'zod';
import { WORKER_SKILL_CATEGORIES } from '@/modules/workers/interfaces';

// JSON body — photos are attached afterwards, one per request (see routes.ts for why).
export const createProblemPostSchema = z.object({
  skillCategories: z
    .array(z.enum(WORKER_SKILL_CATEGORIES as [string, ...string[]]))
    .min(1, 'Select the worker you need'),
  description: z.string().trim().max(500).optional(),
  quotationAmount: z.number().int('Enter a whole amount').min(1, 'Enter your quotation').max(1_000_000),
  locationAddress: z.string().trim().min(3, 'Enter your location').max(300),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// Customer confirming a job finished, optionally rating the worker. `.default({})` so an
// empty body (no rating) still validates.
export const completeProblemSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    review: z.string().trim().max(300).optional(),
  })
  .default({});

// Same fields as create, plus which existing photos survive the edit. New photos are added
// afterwards via POST /problems/:id/photos, same as on create.
export const updateProblemPostSchema = createProblemPostSchema.extend({
  keepPhotoUrls: z.array(z.string()).max(5).default([]),
});
