import { z } from 'zod';
import { WORKER_SKILL_CATEGORIES } from './interfaces';
import { parseJsonIfString } from '@/common/utils/parseMultipartField';

// Location comes from GPS or a map pin: the point and the place name people see are required;
// the rest of the reverse-geocoded address is stored when the geocoder found it.
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );
const locationFields = {
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  locationName: z.string().trim().min(1, 'Choose your location').max(150),
  area: optionalText(150),
  city: optionalText(100),
  district: optionalText(100),
  state: optionalText(100),
  // Kept only when it is a real 6-digit pincode; anything else from a geocoder is dropped.
  pincode: z.preprocess(
    (value) => (typeof value === 'string' && /^[0-9]{6}$/.test(value.trim()) ? value.trim() : undefined),
    z.string().optional(),
  ),
};

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
    ...locationFields,
  })
  .refine((data) => !data.skillCategories.includes('other') || !!data.otherSkillDescription, {
    message: 'Please describe your skill',
    path: ['otherSkillDescription'],
  });

// Query params arrive as strings (Express doesn't coerce) — same z.coerce convention as
// admin's own listQuerySchema, for the same reason.
export const nearbySearchQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(50).default(10),
  query: z.string().trim().max(100).optional(),
  // One skill, or several separated by commas (any of them matches).
  // Fixed skills and / or names workers typed themselves, comma separated.
  skillCategory: z.string().trim().max(300).optional(),
  sort: z.enum(['distance', 'rating']).default('distance'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // With a type already picked, the search box is about names only.
  nameOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const updateWorkerProfileSchema = z
  .object({
    skillCategories: z.preprocess(
      parseJsonIfString,
      z.array(z.enum(WORKER_SKILL_CATEGORIES as [string, ...string[]])).min(1, 'Select at least one skill'),
    ),
    otherSkillDescription: z.string().trim().max(100).optional(),
    experienceYears: z.coerce.number().int().min(0).max(60),
    ...locationFields,
    existingPhotoUrls: z.preprocess(parseJsonIfString, z.array(z.string())).optional(),
  })
  .refine((data) => !data.skillCategories.includes('other') || !!data.otherSkillDescription, {
    message: 'Please describe your skill',
    path: ['otherSkillDescription'],
  });
