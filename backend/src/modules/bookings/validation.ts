import { z } from 'zod';
import { WORKER_SKILL_CATEGORIES } from '@/modules/workers/interfaces';

// JSON bodies (no multipart here), so plain z number types — no z.coerce needed. Default
// radiusKm is 50 (the backend's own max, same ceiling nearbySearchQuerySchema enforces) per
// explicit instruction to broadcast the full 50km range for testing; a real production
// default would likely be much smaller.
export const createQuickBookingSchema = z.object({
  skillCategories: z.array(z.enum(WORKER_SKILL_CATEGORIES as [string, ...string[]])).min(1, 'Select at least one skill'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.1).max(50).default(50),
  locationAddress: z.string().trim().max(300).optional(),
});

/** "Find jobs now" — the worker's current position, when the app has it. */
export const searchOffersSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .default({});

/** The travelling worker's latest position. */
export const updateWorkerLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// `.default({})` so a worker cancelling without a reason still validates.
export const workerCancelSchema = z.object({ reason: z.string().trim().max(200).optional() }).default({});

export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'Enter the 4-digit PIN'),
});

// `.default({})` so finishing without a rating still validates (the app always sends one).
export const completeBookingSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    review: z.string().trim().max(300).optional(),
  })
  .default({});
