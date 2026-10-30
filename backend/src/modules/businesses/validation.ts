import { z } from 'zod';
import { BUSINESS_SHOP_CATEGORIES } from './interfaces';
import { parseBooleanIfString, parseJsonIfString } from '@/common/utils/parseMultipartField';

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
// nullable/boolean fields use z.coerce/preprocess here, and the array field is
// JSON-stringified by the client and parsed back — unlike the JSON-body schemas
// elsewhere.
export const createBusinessProfileSchema = z
  .object({
    shopName: z.string().trim().min(2, 'Shop name is too short').max(150),
    shopCategories: z.preprocess(
      parseJsonIfString,
      z.array(z.enum(BUSINESS_SHOP_CATEGORIES as [string, ...string[]])).min(1, 'Select at least one category'),
    ),
    otherCategoryDescription: z.string().trim().max(100).optional(),
    ...locationFields,
    deliveryAvailable: z.preprocess(parseBooleanIfString, z.boolean()),
    deliveryPricePerKm: z.coerce.number().min(0).max(1000).optional(),
    deliveryMinCharge: z.coerce.number().min(0).max(10000).optional(),
  })
  .refine((data) => !data.shopCategories.includes('other') || !!data.otherCategoryDescription, {
    message: 'Please describe your shop category',
    path: ['otherCategoryDescription'],
  })
  .refine((data) => !data.deliveryAvailable || data.deliveryPricePerKm !== undefined, {
    message: 'Enter a price per km for delivery',
    path: ['deliveryPricePerKm'],
  });

// Query params arrive as strings (Express doesn't coerce) — same z.coerce convention as
// admin's own listQuerySchema, for the same reason.
export const nearbySearchQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(50).default(10),
  query: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // One shop category, or several separated by commas (any of them matches).
  // Fixed kinds and / or names shops typed themselves ("Fancy"), comma separated.
  shopCategory: z.string().trim().max(300).optional(),
  // With a type already picked, the search box is about names only.
  nameOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  // Query strings are text: only the literal 'true' turns the delivery filter on.
  delivery: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  sort: z.enum(['distance', 'rating']).default('distance'),
});

export const updateBusinessProfileSchema = z
  .object({
    shopName: z.string().trim().min(2, 'Shop name is too short').max(150),
    shopCategories: z.preprocess(
      parseJsonIfString,
      z.array(z.enum(BUSINESS_SHOP_CATEGORIES as [string, ...string[]])).min(1, 'Select at least one category'),
    ),
    otherCategoryDescription: z.string().trim().max(100).optional(),
    ...locationFields,
    deliveryAvailable: z.preprocess(parseBooleanIfString, z.boolean()),
    deliveryPricePerKm: z.coerce.number().min(0).max(1000).optional(),
    deliveryMinCharge: z.coerce.number().min(0).max(10000).optional(),
    existingPhotoUrls: z.preprocess(parseJsonIfString, z.array(z.string())).optional(),
  })
  .refine((data) => !data.shopCategories.includes('other') || !!data.otherCategoryDescription, {
    message: 'Please describe your shop category',
    path: ['otherCategoryDescription'],
  })
  .refine((data) => !data.deliveryAvailable || data.deliveryPricePerKm !== undefined, {
    message: 'Enter a price per km for delivery',
    path: ['deliveryPricePerKm'],
  });

export const addStaffSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter their name').max(80),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});
