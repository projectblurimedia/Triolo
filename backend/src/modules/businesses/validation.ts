import { z } from 'zod';
import { BUSINESS_SHOP_CATEGORIES } from './interfaces';
import { parseBooleanIfString, parseJsonIfString } from '@/common/utils/parseMultipartField';

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
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    area: z.string().trim().max(150).optional(),
    city: z.string().trim().min(2, 'City is required').max(100),
    district: z.string().trim().min(2, 'District is required').max(100),
    state: z.string().trim().min(2, 'State is required').max(100),
    pincode: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/, 'Enter a valid 6-digit pincode'),
    deliveryAvailable: z.preprocess(parseBooleanIfString, z.boolean()),
    deliveryPricePerKm: z.coerce.number().min(0).max(1000).optional(),
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
  shopCategory: z.enum(BUSINESS_SHOP_CATEGORIES as [string, ...string[]]).optional(),
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
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    area: z.string().trim().max(150).optional(),
    city: z.string().trim().min(2, 'City is required').max(100),
    district: z.string().trim().min(2, 'District is required').max(100),
    state: z.string().trim().min(2, 'State is required').max(100),
    pincode: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/, 'Enter a valid 6-digit pincode'),
    deliveryAvailable: z.preprocess(parseBooleanIfString, z.boolean()),
    deliveryPricePerKm: z.coerce.number().min(0).max(1000).optional(),
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
