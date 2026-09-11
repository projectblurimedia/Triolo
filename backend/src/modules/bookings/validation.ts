import { z } from 'zod';
import { WORKER_SKILL_CATEGORIES } from '@/modules/workers/interfaces';

// JSON body (not multipart, unlike workers/businesses' profile endpoints), so plain z
// number types — no z.coerce needed. Default radiusKm is 50 (the backend's own max, same
// ceiling nearbySearchQuerySchema enforces) per explicit instruction to broadcast the full
// 50km range for testing; a real production default would likely be much smaller.
export const createQuickBookingSchema = z.object({
  skillCategories: z
    .array(z.enum(WORKER_SKILL_CATEGORIES as [string, ...string[]]))
    .min(1, 'Select at least one skill'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.1).max(50).default(50),
});
